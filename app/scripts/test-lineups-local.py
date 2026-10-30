"""NEW network-isolated PostgreSQL fixture, retained (never reset/dropped).
Real SQL/RLS/concurrent transactions; Auth/JWT schema fixtures, not GoTrue/Edge E2E.
"""
from pathlib import Path
import base64,concurrent.futures,hashlib,hmac,json,os,re,secrets,subprocess,threading,time,uuid
import lineups_ci
ROOT=Path(__file__).resolve().parents[2]
CI_MODE=lineups_ci.requested()
if CI_MODE:
 lineups_ci.context('sql')
else:
 branch=subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip()
 if branch=='feat/public-match-discovery-stage2b':
  import discovery_local
  discovery_local.verify()
 else:assert branch=='feat/premium-lineups-stage2a'
host=os.environ.get('DOCKER_HOST') or subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
assert host.startswith(('unix://','npipe://')), 'Local Docker socket required'
CONTAINER='slm-lineups-stage2a-'+uuid.uuid4().hex[:12]
def start_fixture(name,image,args):
 argv=['run','--detach','--name',name]+(lineups_ci.options('sql',image)+['--pull=never'] if CI_MODE else [])+args+[image]
 if CI_MODE:lineups_ci.docker(*argv)
 else:subprocess.run(['docker']+argv,check=True,stdout=subprocess.DEVNULL)
start_fixture(CONTAINER,lineups_ci.PG_IMAGE if CI_MODE else lineups_ci.PG_IMAGE,['--network','none','--label','slm.fixture=lineups-stage2a','-e','POSTGRES_HOST_AUTH_METHOD=trust'])
print('Retained isolated fixture: '+CONTAINER,flush=True)
passed=0
rest_started=False
REST=CONTAINER+'-rest'
REST_IMAGE='postgrest/postgrest@sha256:5f4ce744539bbba786b4e24dbbd95bdb2a956dcf568c5374995a0ff4a68f5bd2'
JWT_SECRET=secrets.token_hex(32)

def sql(query, expected=None):
 r=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True)
 if expected:
  assert r.returncode and expected in r.stderr,(expected,r.stdout,r.stderr)
  return None
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
def lit(value):return "'"+str(value).replace("'","''")+"'"
def check(ok,label):
 global passed
 assert ok,label
 passed+=1;print('PASS '+label,flush=True)
users=[str(uuid.uuid4()) for _ in range(6)];sessions=[str(uuid.uuid4()) for _ in users]
def rpc(i,prefix,action,body,expected=None):
 r=sql('begin;set local role service_role;select public.slm_'+prefix+'_dispatch('+','.join([lit(users[i]),lit(sessions[i]),lit(action),lit(json.dumps(body))+'::jsonb'])+');commit;',expected)
 return json.loads(r) if r else None
def domain(i,prefix,action,**body):
 if action not in ('get','list','detail','inbox'):body.setdefault('request_id',str(uuid.uuid4()))
 return rpc(i,prefix,action,body)
def get(i=1,event=None):return rpc(i,'lineups','get',dict(event_id=event or match))
def payload(s,a=None,b=None,request=None):return dict(event_id=match,expected_version=s['version'],expected_roster_version=s['roster_version'],team_a=s['team_a'] if a is None else a,team_b=s['team_b'] if b is None else b,request_id=request or str(uuid.uuid4()))
def save(i,body,expected=None):return rpc(i,'lineups','save',body,expected)
def invite(i,group):
 domain(0,'groups','invite',group_id=group,user_id=users[i]);inbox=domain(i,'groups','inbox')['requests'];domain(i,'groups','decide',id=inbox[0]['id'],accept=True)
def parallel(jobs):
 barrier=threading.Barrier(len(jobs))
 def work(job):
  barrier.wait()
  try:return ('ok',job())
  except RuntimeError as e:return ('error',str(e))
 with concurrent.futures.ThreadPoolExecutor(max_workers=len(jobs)) as pool:return list(pool.map(work,jobs))
