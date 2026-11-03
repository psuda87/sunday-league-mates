"""Run inside a NEW offline Linux tool container on an ordinary Git bundle clone.
Never fabricates GitHub metadata or starts a database/CI integration fixture.
"""
from pathlib import Path
import json
import os
import subprocess
import sys

sys.path.insert(0,str(Path('app/scripts').resolve()))
import lineups_ci as ci

assert not ci.requested() and not os.environ.get('GITHUB_SHA')
print('LOCAL LINUX ONLY; GitHub-hosted NOT RUN; no GitHub context supplied',flush=True)
subprocess.run([sys.executable,'-B','-m','unittest','discover','-s','app/scripts','-p','test_lineups_ci_context.py','-v'],check=True)
implementation=ci.verify_sources()
print('PASS actual checkout verify_sources; implementation='+implementation,flush=True)
targets=['app/supabase/migrations/20261028204500_restore_pr16_match_name_projection.sql','app/supabase/functions/accounts/handler.ts','app/src/auth/sessionManager.ts',
         'app/src/finance/PremiumFinance.tsx','app/src/events/usePremiumLineup.ts',
         'app/src/events/PremiumEvents.tsx','app/src/ui/UltimatePlayerCard.tsx',
         'app/scripts/lineups_ci.py','app/scripts/test_lineups_ci_context.py']
for name in targets:
    p=Path(name);original=p.read_bytes()
    try:
        p.write_bytes(original+b'\n// unauthorized source mutation\n')
        try:ci.verify_sources()
        except RuntimeError:print('PASS actual source guard rejects '+name,flush=True)
        else:raise AssertionError('Source guard accepted '+name)
    finally:p.write_bytes(original)
extra=Path('app/supabase/migrations/99999999999999_unapproved43.sql')
try:
    extra.write_text('select 1;')
    try:ci.verify_sources()
    except RuntimeError:print('PASS actual source guard rejects unapproved43',flush=True)
    else:raise AssertionError('Source guard accepted migration43')
finally:extra.unlink()
ci.verify_sources()
print(json.dumps({'local_linux':'PASS','hosted_github':'NOT RUN','synthetic_tests':26,'actual_source_denials':10,
                  'checkout':ci.git(ci.ROOT,'rev-parse','HEAD').decode().strip(),'implementation':implementation}),flush=True)
