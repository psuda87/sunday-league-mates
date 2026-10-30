"""Fail-closed CI context/source checks. No database work occurs in this module.

This accident guard is not a production authorization boundary: changes to this
module, the approval pointer and workflows still require owner review.
"""
import argparse
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[2]
BASE = '45d9a4dfba838ebf9ed70f73a1b2044352df8ecd'
REPO = 'psuda87/sunday-league-mates'
BRANCH = 'chore/slm-v1-integration-ci-stage3b'
WORKFLOW = '.github/workflows/lineup-integration.yml'
APPROVAL = 'app/scripts/lineups-ci-approval.json'
CHANGED = {'app/scripts/test-lineups-local.py', 'app/scripts/test-lineups-edge-local.py',
           'app/scripts/test-lineups-ui-browser.mjs'}
ADDED = {'app/scripts/lineups_ci.py', 'app/scripts/test_lineups_ci_context.py'}
ROOT_FROZEN = ('.github/workflows/main-pr-checks.yml', '.github/workflows/stabilization-review.yml',
               '.github/CODEOWNERS', 'AGENTS.md', 'vercel.json')
PG_IMAGE = 'postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b'
REST_IMAGE = 'postgrest/postgrest@sha256:5f4ce744539bbba786b4e24dbbd95bdb2a956dcf568c5374995a0ff4a68f5bd2'
AUTH_IMAGE = 'public.ecr.aws/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b'
EDGE_IMAGE = 'public.ecr.aws/supabase/edge-runtime@sha256:ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8'
FORBIDDEN = ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ACCESS_TOKEN',
             'SUPABASE_DB_URL', 'SUPABASE_SERVICE_KEY', 'DATABASE_URL', 'PGRST_DB_URI',
             'PGHOST', 'PGPORT', 'PGDATABASE', 'PGSERVICE', 'PGSERVICEFILE', 'PGPASSWORD',
             'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'PYTHONPATH', 'PYTHONHOME', 'PYTHONOPTIMIZE')


def require(value, message):
    if not value:
        raise RuntimeError(message)


def requested():
    return os.environ.get('GITHUB_ACTIONS') == 'true'


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.DEVNULL)


def sha(value):
    require(isinstance(value, str) and re.fullmatch('[0-9a-f]{40}', value), 'Full commit SHA required')
    return value


def validate_event(env, event, head, parents):
    """Pure validation; tests supply metadata without altering process env."""
    require(env.get('GITHUB_ACTIONS') == 'true', 'Genuine GitHub CI context required')
    require(env.get('RUNNER_ENVIRONMENT') == 'github-hosted' and env.get('RUNNER_OS') == 'Linux'
            and env.get('RUNNER_ARCH') == 'X64', 'Ephemeral hosted Linux/X64 runner required')
    require(env.get('GITHUB_REPOSITORY') == REPO and event.get('repository', {}).get('full_name') == REPO,
            'Wrong repository')
    require(env.get('SLM_FREE_CI_ENABLED') == 'true' and env.get('SLM_INTEGRATION_CI_ENABLED') == 'true',
            'Owner quota and isolated-fixture opt-ins required')
    require(not any(env.get(key) for key in FORBIDDEN), 'Unexpected database/credential/remote Docker configuration')
    for key in ('GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT'):
        require(re.fullmatch('[1-9][0-9]*', env.get(key, '')), 'Invalid CI run identity')
    require(sha(env.get('GITHUB_SHA')) == sha(head), 'Checkout SHA differs from GitHub SHA')
    kind = env.get('GITHUB_EVENT_NAME')
    if kind == 'pull_request':
        pr = event.get('pull_request', {})
        number = event.get('number')
        require(isinstance(number, int) and not isinstance(number, bool) and number > 0, 'Invalid PR number')
        require(env.get('GITHUB_REF') == f'refs/pull/{number}/merge', 'PR merge ref required')
        base, source = pr.get('base', {}), pr.get('head', {})
        require(base.get('ref') == 'main' and env.get('GITHUB_BASE_REF') == 'main', 'PR base must be main')
        require(base.get('repo', {}).get('full_name') == REPO and source.get('repo', {}).get('full_name') == REPO,
                'Cross-repository/fork PR is not authorized for fixtures')
        require(source.get('ref') == env.get('GITHUB_HEAD_REF') and source.get('ref'), 'PR head ref mismatch')
        require(parents == [sha(base.get('sha')), sha(source.get('sha'))], 'Merge parents differ from PR metadata')
        return source['sha']
    require(kind == 'workflow_dispatch', 'Only pull_request or workflow_dispatch is allowed')
    ref = env.get('GITHUB_REF', '')
    require(ref in ('refs/heads/main', 'refs/heads/' + BRANCH), 'Unapproved manual ref')
    require(event.get('ref') in (ref, ref.removeprefix('refs/heads/')), 'Manual event ref mismatch')
    inputs = event.get('inputs', {})
    require(all(value is True or value == 'true' for value in
                (inputs.get('confirm_free_allowance'), inputs.get('confirm_fixture_migrations'))),
            'Both manual confirmations required')
    return head


