"""Read-only catalog audit, exact isolated project, no user row contents."""
import json,os,subprocess
from pathlib import Path
assert subprocess.check_output(['git','branch','--show-current'],text=True).strip()=='feat/account-model-foundation'
host=os.environ.get('DOCKER_HOST') or subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip();assert host.startswith(('npipe://','unix://'))
project='slm-online-readiness';container='supabase_db_'+project;c=json.loads(subprocess.check_output(['docker','inspect',container]))[0];assert c['Config']['Labels']['com.supabase.cli.project']==project
query="""select coalesce(json_agg(row_to_json(x)),'[]') from(select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as args,p.prosecdef as definer,p.proconfig as config,has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('slm_private','slm_auth_proof_private') or n.nspname='public' and p.proname like 'slm_%' order by n.nspname,p.proname) x"""
r=subprocess.run(['docker','exec','-i',container,'psql','-X','-At','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=query.encode(),capture_output=True)
if r.returncode:raise RuntimeError('Catalog query failed: '+r.stderr.decode()[:300])
items=json.loads(r.stdout);Path('.cache/readiness-functions.json').write_text(json.dumps(items,indent=2),encoding='utf8')
bad=[x['schema']+'.'+x['name'] for x in items if x['definer'] and not any(s.startswith('search_path=') for s in (x['config'] or []))];public=[x['schema']+'.'+x['name'] for x in items if x['anon'] and x['schema']=='public']
print(json.dumps({'functions':len(items),'definers':sum(x['definer'] for x in items),'unsafe_search_path':bad,'public_anon_execute':public}));assert not bad and not public
