"""NEW network-none PostgreSQL reference: compare Cloud7 metadata, replay42 with synthetic legacy rows.
Never connects to Cloud or any existing database; no GoTrue/Storage service claim.
"""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import time
import uuid

ROOT=Path(__file__).resolve().parents[2]
BASE='e246c514af0fbca79dee892d9aa0e31b937a83c3'
IMAGE='postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b'
NAME='slm-rc-reference-'+uuid.uuid4().hex[:12]
def command(args,data=None):
    p=subprocess.run(args,input=data,capture_output=True,timeout=120)
    if p.returncode:raise RuntimeError('Reference operation failed: '+args[0]+' '+args[1]+': '+p.stderr.decode(errors='replace')[-500:])
    return p.stdout
def sql(value):return command(['docker','exec','-i',NAME,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],value.encode()).decode().strip()
def snapshot():
    return json.loads(sql("""select jsonb_build_object(
    'objects',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'acl',c.relacl::text) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'slm_%'),
    'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'definition_md5',md5(pg_get_functiondef(p.oid))) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and ((n.nspname='public' and p.proname like 'slm_%') or n.nspname='slm_private')),
    'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'signature',md5((select jsonb_agg(jsonb_build_object('column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)::text from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped))) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'slm_%'),
    'policy_signatures',(select jsonb_agg(jsonb_build_object('table',tablename,'policy',policyname,'signature',md5(coalesce(qual,'')||'|'||coalesce(with_check,''))) order by tablename,policyname) from pg_policies where schemaname='public' and tablename like 'slm_%'))"""))
def legacy_fingerprint():
    return sql("select md5(jsonb_build_object('aliases',(select jsonb_agg(to_jsonb(t)) from public.slm_aliases t),'events',(select jsonb_agg(jsonb_build_object('id',id,'starts_at',starts_at,'location',location,'capacity',capacity,'created_by',created_by,'total_cost',total_cost,'status',status)) from public.slm_events),'entries',(select jsonb_agg(jsonb_build_object('id',id,'event',event_id,'member',member_id,'owner',responsible_user_id,'status',status)) from public.slm_event_participants))::text)")

