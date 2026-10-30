"""Strict local-only source preflight for the explicitly authorized Stage2B fixture."""
import os
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[2]
SOURCE='24a59e104bfe80b4d2f41cbd0ad02b58fc546040'
AUDIT='ddd3a3e2eaefdf449bc83c34c6335f42a2da4aab'

def require(ok,message):
    if not ok:raise RuntimeError(message)

def verify():
    require(os.environ.get('GITHUB_ACTIONS')!='true','Separate local discovery fixture; genuine CI contract required')
    require(subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip()=='feat/public-match-discovery-stage2b','Exact Stage2B branch required')
    require(subprocess.run(['git','merge-base','--is-ancestor',AUDIT,'HEAD'],cwd=ROOT,capture_output=True).returncode==0,'Exact audit ancestry required')
    for key in ('SUPABASE_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_SERVICE_ROLE_KEY','DATABASE_URL','PGHOST','PGRST_DB_URI'):
        require(not os.environ.get(key),'External configuration refused')
    names=subprocess.check_output(['git','ls-tree','-r','--name-only',SOURCE,'--','app/supabase/migrations','app/supabase/functions'],cwd=ROOT,text=True).splitlines()
    # All executable backend sources, not merely the handler or migration count.
    expected={name for name in names if not name.endswith('.test.ts')}
    actual={p.relative_to(ROOT).as_posix() for folder in ('app/supabase/functions','app/supabase/migrations') for p in (ROOT/folder).rglob('*') if p.is_file() and not p.name.endswith('.test.ts')}
    require(actual==expected,'Unexpected executable backend input')
    for name in expected:
        p=ROOT/name
        require(not p.is_symlink() and p.read_bytes().replace(b'\r\n',b'\n')==subprocess.check_output(['git','show',SOURCE+':'+name],cwd=ROOT).replace(b'\r\n',b'\n'),'Unreviewed backend input: '+name)
    endpoint=subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
    require(endpoint.startswith(('unix://','npipe://')) and (not os.environ.get('DOCKER_HOST') or os.environ['DOCKER_HOST'].startswith(('unix://','npipe://'))),'Local Docker socket required')
