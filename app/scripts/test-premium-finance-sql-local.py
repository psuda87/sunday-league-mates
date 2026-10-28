"""Stage2: run the existing v2 financial scenarios on a NEW retained PostgreSQL fixture.
Auth/Storage are schema contracts, not GoTrue/Edge. No DB reset/drop and no Cloud.
"""
import os,subprocess,time,uuid
from pathlib import Path
root=Path(__file__).resolve().parents[2]
assert subprocess.check_output(['git','branch','--show-current'],cwd=root,text=True).strip()=='feat/premium-real-finance-stage2'
host=os.environ.get('DOCKER_HOST') or subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
assert host.startswith(('unix://','npipe://'))
container='slm-finance-sql-'+uuid.uuid4().hex[:12]
subprocess.run(['docker','run','--detach','--name',container,'--network','none','--label','slm.fixture=premium-finance-stage2','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'],check=True,stdout=subprocess.DEVNULL)
print('Retained fixture container: '+container,flush=True)
for _ in range(100):
    logs=subprocess.run(['docker','logs',container],capture_output=True,text=True)
    ready=subprocess.run(['docker','exec',container,'pg_isready','-U','postgres'],capture_output=True)
    if ready.returncode==0 and 'init process complete' in logs.stdout:break
    time.sleep(.25)
else:raise RuntimeError('Fixture PostgreSQL unavailable; nothing removed')
# Keep the original test functions/scenarios; replace ONLY the environment setup/cleanup.
original=Path(__file__).with_name('test-v2-local.py')
source=original.read_text(encoding='utf8')
prefix=source[:source.index('try:\n    branch =')].replace('DB = "slm_backend_test_" + uuid.uuid4().hex','DB = "postgres"')
scenario=source[source.index('    for file in ("settlements.sql"'):source.index('\nfinally:')]
namespace={'__file__':str(original),'__name__':'stage2_finance_fixture'}
exec(compile(prefix,str(original),'exec'),namespace)
namespace['CONTAINER']=container;namespace['READINESS']=True
sql=namespace['sql'];check=namespace['check']
sql((root/'app/supabase/tests/support/profile_contract_bootstrap.sql').read_text(encoding='utf8'))
sql("alter table auth.users add column aud text,add column role text,add column raw_user_meta_data jsonb default '{}'::jsonb,add column deleted_at timestamptz,add column raw_app_meta_data jsonb default '{}'::jsonb;")
files=sorted((root/'app/supabase/migrations').glob('*.sql'))
for migration in files:sql(migration.read_text(encoding='utf8'))
check(len(files)==44,'44 unchanged source migrations replayed in fresh fixture')
exec(compile('if True:\n'+scenario,str(original),'exec'),namespace)
print('Auth UID/JWT/storage are fixture contracts; real HTTP/Auth/Edge NOT tested. Database retained, not reset or deleted.')