assert command(['git','branch','--show-current']).decode().strip()=='feat/slm-v1-release-candidate'
assert subprocess.run(['git','merge-base','--is-ancestor',BASE,'HEAD'],capture_output=True).returncode==0
assert os.environ.get('GITHUB_ACTIONS')!='true'
for key in ('SUPABASE_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_SERVICE_ROLE_KEY','DATABASE_URL','PGHOST'):assert not os.environ.get(key),'External configuration refused'
endpoint=command(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}']).decode().strip()
assert endpoint.startswith(('npipe://','unix://')) and (not os.environ.get('DOCKER_HOST') or os.environ['DOCKER_HOST'].startswith(('npipe://','unix://')))
files=sorted((ROOT/'app/supabase/migrations').glob('*.sql'))
expected=command(['git','ls-tree','-r','--name-only',BASE,'--','app/supabase/migrations']).decode().splitlines()
assert len(files)==42 and [p.relative_to(ROOT).as_posix() for p in files]==expected
for p in files:assert p.read_bytes().replace(b'\r\n',b'\n')==command(['git','show',BASE+':'+p.relative_to(ROOT).as_posix()]).replace(b'\r\n',b'\n')
cloud=json.loads((ROOT/'docs/review/rc-cloud-metadata.json').read_text())
assert [p.name.split('_')[0] for p in files[:7]]==[h['version'] for h in cloud['history']]
started=False
try:
    command(['docker','image','inspect',IMAGE])
    command(['docker','run','--detach','--pull=never','--name',NAME,'--network','none','--label','slm.fixture=release-candidate-schema','--memory','1g','--cpus','2','--pids-limit','512','-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE]);started=True
    for _ in range(100):
        ready=subprocess.run(['docker','exec',NAME,'pg_isready','-U','postgres'],capture_output=True)
        if ready.returncode==0 and b'init process complete' in command(['docker','logs',NAME]):break
        time.sleep(.2)
    else:raise RuntimeError('Reference PostgreSQL not ready')
    sql((ROOT/'app/supabase/tests/support/profile_contract_bootstrap.sql').read_text())
    sql("alter table auth.users add column aud text,add column role text,add column raw_user_meta_data jsonb default '{}'::jsonb,add column deleted_at timestamptz,add column raw_app_meta_data jsonb default '{}'::jsonb;")
    for p in files[:7]:sql(p.read_text())
    seven=snapshot()
    user,event,entry=[str(uuid.uuid4()) for _ in range(3)]
    sql(f"insert into auth.users(id,email) values('{user}','rc-fixture@fixture.invalid');select public.slm_account_provision('{user}','RCFixture','+48910000001','rc-fixture@fixture.invalid',null,null,true);insert into public.slm_events(id,starts_at,location,capacity,created_by,total_cost,hourly_rate) values('{event}','2099-01-01T18:00:00Z','Synthetic RC legacy pitch',10,'{user}',0,0);insert into public.slm_event_participants(id,event_id,member_id,responsible_user_id,status) values('{entry}','{event}','{user}','{user}','registered');")
    before=legacy_fingerprint()
    for p in files[7:]:sql(p.read_text())
    final=snapshot();assert legacy_fingerprint()==before
    assert all(t['rls'] for t in final['objects'])
    assert sql("select has_function_privilege('anon','slm_private.match_discovery_list(uuid,uuid,jsonb)','execute') or has_function_privilege('authenticated','slm_private.match_discovery_list(uuid,uuid,jsonb)','execute')")=='f'
    assert sql("select count(*) from public.slm_groups g join public.slm_group_members m on m.group_id=g.id where g.admin_id=m.user_id")=='1'
    def compare(key,identity):
        local={tuple(v[k] for k in identity):v for v in seven[key]};remote={tuple(v[k] for k in identity):v for v in cloud[key]}
        field='definition_md5' if key=='functions' else 'signature'
        return [{'object':list(k),'cloud':remote.get(k,{}).get(field),'canonical7':local.get(k,{}).get(field)} for k in sorted(set(local)|set(remote)) if local.get(k,{}).get(field)!=remote.get(k,{}).get(field)]
    result={'fixture':NAME,'source':BASE,'migrations_replayed':42,'cloud_history_prefix_versions_match':True,
      'history_statement_differences':[p.name for p,h in zip(files[:7],cloud['history']) if hashlib.md5(p.read_bytes().replace(b'\r\n',b'\n')).hexdigest()!=h['statements_md5']],
      'canonical7_function_drift':compare('functions',('schema','name','args')),'canonical7_column_drift':compare('columns',('table',)),
      'canonical7_policy_drift':compare('policy_signatures',('table','policy')),'synthetic_legacy_rows_preserved':True,
      'unambiguous_legacy_owner_mapping_pass':True,'public_tables':len(final['objects']),'public_tables_rls_enabled':True,
      'discovery_direct_client_execute_denied':True,'reference_is_cloud_data_restore':False,'real_gotrue_storage_http_tested':False,
      'candidate_missing_cloud_tables':sorted(set(t['name'] for t in final['objects'])-set(t['name'] for t in cloud['objects']))}
    (ROOT/'docs/review/rc-schema-comparison.json').write_text(json.dumps(result,indent=2)+'\n')
    print('PASS canonical42 replay, synthetic populated7->42, legacy preservation/mapping/RLS/ACL; no existing database touched',flush=True)
    print(json.dumps({k:result[k] for k in ('fixture','history_statement_differences','canonical7_function_drift','canonical7_column_drift','canonical7_policy_drift')}),flush=True)
finally:
    if started:subprocess.run(['docker','stop','--timeout','5',NAME],capture_output=True,timeout=30);print('Stopped and retained NEW reference '+NAME,flush=True)
