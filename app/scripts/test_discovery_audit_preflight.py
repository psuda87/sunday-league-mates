"""Pure negative tests of the LOCAL discovery launch prefix, no Docker/DB launch.
Mocks exercise branch/context inputs, never rename the real checkout or launch CI.
"""
import os
from pathlib import Path
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / 'app/scripts/test-public-discovery-local.py'
PREFIX = RUNNER.read_text().split("subprocess.run(['docker', 'image', 'inspect', IMAGE]", 1)[0]
REAL_OUTPUT = subprocess.check_output
REAL_RUN = subprocess.run


class LaunchTests(unittest.TestCase):
    def run_prefix(self, branch='audit/public-match-discovery-backend', ancestor=True, tamper=None, env=None, endpoint='unix:///var/run/docker.sock'):
        def output(args, **kwargs):
            if args[:3] == ['git','branch','--show-current']:
                return branch + '\n'
            if args[:3] == ['docker','context','inspect']:
                return endpoint + '\n'
            if args[:2] == ['git','show'] and tamper and args[2].endswith(':'+tamper):
                return b'corrupted source'
            if args[0] != 'git':
                raise AssertionError('No real Docker or other command allowed')
            return REAL_OUTPUT(args, **kwargs)
        def run(args, **kwargs):
            if args[:3] == ['git','merge-base','--is-ancestor']:
                return SimpleNamespace(returncode=0 if ancestor else 1)
            if args[0] != 'git':
                raise AssertionError('No Docker process allowed')
            return REAL_RUN(args, **kwargs)
        with patch.dict(os.environ, env or {}, clear=True), patch.object(subprocess, 'check_output', side_effect=output), \
             patch.object(subprocess, 'run', side_effect=run):
            scope={'__file__':str(RUNNER)}
            exec(compile(PREFIX,str(RUNNER),'exec'),scope)
            return scope

    def test_explicit_audit_branch_keeps_exact_backend_and_both_ancestries(self):
        scope=self.run_prefix()
        self.assertEqual(scope['AUDIT_BASE'],'24a59e104bfe80b4d2f41cbd0ad02b58fc546040')
        self.assertEqual(len(scope['historical']),41)

    def test_original_discovery_branch_is_retained(self):
        self.run_prefix(branch='feat/public-match-discovery')

    def test_unknown_branch_rejected(self):
        with self.assertRaisesRegex(RuntimeError,'branch required'):
            self.run_prefix(branch='main')

    def test_wrong_audit_ancestry_rejected(self):
        with self.assertRaisesRegex(RuntimeError,'audit base ancestry'):
            self.run_prefix(ancestor=False)

    def test_either_backend_source_tampering_rejected(self):
        for path in ('app/supabase/functions/accounts/handler.ts','app/supabase/migrations/20261030090000_public_match_discovery.sql'):
            with self.subTest(path=path), self.assertRaisesRegex(RuntimeError,'backend source changed'):
                self.run_prefix(tamper=path)

    def test_historical_migration_tampering_rejected(self):
        path='app/supabase/migrations/20261013185250_slm_auth_proof_setup.sql'
        with self.assertRaisesRegex(RuntimeError,'Historical migration changed'):
            self.run_prefix(tamper=path)

    def test_github_context_and_external_database_rejected(self):
        for env in ({'GITHUB_ACTIONS':'true'},{'DATABASE_URL':'postgres://fixture.invalid'}, {'SUPABASE_URL':'https://fixture.invalid'}):
            with self.subTest(env=env),self.assertRaises(RuntimeError):
                self.run_prefix(env=env)

    def test_remote_docker_rejected(self):
        for endpoint in ('tcp://fixture.invalid:2375','ssh://fixture.invalid'):
            with self.subTest(endpoint=endpoint),self.assertRaisesRegex(RuntimeError,'Local Docker socket'):
                self.run_prefix(endpoint=endpoint)


if __name__ == '__main__':
    unittest.main()
