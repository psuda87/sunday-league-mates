"""Independent INACTIVE CI proposal test using the full verify_sources path.

A new temporary local Git clone is a test fixture, not a working branch/worktree
of the project. Its synthetic implementation/approval commits authorize nothing
outside that fixture. No GitHub metadata is spoofed; no Docker or CI is launched.
The original 23 launch-contract tests are run separately against the active gate.
"""
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PATCH = Path(__file__).with_name('public-discovery-ci-proposed.patch')
SOURCE = '43f69a62c85dd354695f6fcb4531c85fb03651cf'
passed = 0


def command(root, *args):
    return subprocess.check_output(['git', '-c', 'user.name=Review fixture', '-c',
                                    'user.email=fixture@example.invalid', '-C', str(root), *args],
                                   stderr=subprocess.PIPE).decode().strip()


def check(ok, label):
    global passed
    if not ok:
        raise AssertionError(label)
    passed += 1
    print('PASS ' + label, flush=True)


with tempfile.TemporaryDirectory(prefix='slm-discovery-full-gate-') as folder:
    root = Path(folder) / 'fixture'
    subprocess.run(['git', 'clone', '--quiet', '--shared', '--no-checkout', str(ROOT), str(root)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    command(root, 'config', 'core.autocrlf', 'false')
    command(root, 'checkout', '--quiet', '--detach', SOURCE)
    command(root, 'apply', str(PATCH))
    command(root, 'add', 'app/scripts/lineups_ci.py', 'app/scripts/test-lineups-local.py', 'app/scripts/test-lineups-edge-local.py', 'app/scripts/test_lineups_ci_context.py')
    command(root, 'commit', '--quiet', '-m', 'SYNTHETIC fixture CI implementation, no deployment')
    implementation = command(root, 'rev-parse', 'HEAD')
    scope = {'__name__': 'independent_inactive_gate', '__file__': str(root / 'app/scripts/lineups_ci.py')}
    exec(compile((root / 'app/scripts/lineups_ci.py').read_text(), 'inactive_full_gate', 'exec'), scope)

    def no_docker(*args, **kwargs):
        raise AssertionError('Docker must never be called in source-contract tests')
    scope['docker'] = no_docker
    pointer = root / scope['APPROVAL']

    def point(sha):
        pointer.write_text(json.dumps({'base': scope['BASE'], 'implementation': sha}) + '\n')

    def verify():
        return scope['verify_sources'](root)

    def denied(label, expected):
        try:
            verify()
        except RuntimeError as error:
            check(expected in str(error), label + ': ' + str(error))
        else:
            raise AssertionError('Unsafe proposal acceptance: ' + label)

    denied('old pointer cannot activate the proposed overlay', 'ancestry missing')
    point(implementation)
    check(verify() == implementation, 'complete proposed verify_sources accepts exact synthetic fixture')

    paths = scope['DISCOVERY_OVERLAY'] | {
        'app/scripts/lineups_ci.py', 'app/scripts/test_lineups_ci_context.py', 'app/src/auth/sessionManager.ts',
        'app/src/finance/PremiumFinance.tsx', 'app/src/events/PremiumTeams.tsx',
        'app/src/ui/UltimatePlayerCard.tsx', 'app/src/demo/DemoBottomNav.tsx',
        'app/scripts/premium318-contract.json',
        'app/supabase/migrations/20261013185250_slm_auth_proof_setup.sql',
    }
    for name in sorted(paths):
        path = root / name
        before = path.read_bytes()
        try:
            path.write_bytes(before + b'\n// unapproved test mutation\n')
            denied('checkout tampering rejected ' + name, 'Unapproved checkout source')
        finally:
            path.write_bytes(before)

    for name in ('app/supabase/migrations/99999999999999_extra.sql', 'app/src/extra.ts',
                 'app/supabase/functions/ignored-extra.ts'):
        path = root / name
        path.write_text('unapproved input\n')
        ignored = '/functions/' in name
        if ignored:
            (root / '.git/info/exclude').write_text(name + '\n')
        else:
            command(root, 'add', name)
        try:
            denied('extra input rejected ' + name, 'Unexpected physical source' if ignored else 'file set differs')
        finally:
            if not ignored:
                command(root, 'rm', '--cached', '--quiet', name)
            path.unlink()
            if ignored:
                (root / '.git/info/exclude').write_text('')

    path = root / 'app/src/events/PremiumEvents.tsx'
    before = path.read_bytes()
    path.unlink()
    try:
        path.symlink_to('usePremiumEvents.ts')
        denied('symlink in approved runtime rejected', 'Unapproved checkout source')
    finally:
        path.unlink()
        path.write_bytes(before)

    for name in ('.github/workflows/main-pr-checks.yml', scope['WORKFLOW']):
        path = root / name
        before = path.read_bytes()
        try:
            path.write_bytes(before + b'\n# unauthorized workflow change\n')
            denied('workflow change rejected ' + name, 'policy changed' if 'main-pr' in name else 'workflow differs')
        finally:
            path.write_bytes(before)

    # Updating the pointer alone cannot bless a changed backend, even when that
    # malicious implementation is a real descendant commit with correct ancestry.
    for name in ('app/supabase/functions/accounts/handler.ts', 'app/scripts/test-lineups-edge-local.py',
                 'app/scripts/test_lineups_ci_context.py'):
        path = root / name
        before = path.read_bytes()
        path.write_bytes(before + b'\n// unauthorized committed input mutation\n')
        command(root, 'add', str(path.relative_to(root)))
        command(root, 'commit', '--quiet', '-m', 'SYNTHETIC malicious implementation negative fixture')
        point(command(root, 'rev-parse', 'HEAD'))
        denied('new pointer cannot self-approve ' + name, 'Unreviewed discovery overlay source')
        path.write_bytes(before)
        command(root, 'add', str(path.relative_to(root)))
        command(root, 'commit', '--quiet', '-m', 'Restore synthetic fixture input')
    point(implementation)
    check(verify() == implementation, 'exact original fixture still passes after negative tests')

    # Exercise the workflow's actual test command against the proposed gate and
    # the exact, source-pinned fixture adaptation. All original 23 cases remain.
    result = subprocess.run(['python3', '-B', '-m', 'unittest', 'discover', '-s', 'app/scripts',
                             '-p', 'test_lineups_ci_context.py', '-v'], cwd=root,
                            capture_output=True, text=True)
    if result.returncode:
        raise AssertionError(result.stderr)
    check('Ran 23 tests' in result.stderr and 'OK' in result.stderr, 'all23 proposed workflow launch-contract tests pass')
    print('Legacy tests against corrected proposal:\n' + '\n'.join(result.stderr.splitlines()[-4:]), flush=True)

print(f'RESULT {passed} PASS independent source/proposal checks; plus23 proposed workflow tests; no hosted CI launch.')
print('Active checkout, approval JSON, workflows, GitHub variables and Docker were never changed.')