def archive(root, ref):
    payload = git(root, 'archive', '--format=tar', ref, 'app')
    with tarfile.open(fileobj=io.BytesIO(payload)) as tar:
        files = {}
        for item in tar:
            if item.isdir():
                continue
            require(item.isfile(), 'Symlink/nonregular approved source')
            files[item.name] = tar.extractfile(item).read()
        return files


def verify_sources(root=ROOT, base=BASE):
    pointer = root / APPROVAL
    require(pointer.is_file() and not pointer.is_symlink(), 'Missing regular CI approval pointer')
    approval = json.loads(pointer.read_text(encoding='utf-8'))
    require(set(approval) == {'base', 'implementation'} and approval['base'] == base, 'Invalid CI approval scope')
    implementation = sha(approval['implementation'])
    for ref in (base, implementation):
        require(subprocess.run(['git', '-C', str(root), 'merge-base', '--is-ancestor', ref, 'HEAD'],
                               capture_output=True).returncode == 0, 'Approved history missing')
    baseline, approved = archive(root, base), archive(root, implementation)
    # The pointer is metadata, not executable input. A later reviewed launch
    # implementation may already contain the prior pointer; never compare a
    # pointer to itself or require a self-referential commit SHA.
    approved.pop(APPROVAL, None)
    require(set(approved) == set(baseline) | ADDED, 'Implementation app file set changed')
    for name, data in baseline.items():
        if name not in CHANGED:
            require(approved.get(name) == data, 'Frozen application/backend source changed: ' + name)
    migrations = {p for p in approved if p.startswith('app/supabase/migrations/') and p.endswith('.sql')}
    require(len(migrations) == 41, 'Exact 41 migrations required')
    for name, data in approved.items():
        path = root / name
        require(path.is_file() and not path.is_symlink() and path.read_bytes() == data,
                'Unapproved checkout source: ' + name)
    require(not git(root, 'ls-files', '--others', '--exclude-standard', '--', 'app').strip(),
            'Untracked application inputs are not allowed')
    tracked = set(git(root, 'ls-files', '-z', '--', 'app').decode().strip('\0').split('\0'))
    require(tracked == set(approved) | {APPROVAL}, 'Checkout app file set differs from approval')
    # Include ignored files under actual source trees: functions are recursively
    # copied by the fixture, so .gitignore must not hide extra executable input.
    for directory in ('app/src', 'app/supabase', 'app/scripts'):
        for path in (root / directory).rglob('*'):
            if path.is_file() or path.is_symlink():
                name = path.relative_to(root).as_posix()
                require(not path.is_symlink() and (name in approved or name == APPROVAL),
                        'Unexpected physical source: ' + name)
    for name in ROOT_FROZEN:
        path = root / name
        require(path.is_file() and not path.is_symlink() and path.read_bytes() == git(root, 'show', base + ':' + name),
                'Existing workflow/instructions/deployment policy changed: ' + name)
    workflow = root / WORKFLOW
    require(workflow.is_file() and not workflow.is_symlink()
            and workflow.read_bytes() == git(root, 'show', implementation + ':' + WORKFLOW),
            'Integration workflow differs from approved implementation')
    return implementation


def validate_docker(env, context, container_ids):
    require(not env.get('DOCKER_CONTEXT') or env['DOCKER_CONTEXT'] == 'default', 'Default local Docker context required')
    host = env.get('DOCKER_HOST') or context
    require(host in ('unix:///var/run/docker.sock', 'unix:///run/docker.sock')
            and context in ('unix:///var/run/docker.sock', 'unix:///run/docker.sock'), 'Local Docker socket required')
    require(not container_ids.strip(), 'Fresh ephemeral Docker daemon required; existing containers found')


def owner(suite):
    require(suite in ('sql', 'ui', 'edge'), 'Unknown fixture suite')
    run, attempt = os.environ.get('GITHUB_RUN_ID', ''), os.environ.get('GITHUB_RUN_ATTEMPT', '')
    require(re.fullmatch('[1-9][0-9]*', run) and re.fullmatch('[1-9][0-9]*', attempt), 'Invalid CI run identity')
    return 'slm-stage3b-' + run + '-' + attempt + '-' + suite


