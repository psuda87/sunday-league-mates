"""Readiness ONLY: exact new local project, schema/empty checks and fresh restore drill.
Never connects to Cloud, resets an existing DB, or prints keys/account identifiers.
"""
import hashlib,json,os,re,subprocess,uuid
from pathlib import Path
project='slm-online-readiness';container='supabase_db_'+project
assert subprocess.check_output(['git','branch','--show-current'],text=True).strip()=='feat/account-model-foundation'
host=os.environ.get('DOCKER_HOST') or subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip();assert host.startswith(('npipe://','unix://'))
c=json.loads(subprocess.check_output(['docker','inspect',container]))[0];assert c['Config']['Labels']['com.supabase.cli.project']==project
passed=0

def check(ok,label):
 global passed
 assert ok,label;passed+=1;print('PASS '+label)
def sql(q,db='postgres'):
 r=subprocess.run(['docker','exec','-i',container,'psql','-X','-At','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q.encode(),capture_output=True)
 if r.returncode:raise RuntimeError('Local SQL diagnostic failed: '+r.stderr.decode()[:500])
 return r.stdout.decode().strip()
def rows(db='postgres'):
 names=sql("select tablename from pg_tables where schemaname='public' and tablename like 'slm_%' order by tablename",db).splitlines()
 return {name:int(sql('select count(*) from public."'+name+'"',db)) for name in names}
counts=rows();check(int(sql('select count(*) from auth.users'))==0,'new project has zero Auth users before fixtures')
check(all(n==0 for name,n in counts.items() if name!='slm_account_model_state'),'zero profiles/groups/matches/guests/ratings/finance/demo rows')
check(sql('select active from public.slm_account_model_state')=='f','candidate inactive after migration replay')
check(sql('select count(*) from supabase_migrations.schema_migrations')=='44','all44 versioned migrations present')
check(sql("select count(*) from pg_tables where schemaname='public' and tablename like 'slm_%' and not rowsecurity")=='0','every SLM public table has RLS')
check(sql("select count(*) from pg_tables where schemaname='public' and tablename like 'slm_%' and has_table_privilege('anon',format('%I.%I',schemaname,tablename),'select,insert,update,delete')")=='0','anonymous role has no direct SLM table access')
check(sql("select count(*) from storage.buckets where public")=='0','no public Storage buckets')
check(sql("select count(*) from storage.objects")=='0','Storage contains zero objects')
check(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','slm_private','slm_auth_proof_private') and p.prosecdef and p.proname like 'slm_%' and not exists(select 1 from unnest(p.proconfig) x where x like 'search_path=%')")=='0','security definers declare search_path')
# Save only schema/permission metadata and counts, no row content or UUIDs.
inventory={'project':project,'counts':counts,'buckets':json.loads(sql("select coalesce(json_agg(json_build_object('bucket',id,'public',public)),'[]') from storage.buckets"))}
Path('.cache/readiness-security-inventory.json').write_text(json.dumps(inventory,indent=2),encoding='utf8')
backup=subprocess.run(['docker','exec',container,'pg_dump','-U','postgres','-d','postgres','--format=custom'],capture_output=True);assert backup.returncode==0
Path('.cache/readiness-clean.dump').write_bytes(backup.stdout);check(len(backup.stdout)>1000,'local empty-state backup generated without exposing its contents')
name='slm_restore_'+uuid.uuid4().hex;assert re.fullmatch('slm_restore_[a-f0-9]{32}',name);created=False
try:
 subprocess.run(['docker','exec',container,'createdb','-U','postgres','-T','template0',name],check=True,capture_output=True);created=True
 r=subprocess.run(['docker','exec','-i',container,'pg_restore','-U','supabase_admin','-d',name,'--exit-on-error'],input=backup.stdout,capture_output=True)
 if r.returncode:raise RuntimeError('Fresh local restore failed: '+r.stderr.decode()[:600])
 check(rows(name)==counts and sql('select count(*) from auth.users',name)=='0','restore preserves all empty business tables')
 check(sql("select count(*) from pg_tables where schemaname='public' and tablename like 'slm_%' and not rowsecurity",name)=='0','restore preserves RLS')
 check(sql("select has_function_privilege('authenticated','public.slm_signup_admit(uuid,text,text)','execute')",name)=='f','restore preserves private RPC permissions')
 check(sql('select active from public.slm_account_model_state',name)=='f','restore never activates Auth')
 print('PREFLIGHT/RESTORE '+str(passed)+' PASS; SHA256 '+hashlib.sha256(backup.stdout).hexdigest()+'; Cloud NOT CONTACTED')
finally:
 if created:subprocess.run(['docker','exec',container,'dropdb','-U','postgres',name],check=True,capture_output=True)
