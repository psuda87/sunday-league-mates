"""Offline ordinary-clone source audit; not GitHub CI and never starts a DB.

Run in the existing Linux tools image, mount this script and a Git bundle RO;
all mutations are confined to its disposable /tmp clone, restored in finally.
"""
import os
from pathlib import Path
import subprocess
import sys

assert os.name == 'posix' and not os.environ.get('GITHUB_SHA')
assert not os.environ.get('GITHUB_ACTIONS')
root = Path('/tmp/pr31-source-clone')
assert not root.exists()
subprocess.run(['git', '-c', 'core.autocrlf=false', 'clone', '--quiet',
                '--branch', 'feat/slm-v1-polish-stats', '/evidence/pr31.bundle', str(root)], check=True)
os.chdir(root)
sys.path.insert(0, str(root / 'app/scripts'))
import lineups_ci as ci

assert not ci.requested()
implementation = ci.verify_sources()
print('PASS actual baseline; local Linux only; implementation=' + implementation, flush=True)
targets = sorted(set(ci.git(root, 'ls-files', '--', 'app/supabase/migrations').decode().splitlines()) |
                 ci.POLISH_OVERLAY | {
                     'app/scripts/lineups_ci.py', 'app/scripts/test_lineups_ci_context.py',
                     'app/src/auth/sessionManager.ts', 'app/src/auth/tokenStore.ts',
                     'app/src/finance/PremiumFinance.tsx', 'app/src/events/usePremiumLineup.ts',
                     'app/src/events/PremiumTeams.tsx', 'app/src/events/usePremiumEvents.ts',
                     'app/src/events/premiumContracts.ts', 'app/src/ui/UltimatePlayerCard.tsx',
                     'app/supabase/functions/accounts/handler.ts', ci.WORKFLOW,
                     'app/scripts/premium318-contract.json', 'app/scripts/consolidation-sources.json',
                 })
count = 0
for name in targets:
    path = root / name
    original = path.read_bytes()
    try:
        path.write_bytes(original + b'\n// deliberate unauthorized mutation\n')
        try:
            ci.verify_sources()
        except RuntimeError:
            count += 1
        else:
            raise AssertionError('Guard accepted ' + name)
    finally:
        path.write_bytes(original)

extra = root / 'app/supabase/migrations/99999999999999_unapproved43.sql'
try:
    extra.write_text('select 1;')
    try:
        ci.verify_sources()
    except RuntimeError:
        count += 1
    else:
        raise AssertionError('Guard accepted migration43')
finally:
    extra.unlink()
assert ci.verify_sources() == implementation
assert not ci.git(root, 'status', '--porcelain').strip()
print(f'PASS {count} actual source denials and final clean baseline; hosted NOT RUN', flush=True)