def validate_resources(cpus, disk, memory_kib):
    require(cpus >= 2 and disk >= 8 * 1024**3 and memory_kib >= 6 * 1024**2,
            'Runner requires 2 CPUs, 8 GiB free disk and 6 GiB RAM; no paid fallback')


def validate_paths(env, root):
    require(Path(env.get('GITHUB_WORKSPACE', '')).resolve() == root.resolve(), 'Checkout workspace mismatch')
    temp = Path(env.get('RUNNER_TEMP', ''))
    require(temp.is_dir() and not temp.is_symlink() and not temp.resolve().is_relative_to(root.resolve()),
            'Runner temp must be an existing directory outside application sources')


def docker(*args):
    # Never echo Docker argv/stderr: generated fixture credentials may be there.
    result = subprocess.run(['docker', *args], capture_output=True, timeout=180)
    require(result.returncode == 0, 'Local Docker operation failed: ' + args[0])
    return result.stdout


def context(suite):
    require(sys.flags.optimize == 0, 'Assertions must remain enabled')
    require(os.environ.get('SLM_CI_SUITE') == suite, 'Suite differs from job metadata')
    event_path = Path(os.environ.get('GITHUB_EVENT_PATH', ''))
    require(event_path.is_file() and not event_path.is_symlink() and event_path.stat().st_size <= 8 * 1024 * 1024,
            'Invalid GitHub event file')
    event = json.loads(event_path.read_text(encoding='utf-8'))
    head = git(ROOT, 'rev-parse', 'HEAD').decode().strip()
    parents = git(ROOT, 'show', '-s', '--format=%P', 'HEAD').decode().split()
    source = validate_event(os.environ, event, head, parents)
    validate_paths(os.environ, ROOT)
    require(subprocess.run(['git', '-C', str(ROOT), 'merge-base', '--is-ancestor', BASE, source],
                           capture_output=True).returncode == 0, 'PR head must retain Stage 3A ancestry')
    verify_sources()
    endpoint = docker('context', 'inspect', '--format', '{{.Endpoints.docker.Host}}').decode().strip()
    validate_docker(os.environ, endpoint, '')
    validate_docker(os.environ, endpoint, docker('ps', '-aq').decode())
    memory = Path('/proc/meminfo').read_text()
    validate_resources(os.cpu_count() or 0, shutil.disk_usage(ROOT).free,
                       int(re.search(r'MemTotal:\s+(\d+)', memory).group(1)))
    print('PASS CI preflight: exact commit/event, approved app/backend/41 migrations, isolated empty local Docker', flush=True)


def options(suite, image):
    memory = '1536m' if image == EDGE_IMAGE else '1g' if image == PG_IMAGE else '512m' if image == AUTH_IMAGE else '256m'
    return ['--label', 'slm.ci.owner=' + owner(suite), '--restart=no', '--cpus=2', '--memory=' + memory, '--pids-limit=512']


def cleanup(suite):
    """Stop only this run's labelled fixtures; never prune/remove/reset any DB."""
    require(requested() and os.environ.get('RUNNER_ENVIRONMENT') == 'github-hosted'
            and os.environ.get('GITHUB_REPOSITORY') == REPO, 'Hosted CI required for cleanup')
    label = owner(suite)
    endpoint = docker('context', 'inspect', '--format', '{{.Endpoints.docker.Host}}').decode().strip()
    validate_docker(os.environ, endpoint, '')
    stop_owned(label, docker)
    print('CI cleanup: stopped only owned fixtures; ephemeral runner retains them until disposal', flush=True)


def stop_owned(label, execute):
    ids = execute('ps', '-aq', '--filter', 'label=slm.ci.owner=' + label).decode().split()
    # Verify the complete selection before stopping anything.
    for cid in ids:
        require(re.fullmatch('[0-9a-f]{12,64}', cid), 'Invalid owned container ID')
        actual = execute('inspect', '--format', '{{index .Config.Labels "slm.ci.owner"}}', cid).decode().strip()
        require(actual == label, 'Container ownership mismatch')
    for cid in ids:
        execute('stop', '--time', '5', cid)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('verify', 'prepare-images', 'cleanup'))
    parser.add_argument('--suite', required=True, choices=('sql', 'ui', 'edge'))
    args = parser.parse_args()
    if args.action == 'cleanup':
        cleanup(args.suite)
        return
    context(args.suite)
    if args.action == 'prepare-images':
        images = [PG_IMAGE, REST_IMAGE] if args.suite == 'sql' else [PG_IMAGE, REST_IMAGE, AUTH_IMAGE, EDGE_IMAGE]
        for image in images:
            docker('pull', image)
        print('PASS pinned fixture images available; no database created', flush=True)


if __name__ == '__main__':
    main()
