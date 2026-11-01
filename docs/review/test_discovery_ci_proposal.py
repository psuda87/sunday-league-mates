"""Verify INACTIVE CI patch in a temporary directory. No CI environment/DB/Actions launch."""
import ast
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[2]
PATCH=ROOT/'docs/review/public-discovery-ci-proposed.patch'
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args])
with tempfile.TemporaryDirectory(prefix='slm-discovery-ci-proposal-') as folder:
    temp=Path(folder)
    for name in ('lineups_ci.py','test-lineups-local.py','test-lineups-edge-local.py','test_lineups_ci_context.py'):
        dest=temp/'app/scripts'/name;dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes((ROOT/'app/scripts'/name).read_bytes().replace(b'\r\n',b'\n'))
    result=subprocess.run(['git','-c','core.autocrlf=false','apply',str(PATCH)],cwd=temp,capture_output=True)
    assert result.returncode==0,result.stderr.decode(errors='replace')
    manifest=json.loads((ROOT/'docs/review/public-discovery-ci-candidate.json').read_text())
    assert hashlib.sha256(PATCH.read_bytes()).hexdigest()==manifest['proposed_patch_sha256']
    for path,digest in manifest['proposed_ci_files_sha256_lf'].items():
        assert hashlib.sha256((temp/path).read_bytes()).hexdigest()==digest,path
    source=(temp/'app/scripts/lineups_ci.py').read_text()
    scope={'__name__':'inactive_ci_proposal','__file__':str(ROOT/'app/scripts/lineups_ci.py')}
    exec(compile(source,'inactive_ci_proposal','exec'),scope)
    original=scope['archive'](ROOT,scope['STAGE3B_IMPLEMENTATION']);original.pop(scope['APPROVAL'],None)
    candidate=scope['archive'](ROOT,scope['DISCOVERY_IMPLEMENTATION']);candidate.pop(scope['APPROVAL'],None)
    approved=dict(candidate)
    for name in ('test-lineups-local.py','test-lineups-edge-local.py'):
        path='app/scripts/'+name
        approved[path]=approved[path].replace(b'42 if not CI_MODE and branch',b'42 if CI_MODE or branch')
        assert approved[path].replace(b'\r\n',b'\n')==(temp/path).read_bytes()
    path='app/scripts/test_lineups_ci_context.py'
    approved[path]=scope['expected_source_tests'](approved[path])
    assert approved[path].replace(b'\r\n',b'\n')==(temp/path).read_bytes()
    def cases(text):
        return sorted(n.name for n in ast.walk(ast.parse(text)) if isinstance(n,ast.FunctionDef) and n.name.startswith('test_'))
    assert cases(candidate[path].decode())==cases(approved[path].decode())
    assert len(cases(approved[path].decode()))==23
    scope['verify_discovery_overlay'](ROOT,original,approved)
    passed=1
    # Tamper every explicitly pinned delta, plus unchanged Auth/finance/history.
    paths=scope['DISCOVERY_OVERLAY']|{'app/scripts/test_lineups_ci_context.py','app/src/auth/sessionManager.ts','app/src/finance/PremiumFinance.tsx',
        'app/supabase/migrations/20261013185250_slm_auth_proof_setup.sql'}
    for path in paths:
        bad=dict(approved);bad[path]=bad.get(path,b'')+b'\n// unauthorized modification\n'
        try:scope['verify_discovery_overlay'](ROOT,original,bad)
        except RuntimeError:passed+=1
        else:raise AssertionError('Unexpected approval: '+path)
    for path in ('app/supabase/migrations/99999999999999_extra.sql','app/src/unapproved.ts'):
        bad=dict(approved);bad[path]=b'unapproved'
        try:scope['verify_discovery_overlay'](ROOT,original,bad)
        except RuntimeError:passed+=1
        else:raise AssertionError('Unexpected input accepted')
    old=(ROOT/'app/scripts/lineups_ci.py').read_text()
    def functions(text):return {n.name:ast.get_source_segment(text,n) for n in ast.parse(text).body if isinstance(n,ast.FunctionDef)}
    before,after=functions(old),functions(source)
    for name in ('validate_event','validate_docker','validate_paths','validate_resources','owner','cleanup','stop_owned'):
        assert before[name]==after[name],name+' must remain unchanged';passed+=1
    assert before['context'].replace('approved app/backend/41 migrations','approved app/backend/42 migrations')==after['context'];passed+=1
    assert json.loads((ROOT/'app/scripts/lineups-ci-approval.json').read_text())['implementation']=='6d96391298bbe18c582dc5c6ffda74c7045cfba3'
    assert not git('diff','e04d9a47560de36657da76f12ae63e20ef2299cb','--','.github/workflows/lineup-integration.yml','app/scripts/lineups_ci.py','app/scripts/lineups-ci-approval.json').strip()
    print('PASS inactive CI proposal:',passed,'positive/negative/source-preservation checks; no active gate/approval/workflow change')