def rest(i,role,path,body=None):
 def encode(value):return base64.urlsafe_b64encode(value).decode().rstrip('=')
 header=encode(json.dumps({'alg':'HS256','typ':'JWT'}).encode());claims=encode(json.dumps({'role':role,'sub':users[i],'session_id':sessions[i],'exp':int(time.time())+300}).encode())
 unsigned=header+'.'+claims;token=unsigned+'.'+encode(hmac.new(JWT_SECRET.encode(),unsigned.encode(),hashlib.sha256).digest())
 payload=json.dumps(body).encode() if body is not None else b''
 method='POST' if body is not None else 'GET'
 headers=f'{method} /{path} HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\nAuthorization: Bearer {token}\r\n'
 if body is not None:headers+=f'Content-Type: application/json\r\nContent-Length: {len(payload)}\r\n'
 wire=(headers+'\r\n').encode()+payload
 # Raw loopback HTTP keeps JSON error bodies (BusyBox wget discards them).
 r=subprocess.run(['docker','exec','-i',CONTAINER,'nc','-w','2','127.0.0.1','3000'],input=wire,capture_output=True)
 head,_,content=r.stdout.partition(b'\r\n\r\n')
 codes=re.findall(rb'HTTP/1.[01] (\d+)',head)
 status=int(codes[-1]) if codes else 0
 try:data=json.loads(content)
 except ValueError:data={}
 return status,data
def rest_rpc(i,action,body):return rest(i,'service_role','rpc/slm_lineups_dispatch',dict(p_user=users[i],p_session=sessions[i],p_action=action,p_body=body))
def verify_restart():
 before=sql("select coalesce(jsonb_agg(to_jsonb(x) order by event_id),'[]')::text from public.slm_match_lineups x")
 assert before!='[]','Persistence fixture must contain a committed lineup'
 subprocess.run(['docker','stop',CONTAINER],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['docker','start',CONTAINER],check=True,stdout=subprocess.DEVNULL)
 for _ in range(100):
  if subprocess.run(['docker','exec',CONTAINER,'pg_isready','-U','postgres'],capture_output=True).returncode==0:break
  time.sleep(.15)
 else:raise RuntimeError('Retained PostgreSQL restart unavailable')
 check(sql("select coalesce(jsonb_agg(to_jsonb(x) order by event_id),'[]')::text from public.slm_match_lineups x")==before,'committed teams/version/author/time survive real PostgreSQL restart')
