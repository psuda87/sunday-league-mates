"""Launch-contract tests only: temp Git repositories and pure metadata, no DB.

We never manufacture GitHub environment variables to launch an integration run.
Positive metadata examples are passed directly to the pure validator.
"""
import copy
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import lineups_ci as ci


def event_fixture():
    base, source, merge = '1' * 40, '2' * 40, '3' * 40
    env = dict(GITHUB_ACTIONS='true', RUNNER_ENVIRONMENT='github-hosted', RUNNER_OS='Linux', RUNNER_ARCH='X64',
               GITHUB_REPOSITORY=ci.REPO, GITHUB_EVENT_NAME='pull_request', GITHUB_REF='refs/pull/28/merge',
               GITHUB_BASE_REF='main', GITHUB_HEAD_REF=ci.BRANCH, GITHUB_SHA=merge,
               GITHUB_RUN_ID='123', GITHUB_RUN_ATTEMPT='1', SLM_FREE_CI_ENABLED='true', SLM_INTEGRATION_CI_ENABLED='true')
    event = {'repository': {'full_name': ci.REPO}, 'number': 28,
             'pull_request': {'base': {'ref': 'main', 'sha': base, 'repo': {'full_name': ci.REPO}},
                              'head': {'ref': ci.BRANCH, 'sha': source, 'repo': {'full_name': ci.REPO}}}}
    return env, event, merge, [base, source]