try:
 for _ in range(100):
  r=subprocess.run(['docker','exec',CONTAINER,'pg_isready','-U','postgres'],capture_output=True)
  logs=subprocess.run(['docker','logs',CONTAINER],capture_output=True,text=True)
  if r.returncode==0 and 'init process complete' in logs.stdout:break
  time.sleep(.2)
 else:raise RuntimeError('PostgreSQL unavailable')
 sql((ROOT/'app/supabase/tests/support/profile_contract_bootstrap.sql').read_text())
 sql("alter table auth.users add column aud text,add column role text,add column raw_user_meta_data jsonb default '{}'::jsonb,add column deleted_at timestamptz,add column raw_app_meta_data jsonb default '{}'::jsonb;")
 migrations=sorted((ROOT/'app/supabase/migrations').glob('*.sql'))
 for file in migrations:sql(file.read_text())
 check(len(migrations)==(42 if CI_MODE or branch=='feat/public-match-discovery-stage2b' else 41),str(len(migrations))+' canonical source migrations replayed, no Auth18')
 sql((ROOT/'app/supabase/tests/match_lineups.sql').read_text());check(True,'RLS/ACL/invoker/search_path contracts')
 for i,(u,sid) in enumerate(zip(users,sessions)):
  sql(f"insert into auth.users(id,email) values('{u}','{u}@fixture.invalid');select public.slm_account_provision('{u}','Lineup_{i:03d}','+48910000{i:03d}','{u}@fixture.invalid',null,null,false);update public.slm_account_security set must_change_password=false where user_id='{u}';insert into auth.sessions(id,user_id) values('{sid}','{u}');select public.slm_account_accept_session('{u}','{sid}',1);")
 group=domain(0,'groups','create',name='Lineup fixture A')['group_id'];other=domain(3,'groups','create',name='Lineup fixture B')['group_id']
 for i in [1,2,4,5]:invite(i,group)
 event_body=dict(group_id=group,name='Lineup fixture',visibility='private',starts_at=sql("select (now()+interval '2 days')::text"),location='Fixture',duration_minutes=90,capacity=15,cost_cents=0)
 match=domain(1,'matches','create',**event_body)['event_id']
 for i in [1,2]:domain(i,'matches','join',event_id=match)
 for i in range(9):domain(1,'matches','guest',event_id=match,guest_name='Gość fixture '+str(i))
 ids=[p['id'] for p in domain(1,'matches','detail',event_id=match)['participants'] if p['status']=='registered'];ids.sort()
 a=ids[::2];b=ids[1::2]
 s=get();check(s['version']==0 and s['last_change'] is None and len(s['unassigned'])==11,'member GET is read-only, empty version0, 11 real roster IDs')
 check(sql('select count(*) from public.slm_match_lineups')=='0','GET never inserts lineup')
 rpc(3,'lineups','get',dict(event_id=match),expected='not_found');save(3,payload(s,a,b),expected='not_found');check(True,'outsider/other group admin denied read and write')
 sql(f"update public.slm_account_security set active=false where user_id='{users[4]}'")
 rpc(4,'lineups','get',dict(event_id=match),expected='session_invalid');save(4,payload(s,a,b),expected='session_invalid');check(True,'inactive member cannot read or save')
 domain(5,'groups','leave',group_id=group);rpc(5,'lineups','get',dict(event_id=match),expected='not_found');check(True,'former member denied')
 empty=save(1,payload(s));check(empty['version']==0 and not empty['changed'] and empty['last_change'] is None and sql('select count(*) from public.slm_match_lineups')=='0','empty first save is no-op, no author/row')
 for bad_a,bad_b in [(a+[a[0]],b),(a,b+[a[0]]),([None],[]),([123],[]),([str(uuid.uuid4())],[]),(ids+ids,[])]:
  save(1,payload(s,bad_a,bad_b),expected='lineup_invalid_assignment')
 save(1,payload(s,['not-a-uuid'],[]),expected='invalid input syntax for type uuid');check(True,'duplicate/cross-side/null/type/foreign/malformed/oversized IDs rejected')
 for key in ['updated_by','author_id','p_user','group_id']:
  save(1,{**payload(s,a,b),key:users[3]},expected='invalid_input')
 check(True,'author/scope injection rejected in SQL payload')
 initial_body=payload(s,a,b);first=save(1,initial_body)
 check(first['version']==1 and first['changed'] and len(first['team_a'])==6 and len(first['team_b'])==5 and first['last_change']['user_id']==users[1],'ordinary member saves shared 6:5 including nine guests')
 check(get(2)['team_a']==a and get(2)['version']==1,'second member reads committed common lineup')
 check('display_name' not in sql("select response::text from public.slm_v2_requests where action='lineup:save'"),'request cache stores no personal name')
 noop=save(2,payload(first,list(reversed(a)),list(reversed(b))))
 check(not noop['changed'] and noop['version']==1 and noop['last_change']==first['last_change'],'no-op and array order changes preserve author/time/version')
 replay=save(1,dict(initial_body,team_a=list(reversed(a))))
 check(replay['replayed'] and replay['version']==1 and replay['last_change']==first['last_change'],'retry preserves same outcome, canonical ordering idempotent')
 save(1,dict(initial_body,team_a=b,team_b=a),expected='idempotency_conflict');check(True,'same request UUID cannot change payload')
 ledger_before=sql("select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]')::text from public.slm_group_ledger x")
 swap_a=[b[0],*a[1:]];swap_b=[a[0],*b[1:]]
 swapped=save(2,payload(get(),swap_a,swap_b));check(swapped['version']==2 and swapped['last_change']['user_id']==users[2],'point-and-swap commits once with verified actor2')
 sql(f"update public.slm_profiles set full_name='Chronione dane fixture',display_as='full_name' where user_id='{users[2]}';update public.slm_group_members set share_full_name=true where group_id='{group}' and user_id='{users[2]}'")
 privacy_body=payload(get());privacy=save(1,privacy_body);check(privacy['last_change']['display_name']=='Chronione dane fixture','author name honors existing explicit group consent')
 sql(f"update public.slm_group_members set share_full_name=false where group_id='{group}' and user_id='{users[2]}'")
 check(save(1,privacy_body)['last_change']['display_name']=='Lineup_002','idempotent replay reprojects revoked consent, no cached surname leak')
 check(get(0)['last_change']['display_name']=='Chronione dane fixture' and get()['last_change']['display_name']=='Lineup_002','admin/ordinary name projections keep PR16 boundaries')
 transfer_a=[x for x in swapped['team_a'] if x!=swapped['team_a'][0]];transfer_b=[*swapped['team_b'],swapped['team_a'][0]]
 transferred=save(1,payload(get(),transfer_a,transfer_b));check(len(transferred['team_a'])==5 and len(transferred['team_b'])==6,'single-person transfer 6:5 to5:6')
 check(save(1,initial_body)['version']==1 and get()['version']==3,'historical retry does not roll back a newer lineup')
 save(1,payload(first,a,b),expected='lineup_version_conflict');save(1,dict(payload(get()),expected_roster_version='0'*64),expected='lineup_roster_conflict');check(True,'stale lineup/roster versions rejected atomically')
 current=get();body1=payload(current,a,b);body2=payload(current,b,a)
 outcomes=parallel([lambda:save(1,body1),lambda:save(2,body2)])
 check(sum(x[0]=='ok' for x in outcomes)==1 and any('lineup_version_conflict' in str(x) for x in outcomes) and get()['version']==current['version']+1,'two real concurrent users: one commit and one conflict')
 current=get();next_a=current['team_b'];next_b=current['team_a'];same=payload(current,next_a,next_b)
 outcomes=parallel([lambda:save(1,same),lambda:save(1,same)])
 check(all(x[0]=='ok' for x in outcomes) and get()['version']==current['version']+1 and sql(f"select count(*) from public.slm_v2_requests where actor_id='{users[1]}' and request_id='{same['request_id']}'")=='1','concurrent identical retries yield one state version and one request record')
 check(sql("select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]')::text from public.slm_group_ledger x")==ledger_before,'lineup changes never alter financial ledger')
 rpc(1,'group_finance','detail',dict(group_id=group,event_id=match),expected='forbidden');check(True,'creator/member gains no finance authority')
 current=get();domain(1,'matches','guest',event_id=match,guest_name='Rezerwa fixture',list='reserve')
 save(1,payload(current),expected='lineup_roster_conflict');reserve_id=domain(1,'matches','detail',event_id=match)['participants'][-1]['id']
 save(1,payload(get(),[reserve_id],[]),expected='lineup_invalid_assignment');check(True,'roster changes conflict and reserve cannot enter lineup')
 foreign_event=domain(3,'matches','create',**dict(event_body,group_id=other,visibility='public'))['event_id'];domain(3,'matches','join',event_id=foreign_event)
 foreign_id=domain(3,'matches','detail',event_id=foreign_event)['participants'][0]['id'];save(1,payload(get(),[foreign_id],[]),expected='lineup_invalid_assignment');check(True,'public foreign match participant rejected')
 current=get();removed=current['team_a'][0]
 # Fixture actor0 is the current group admin; remove any assigned participant through canonical API.
 domain(0,'matches','withdraw',event_id=match,participant_id=removed)
 changed=get();check(removed in changed['stale_entry_ids'],'GET reports stale stored assignment without mutating history')
 save(1,payload(current),expected='lineup_roster_conflict');save(1,payload(changed),expected='lineup_invalid_assignment')
 clean=save(1,payload(changed,[x for x in changed['team_a'] if x!=removed],[x for x in changed['team_b'] if x!=removed]));check(not clean['stale_entry_ids'],'current roster cleanup is explicit versioned write')
 # Exact RLS/ACL bypass attempts with a real authenticated PostgreSQL role.
 sql('begin;set local role authenticated;select * from public.slm_match_lineups;',expected='permission denied')
 sql(f"begin;set local role authenticated;insert into public.slm_match_lineups(event_id,version,roster_version,updated_by) values('{match}',1,'x','{users[1]}');",expected='permission denied')
 sql(f"begin;set local role authenticated;select public.slm_lineups_dispatch('{users[0]}','{sessions[0]}','get','{{\"event_id\":\"{match}\"}}');",expected='permission denied')
 check(sql('begin;grant select on public.slm_match_lineups to authenticated;set local role authenticated;select count(*) from public.slm_match_lineups;rollback;')=='0','RLS denies rows even with temporary test SELECT grant; direct REST/RPC impersonation denied')
 sql(f"select public.slm_lineups_dispatch('{users[0]}','{sessions[1]}','get','{{\"event_id\":\"{match}\"}}');",expected='session_invalid');check(True,'mismatched actor/session rejected')
 # Real local PostgREST/JWT over loopback INSIDE the network-none fixture namespace.
 # These are locally signed synthetic tokens, NOT GoTrue-issued sessions or Edge HTTP.
 sql('create role authenticator login noinherit;grant anon,authenticated,service_role to authenticator;')
 start_fixture(REST,REST_IMAGE,['--network','container:'+CONTAINER,'-e','PGRST_DB_URI=postgresql://authenticator@127.0.0.1/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_JWT_SECRET='+JWT_SECRET])
 rest_started=True
 for _ in range(100):
  if rest(1,'authenticated','')[0]==200:break
  time.sleep(.15)
 else:raise RuntimeError('Local PostgREST unavailable')
 status,dto=rest_rpc(1,'get',dict(event_id=match));check(status==200 and dto['version']==get()['version'],'real PostgREST HTTP read returns committed lineup')
 check(rest(1,'authenticated','slm_match_lineups?select=*')[0] in (401,403,404),'real REST client cannot read protected table')
 forged=dict(p_user=users[0],p_session=sessions[0],p_action='get',p_body=dict(event_id=match))
 check(rest(1,'authenticated','rpc/slm_lineups_dispatch',forged)[0] in (401,403,404),'real REST client cannot execute forged service RPC')
 check(rest_rpc(3,'get',dict(event_id=match))[1].get('message')=='not_found','real HTTP dispatcher rejects outsider')
 current=get();http1=payload(current,current['team_b'],current['team_a']);http2=payload(current,[],current['team_a']+current['team_b'])
 outcomes=parallel([lambda:rest_rpc(1,'save',http1),lambda:rest_rpc(2,'save',http2)])
 pairs=[item[1] for item in outcomes if item[0]=='ok']
 check(sorted(x[0] for x in pairs)==[200,400] and any(x[1].get('message')=='lineup_version_conflict' for x in pairs),'two concurrent real HTTP writes produce one commit and one version conflict')
 winner=0 if pairs[0][0]==200 else 1
 retry=rest_rpc(1 if winner==0 else 2,'save',http1 if winner==0 else http2)
 check(retry[0]==200 and retry[1]['replayed'] and get()['version']==current['version']+1,'real HTTP retry does not create another version')
 current=get();sql(f"update public.slm_matches set starts_at=now()-interval '3 hours' where id='{match}'")
 save(1,payload(get()),expected='lineup_closed');check(get()['version']==current['version'],'ended match read allowed but new writes closed')
 sql(f"update public.slm_matches set starts_at=now()+interval '2 days' where id='{match}'")
 domain(0,'matches','cancel',event_id=match,reason='Fixture cancel');save(1,payload(get()),expected='event_cancelled');check(True,'cancelled match rejects new writes without deleting lineup')
 # A committed receipt must remain replayable even after the current capacity shrinks.
 current_version=get()['version'];sql(f"update public.slm_matches set capacity=10 where id='{match}'")
 receipt=save(1,initial_body)
 check(receipt['replayed'] and receipt['version']==1 and get()['version']==current_version,'retry of committed larger lineup survives later capacity reduction without rewriting current state')
 domain(2,'groups','leave',group_id=group)
 # Replay authored by1 still returns a safe public fallback if its author2 left.
 check(save(1,privacy_body)['last_change']['display_name']=='Lineup_002','former author fallback never reveals surname on retry')
 sql(f"update public.slm_groups set archived=true where id='{group}'")
 rpc(1,'lineups','get',dict(event_id=match),expected='group_archived');check(True,'archived group denies operations')
 # Prepare the exact owned transfer fixture required by the unchanged legacy finance regression.
 authority=domain(1,'groups','create',name='Admin authority A lineup fixture')['group_id']
 domain(1,'groups','invite',group_id=authority,user_id=users[0]);inv=domain(0,'groups','inbox')['requests'][0];domain(0,'groups','decide',id=inv['id'],accept=True)
 domain(1,'matches','create',**dict(event_body,group_id=authority,name='Former-admin-created lineup fixture'))
 domain(1,'groups','transfer',group_id=authority,user_id=users[0])
 for file in ['premium_match_visibility.sql','premium_admin_finance.sql','premium_profile_name.sql','settlements.sql','integration-contracts.sql']:
  sql((ROOT/'app/supabase/tests'/file).read_text());check(True,'existing regression SQL '+file)
 if rest_started:
  subprocess.run(['docker','stop',REST],check=True,stdout=subprocess.DEVNULL);rest_started=False
 verify_restart()
 print(f'RESULT {passed} PASS; real PostgreSQL transactions/RLS/concurrency. Auth schema fixture and locally signed JWT; real PostgREST HTTP tested, GoTrue/Edge HTTP NOT TESTED.',flush=True)
finally:
 if rest_started:subprocess.run(['docker','stop',REST],capture_output=True)
 subprocess.run(['docker','stop',CONTAINER],capture_output=True)
 print('Fixture stopped and retained (no reset/drop/remove): '+CONTAINER,flush=True)