class EventTests(unittest.TestCase):
    def test_reviewed_pr_merge_and_manual_contexts(self):
        env, event, head, parents = event_fixture()
        self.assertEqual(ci.validate_event(env, event, head, parents), parents[1])
        env.update(GITHUB_EVENT_NAME='workflow_dispatch', GITHUB_REF='refs/heads/' + ci.BRANCH)
        manual = {'repository': {'full_name': ci.REPO}, 'ref': ci.BRANCH,
                  'inputs': {'confirm_free_allowance': 'true', 'confirm_fixture_migrations': True}}
        self.assertEqual(ci.validate_event(env, manual, head, parents), head)

    def test_rejects_wrong_or_missing_environment_metadata(self):
        changes = dict(GITHUB_ACTIONS='false', RUNNER_ENVIRONMENT='self-hosted', RUNNER_OS='Windows', RUNNER_ARCH='ARM64',
                       GITHUB_REPOSITORY='attacker/slm', GITHUB_EVENT_NAME='pull_request_target',
                       GITHUB_REF='refs/heads/main', GITHUB_BASE_REF='development', GITHUB_HEAD_REF='other',
                       GITHUB_SHA='4' * 40, GITHUB_RUN_ID='../123', GITHUB_RUN_ATTEMPT='0',
                       SLM_FREE_CI_ENABLED='false', SLM_INTEGRATION_CI_ENABLED='false')
        for key, value in changes.items():
            with self.subTest(key=key):
                env, event, head, parents = event_fixture()
                env[key] = value
                with self.assertRaises(RuntimeError):
                    ci.validate_event(env, event, head, parents)

    def test_rejects_production_targets_and_external_configuration(self):
        for key in ci.FORBIDDEN:
            with self.subTest(key=key):
                env, event, head, parents = event_fixture()
                env[key] = 'fixture-deny-value'
                with self.assertRaises(RuntimeError):
                    ci.validate_event(env, event, head, parents)

    def test_rejects_fork_or_wrong_payload_repositories(self):
        for target in ('repository', 'base', 'head'):
            with self.subTest(target=target):
                env, event, head, parents = event_fixture()
                item = event['repository'] if target == 'repository' else event['pull_request'][target]['repo']
                item['full_name'] = 'attacker/slm'
                with self.assertRaises(RuntimeError):
                    ci.validate_event(env, event, head, parents)

    def test_rejects_stale_checkout_and_changed_merge_parents(self):
        env, event, head, parents = event_fixture()
        for actual, pp in [('4' * 40, parents), (head, parents[::-1]), (head, parents[:1])]:
            with self.subTest(actual=actual, pp=pp), self.assertRaises(RuntimeError):
                ci.validate_event(env, event, actual, pp)

    def test_rejects_other_pr_base_and_invalid_commit(self):
        for key, value in [('ref', 'other'), ('sha', '1234567')]:
            env, event, head, parents = event_fixture()
            event['pull_request']['base'][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                ci.validate_event(env, event, head, parents)

    def test_manual_dispatch_requires_both_explicit_confirmations_and_ref(self):
        env, _, head, parents = event_fixture()
        env.update(GITHUB_EVENT_NAME='workflow_dispatch', GITHUB_REF='refs/heads/' + ci.BRANCH)
        example = {'repository': {'full_name': ci.REPO}, 'ref': ci.BRANCH,
                   'inputs': {'confirm_free_allowance': True, 'confirm_fixture_migrations': True}}
        for key in ('confirm_free_allowance', 'confirm_fixture_migrations'):
            for value in (False, None, 'false', 1):
                bad = copy.deepcopy(example)
                bad['inputs'][key] = value
                with self.subTest(key=key, value=value), self.assertRaises(RuntimeError):
                    ci.validate_event(env, bad, head, parents)
        example['ref'] = 'other'
        with self.assertRaises(RuntimeError):
            ci.validate_event(env, example, head, parents)

    def test_local_socket_and_empty_daemon_only(self):
        ci.validate_docker({}, 'unix:///var/run/docker.sock', '')
        cases = [({'DOCKER_HOST': 'tcp://example.invalid:2375'}, 'unix:///var/run/docker.sock', ''),
                 ({}, 'ssh://example.invalid', ''), ({'DOCKER_CONTEXT': 'remote'}, 'unix:///var/run/docker.sock', ''),
                 ({}, 'unix:///var/run/docker.sock', 'existing-container')]
        for env, endpoint, ids in cases:
            with self.subTest(endpoint=endpoint, env=env, ids=ids), self.assertRaises(RuntimeError):
                ci.validate_docker(env, endpoint, ids)

    def test_resource_floor_fails_without_paid_fallback(self):
        ci.validate_resources(2, 8 * 1024**3, 6 * 1024**2)
        for args in ((1, 9 * 1024**3, 8 * 1024**2), (2, 1024**3, 8 * 1024**2), (2, 9 * 1024**3, 1024**2)):
            with self.subTest(args=args), self.assertRaises(RuntimeError):
                ci.validate_resources(*args)

    def test_cleanup_only_stops_verified_owned_ids_and_never_removes(self):
        calls = []
        label, cid = 'slm-stage3b-123-1-sql', 'a' * 64
        def execute(*args):
            calls.append(args)
            return (cid.encode() if args[0] == 'ps' else label.encode() if args[0] == 'inspect' else b'')
        ci.stop_owned(label, execute)
        self.assertEqual([c[0] for c in calls], ['ps', 'inspect', 'stop'])
        self.assertEqual(calls[-1][-1], cid)

    def test_workspace_and_temp_must_be_separate(self):
        with tempfile.TemporaryDirectory(prefix='slm-ci-paths-') as folder:
            root, temp = Path(folder) / 'repo', Path(folder) / 'temp'
            root.mkdir()
            temp.mkdir()
            ci.validate_paths({'GITHUB_WORKSPACE': str(root), 'RUNNER_TEMP': str(temp)}, root)
            for env in ({'GITHUB_WORKSPACE': str(temp), 'RUNNER_TEMP': str(temp)},
                        {'GITHUB_WORKSPACE': str(root), 'RUNNER_TEMP': str(root)},
                        {'GITHUB_WORKSPACE': str(root), 'RUNNER_TEMP': str(temp / 'missing')}):
                with self.subTest(env=env), self.assertRaises(RuntimeError):
                    ci.validate_paths(env, root)

    def test_cleanup_refuses_foreign_label_or_invalid_id_without_stop(self):
        for cid, actual in [('b' * 64, 'someone-else'), ('bad-id', 'slm-stage3b-123-1-sql')]:
            calls = []
            def execute(*args):
                calls.append(args)
                return cid.encode() if args[0] == 'ps' else actual.encode()
            with self.subTest(cid=cid), self.assertRaises(RuntimeError):
                ci.stop_owned('slm-stage3b-123-1-sql', execute)
            self.assertNotIn('stop', [c[0] for c in calls])


class SourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='slm-ci-contract-')
        cls.template = Path(cls.temp.name) / 'template'
        cls.template.mkdir()
        cls.command(cls.template, 'init', '--quiet', '--initial-branch=fixture-contract')
        baseline = ['app/src/view.tsx', 'app/supabase/functions/accounts/handler.ts', 'app/package-lock.json',
                    'app/scripts/premium-route-policy.mjs', 'app/src/auth/sessionManager.ts',
                    'app/src/finance/PremiumFinance.tsx','app/src/events/usePremiumLineup.ts', *ci.CHANGED]
        baseline += [f'app/supabase/migrations/{i:014d}_fixture.sql' for i in range(41)]
        for name in baseline:
            cls.write(cls.template, name, 'unchanged fixture source\n')
        for name in ci.ROOT_FROZEN:
            cls.write(cls.template, name, 'unchanged root policy fixture\n')
        cls.base = cls.commit(cls.template, 'baseline')
        for name in ci.CHANGED | ci.ADDED:
            cls.write(cls.template, name, 'reviewed launch implementation fixture\n')
        cls.write(cls.template, ci.WORKFLOW, 'reviewed workflow fixture\n')
        cls.stage3b = cls.commit(cls.template, 'Stage3B implementation')
        cls.overlay = {'app/src/view.tsx','app/supabase/functions/accounts/handler.ts',
                       'app/src/discovery.tsx','app/supabase/migrations/00000000000041_discovery.sql',
                       'app/scripts/test-lineups-local.py','app/scripts/test-lineups-edge-local.py'}
        for name in cls.overlay:
            value = "42 if not CI_MODE and branch=='fixture' else 41" if name.endswith(('test-lineups-local.py','test-lineups-edge-local.py')) else 'exact reviewed discovery source\n'
            cls.write(cls.template,name,value)
        cls.discovery = cls.commit(cls.template, 'exact discovery candidate')
        for name in ('app/scripts/test-lineups-local.py','app/scripts/test-lineups-edge-local.py'):
            cls.write(cls.template,name,"42 if CI_MODE or branch=='fixture' else 41")
        cls.write(cls.template,'app/scripts/lineups_ci.py','reviewed Stage2C CI gate\n')
        cls.write(cls.template,'app/scripts/test_lineups_ci_context.py','reviewed Stage2C source tests\n')
        cls.implementation = cls.commit(cls.template, 'reviewed CI implementation')
        cls.write(cls.template, ci.APPROVAL, json.dumps({'base': cls.base, 'implementation': cls.implementation}))
        cls.commit(cls.template, 'approval pointer')

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    @staticmethod
    def command(root, *args):
        return subprocess.check_output(['git', '-c', 'core.autocrlf=false', '-c', 'user.name=CI fixture', '-c', 'user.email=fixture@example.invalid',
                                        '-C', str(root), *args], stderr=subprocess.DEVNULL).decode().strip()

    @classmethod
    def commit(cls, root, message):
        cls.command(root, 'add', '.')
        cls.command(root, 'commit', '--quiet', '-m', message)
        return cls.command(root, 'rev-parse', 'HEAD')

    @staticmethod
    def write(root, name, text):
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')

    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix='case-', dir=self.temp.name))
        shutil.copytree(self.template, self.root, dirs_exist_ok=True)

    def verify(self):
        with patch.object(ci,'STAGE3B_IMPLEMENTATION',self.stage3b), patch.object(ci,'DISCOVERY_IMPLEMENTATION',self.discovery), patch.object(ci,'DISCOVERY_OVERLAY',self.overlay):
            return ci.verify_sources(self.root, self.base)

    def test_exact_approved_sources_pass_without_docker(self):
        with patch.object(ci, 'docker', side_effect=AssertionError('No Docker allowed in contract tests')):
            self.assertEqual(self.verify(), self.implementation)

    def test_rejects_handler_ui_guard_and_runner_tampering(self):
        for name in ('app/src/view.tsx', 'app/supabase/functions/accounts/handler.ts',
                     'app/scripts/premium-route-policy.mjs', 'app/scripts/test-lineups-edge-local.py',
                     'app/scripts/lineups_ci.py','app/scripts/test_lineups_ci_context.py',
                     'app/src/auth/sessionManager.ts','app/src/finance/PremiumFinance.tsx','app/src/events/usePremiumLineup.ts'):
            with self.subTest(name=name):
                old = (self.root / name).read_bytes()
                self.write(self.root, name, 'tampered\n')
                with self.assertRaises(RuntimeError):
                    self.verify()
                (self.root / name).write_bytes(old)

    def test_rejects_missing_or_modified_migration(self):
        path = next((self.root / 'app/supabase/migrations').glob('*.sql'))
        path.unlink()
        with self.assertRaises(RuntimeError):
            self.verify()

    def test_rejects_extra_tracked_migration(self):
        self.write(self.root, 'app/supabase/migrations/99999999999999_unapproved.sql', 'select 1;')
        self.commit(self.root, 'unapproved migration')
        with self.assertRaises(RuntimeError):
            self.verify()

    def test_rejects_untracked_or_ignored_executable_inputs(self):
        for name in ('app/poison.ts', 'app/supabase/functions/poison.ts'):
            with self.subTest(name=name):
                self.write(self.root, name, 'unapproved source')
                if '/functions/' in name:
                    (self.root / '.git/info/exclude').write_text(name + '\n')
                with self.assertRaises(RuntimeError):
                    self.verify()
                (self.root / name).unlink()

    def test_rejects_extra_tracked_root_source(self):
        self.write(self.root, 'app/poison.ts', 'unapproved source')
        self.commit(self.root, 'unapproved root input')
        with self.assertRaises(RuntimeError):
            self.verify()

    def test_rejects_symlink_and_workflow_drift(self):
        path = self.root / 'app/src/view.tsx'
        original=path.read_bytes()
        path.unlink()
        path.symlink_to('missing.tsx')
        with self.assertRaises(RuntimeError):
            self.verify()
        path.unlink()
        path.write_bytes(original)
        self.verify()
        self.write(self.root, ci.WORKFLOW, 'tampered workflow')
        with self.assertRaises(RuntimeError):
            self.verify()

    def test_rejects_changes_to_existing_workflow(self):
        self.write(self.root, '.github/workflows/main-pr-checks.yml', 'tampered old workflow')
        with self.assertRaises(RuntimeError):
            self.verify()

    def test_rejects_wrong_or_missing_approval_history(self):
        for pointer in ({'base': '0' * 40, 'implementation': self.implementation},
                        {'base': self.base, 'implementation': 'f' * 40}):
            self.write(self.root, ci.APPROVAL, json.dumps(pointer))
            with self.subTest(pointer=pointer), self.assertRaises(RuntimeError):
                self.verify()

    def test_new_approval_cannot_change_frozen_backend(self):
        self.write(self.root, 'app/supabase/functions/accounts/handler.ts', 'changed backend')
        bad = self.commit(self.root, 'new pointer must not authorize backend drift')
        self.write(self.root, ci.APPROVAL, json.dumps({'base': self.base, 'implementation': bad}))
        with self.assertRaises(RuntimeError):
            self.verify()

    def test_reviewed_ci_gate_update_can_repin_after_prior_pointer_exists(self):
        self.write(self.root, 'app/scripts/lineups_ci.py', 'new reviewed CI gate implementation')
        new = self.commit(self.root, 'reviewed launch update retains an old pointer in history')
        self.write(self.root, ci.APPROVAL, json.dumps({'base': self.base, 'implementation': new}))
        self.assertEqual(self.verify(), new)


    def test_new_pointer_cannot_authorize_arbitrary_runner_or_private_module_changes(self):
        for name in ('app/scripts/test-lineups-edge-local.py','app/src/auth/sessionManager.ts',
                     'app/src/finance/PremiumFinance.tsx','app/src/events/usePremiumLineup.ts','app/src/view.tsx',
                     'app/supabase/migrations/00000000000041_discovery.sql'):
            with self.subTest(name=name):
                self.write(self.root,name,'unreviewed change')
                bad=self.commit(self.root,'malicious approval repin')
                self.write(self.root,ci.APPROVAL,json.dumps({'base':self.base,'implementation':bad}))
                with self.assertRaises(RuntimeError):self.verify()

    def test_discovery_ancestry_is_required_even_with_identical_tree(self):
        tree=self.command(self.root,'rev-parse',self.discovery+'^{tree}')
        orphan=self.command(self.root,'commit-tree',tree,'-m','same reviewed tree without approved ancestry')
        with patch.object(ci,'STAGE3B_IMPLEMENTATION',self.stage3b), patch.object(ci,'DISCOVERY_IMPLEMENTATION',orphan), patch.object(ci,'DISCOVERY_OVERLAY',self.overlay):
            with self.assertRaisesRegex(RuntimeError,'ancestry missing'):ci.verify_sources(self.root,self.base)

    def test_declared_overlay_cannot_expand_to_unapproved_file(self):
        with patch.object(ci,'STAGE3B_IMPLEMENTATION',self.stage3b), patch.object(ci,'DISCOVERY_IMPLEMENTATION',self.discovery), patch.object(ci,'DISCOVERY_OVERLAY',self.overlay|{'app/src/auth/sessionManager.ts'}):
            with self.assertRaises(RuntimeError):ci.verify_sources(self.root,self.base)

if __name__ == '__main__':
    unittest.main()
