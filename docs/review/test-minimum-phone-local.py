"""Real minimum43/phone acceptance; only NEW containers from the existing runner.
Bootstrap42 mode tests atomic upgrade of a fresh fixture, never an existing DB.
"""
import argparse,importlib.util,json,secrets,shutil,socket,subprocess,sys,time,uuid
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from datetime import datetime,timedelta

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--fixture-repo',type=Path,required=True)
parser.add_argument('--serve',action='store_true')
parser.add_argument('--resume',action='store_true')
args=parser.parse_args()
STATE=ROOT/'.cache/minimum-phone/local-backend.json'
LOGIN=ROOT/'.cache/minimum-phone/TEST-LOGIN.txt'
mobile=[]
if args.serve or args.resume:
 with socket.socket() as probe:
  try:probe.bind(('127.0.0.1',55431))
  except OSError:raise SystemExit('Port55431 already used; no containers changed.')
repo=args.fixture_repo.resolve()
sys.path.insert(0,str(repo/'app/scripts'))
spec=importlib.util.spec_from_file_location('minimum_fixture',repo/'app/scripts/test-lineups-edge-local.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
extra=0

def check(ok,label):
 global extra
 f.check(ok,'MINIMUM/PHONE: '+label);extra+=1

def account(legacy=False,suffix=''):
 email=uuid.uuid4().hex+'@fixture.invalid';pwd=secrets.token_urlsafe(20)+'Aa7!'
 status,user,_=f.http(9999,'/admin/users',{'email':email,'password':pwd,'email_confirm':True},f.jwt('service_role'))
 assert status in (200,201)
 if legacy:
  login='RcLegacy'+suffix+uuid.uuid4().hex[:6]
  phone='+48000000'+str(400+int(suffix or '0'))
  f.sql("select public.slm_account_provision('"+user['id']+"','"+login+"','"+phone+"','"+email+"')")
 else:login=email;phone=''
 session=f.account(None,'login',identifier=login,password=pwd)
 actor={'id':user['id'],'token':session['access_token'],'login':login,'password':pwd,'phone':phone}
 if session['must_change_password']:
  new=secrets.token_urlsafe(20)+'Aa7!'
  session=f.account(actor,'password',current_password=pwd,new_password=new);actor.update(token=session['access_token'],password=new)
 return actor

def verify(users,group):
 # Both bootstrap42 and final canonical43 run through the genuine local preflight.
 if len(list((repo/'app/supabase/migrations').glob('*.sql')))==42:
  migration=next((ROOT/'app/supabase/migrations').glob('*_configurable_match_minimum.sql')).read_text(encoding='utf-8')
  original=f.sql("select pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure)")
  f.sql(original.replace('v_count<10','v_count < 10'))
  try:
   f.sql(migration)
  except RuntimeError:pass
  else:raise AssertionError('Migration accepted an unexpected source contract')
  check(f.sql("select count(*) from information_schema.columns where table_schema='public' and table_name='slm_matches' and column_name='minimum_players'")=='0','migration mismatch rolls back new column atomically')
  f.sql(original)
  old=f.sql('select count(*) from public.slm_matches')
  f.sql(migration)
  check(f.sql('select count(*) from public.slm_matches')==old and f.sql('select bool_and(minimum_players=10) from public.slm_matches')=='t','42-to43 keeps fixture rows/default10 without changing decisions')
  shutil.copytree(ROOT/'app/supabase/functions',f.SOURCE/'functions',dirs_exist_ok=True)
  for suffix in ('-rest','-edge'):f.command(['docker','restart',f.NAME+suffix])
  f.wait_http(3000,'/');f.wait_http(9000,'/health')
 f.sql((ROOT/'app/supabase/tests/minimum_phone.sql').read_text(encoding='utf-8'))
 check(True,'schema constraints, RLS, table ACL and cross-model uniqueness remain enforced')
 admin,member,second,outsider=users
 tomorrow=(datetime.now()+timedelta(days=1)).strftime('%Y-%m-%d')
 values=dict(group_id=group,name='Minimum configurable fixture',visibility='private',date=tomorrow,time='18:00',location='Fixture',address='Address preserved',duration_minutes=90,capacity=15,cost_cents=0)
 event=f.write(member,'matches_create',**values,minimum_players=13)['event_id']
 def detail(user=member):return f.account(user,'matches_detail',event_id=event)['event']
 check(detail()['minimum_players']==13 and detail()['capacity']==15 and detail()['address']=='Address preserved','create persists independent minimum/capacity/address')
 check(f.account(member,'matches_list',scope='groups')['match_minimum_version']==1,'list advertises exact minimum capability')
 default=f.write(member,'matches_create',**values)['event_id']
 check(f.account(member,'matches_detail',event_id=default)['event']['minimum_players']==10,'omitted create minimum defaults to10')
 for bad in (0,-1,1.5,16,None,True,'13'):
  f.account(member,'matches_create',expected=400,**values,minimum_players=bad,request_id=str(uuid.uuid4()))
  check(True,'invalid minimum rejected by Edge/SQL')
 for actor in (member,second):f.write(actor,'matches_join',event_id=event)
 for number in range(11):f.write(member,'matches_guest',event_id=event,guest_name='Guest '+str(number),list='registered')
 check(detail()['registered_count']==13 and not detail()['decision_required'],'players and guests both count towards minimum; no pre17 decision')
 state=detail();body={**values,'event_id':event,'expected_version':state['version'],'minimum_players':12,'request_id':str(uuid.uuid4())}
 first=f.account(member,'matches_edit',**body);replay=f.account(member,'matches_edit',**body)
 check(first==replay and detail()['minimum_players']==12,'edit persists minimum and identical retry is idempotent')
 f.account(member,'matches_edit',expected=409,**{**body,'request_id':str(uuid.uuid4()),'minimum_players':11})
 check(detail()['minimum_players']==12,'stale edit cannot overwrite newer minimum')
 f.account(second,'matches_edit',expected=403,**{**body,'request_id':str(uuid.uuid4()),'expected_version':detail()['version']})
 f.account(outsider,'matches_detail',expected=404,event_id=event)
 status,rows,_=f.http(3000,'/slm_matches?select=id,minimum_players&id=eq.'+event,token=outsider['token'])
 check(status in (401,403,404) or status==200 and rows==[],'direct REST/RLS cannot reveal foreign private minimum or event')
 check(True,'edit remains creator/member only; private outsider denied')
 # Missing edit field preserves a customized value for older clients.
 f.account(member,'matches_edit',**{**values,'event_id':event,'expected_version':detail()['version'],'request_id':str(uuid.uuid4())})
 check(detail()['minimum_players']==12,'old client omission does not reset custom minimum')
 now=datetime.now().astimezone()
 if now.hour>=17 and (now.hour,now.minute)<(23,59):
  late={**values,'date':now.strftime('%Y-%m-%d'),'time':'23:59','event_id':event,'expected_version':detail()['version'],'request_id':str(uuid.uuid4()),'minimum_players':14}
  f.account(member,'matches_edit',**late)
  check(detail()['decision_required'] and detail()['status']=='scheduled','after17 actual custom threshold prompts a decision without auto-cancel')
  last=f.account(member,'matches_detail',event_id=event)['participants']
  guest=next(p for p in last if p['member_id'] is None and p['status']=='registered')
  f.write(member,'matches_withdraw',event_id=event,participant_id=guest['id'])
  check(f.sql("select payable from public.slm_match_entries where id='"+guest['id']+"'")=='t','after17 withdrawal below custom14 retains the original financial responsibility rule')
  f.account(member,'matches_edit',**{**late,'request_id':str(uuid.uuid4()),'expected_version':detail()['version'],'minimum_players':11})
  check(not detail()['decision_required'] and detail()['status']=='scheduled','changing minimum never changes the administrator decision/status')
 else:print('NOT RUN real after17 boundary; wall clock not in17:00-23:58 Warsaw',flush=True)
 email_a,email_b=account(),account()
 f.account(email_a,'save_email_profile',expected=401,nickname='Email A',phone='000000221',current_password='wrong-password')
 check(f.account(email_a,'profile')['phone']=='','wrong current password cannot change contact')
 for bad in ('12345678','+12025550111','48000000221'):
  f.account(email_a,'save_email_profile',expected=400,nickname='Email A',phone=bad,current_password=email_a['password'])
 check(True,'shared Polish validator enforced by real Edge')
 f.account(email_a,'save_email_profile',nickname='Email A',phone='+48 000 000 221',current_password=email_a['password'])
 check(f.account(email_a,'profile')['phone']=='+48000000221','email contact stores canonical +48')
 f.account(email_b,'save_email_profile',expected=409,nickname='Email B',phone='0048000000221',current_password=email_b['password'])
 check(f.account(email_b,'profile')['phone']=='','duplicate contact leaves victim and caller unchanged')
 legacy=account(True)
 old_token=legacy['token'];old_phone=legacy['phone']
 f.account(legacy,'identifiers',expected=409,login=legacy['login'],phone='000000221',current_password=legacy['password'])
 check(f.account(legacy,'profile')['phone']==old_phone,'legacy conflict with email contact rejected before invalidating session')
 f.account(legacy,'identifiers',expected=401,login=legacy['login'],phone='000000333',current_password='wrong-password')
 check(f.account(legacy,'profile')['phone']==old_phone,'wrong password never starts alias change')
 fresh=f.account(legacy,'identifiers',login=legacy['login'],phone='0048 000 000 333',current_password=legacy['password'])
 legacy['token']=fresh['access_token']
 check(fresh['user_id']==legacy['id'] and f.account(legacy,'profile')['phone']=='+48000000333','legacy phone rotates accepted session and preserves account/login')
 f.account({'token':old_token},'profile',expected=401)
 f.account(None,'login',expected=401,identifier=old_phone,password=legacy['password'])
 by_phone=f.account(None,'login',identifier='+48 000 000 333',password=legacy['password'])
 check(by_phone['user_id']==legacy['id'],'new phone signs into same account; old alias/session denied')
 f.account(None,'login',expected=401,identifier='000000333',password=email_a['password'])
 check(True,'knowing another phone and own password cannot take over the account')
 f.account(email_b,'save_email_profile',expected=409,nickname='Email B',phone='000000333',current_password=email_b['password'])
 check(f.account(email_b,'profile')['phone']=='','reverse-model contact collision denied')
 mobile.extend([email_b,legacy])
 for path,body in (('/rpc/slm_email_profile_save',{'p_user':email_a['id'],'p_phone':'+48000000999','p_nickname':'forged','p_session':str(uuid.uuid4())}),('/rpc/slm_account_finish',{'p_user':legacy['id'],'p_operation':str(uuid.uuid4()),'p_phone':'+48000000999'})):
  status,_,_=f.http(3000,path,body,token=email_b['token']);check(status in (401,403,404),'authenticated client cannot invoke privileged phone RPC')
 check(f.account(email_a,'profile',user_id=email_b['id'])['user_id']==email_a['id'],'profile subject comes from verified session, not body target')
 f.account(email_a,'logout');f.account(email_a,'profile',expected=401)
 check(True,'logout blocks stale own-profile access')
 print('MINIMUM_PHONE_RESULT '+str(extra)+' PASS; real GoTrue/Edge/PostgreSQL; no Cloud/existing DB mutation',flush=True)

class Relay(BaseHTTPRequestHandler):
 allowed={'http://localhost','https://localhost','capacitor://localhost'}
 def log_message(self,*args):pass
 def send(self,status,data):
  origin=self.headers.get('Origin')
  if origin and origin not in self.allowed:self.send_error(403);return
  wire=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store')
  if origin:self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin')
  self.send_header('Access-Control-Allow-Methods','POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Content-Type, Authorization');self.send_header('Content-Length',str(len(wire)));self.end_headers()
  try:self.wfile.write(wire)
  except (BrokenPipeError,ConnectionResetError):pass
 def do_GET(self):
  if self.path!='/healthz':self.send_error(404);return
  ready=f.http(9000,'/health')[0]==200;self.send(200 if ready else 503,{'ready':ready,'migrations':43,'local_test_only':True})
 def do_OPTIONS(self):
  if self.path!='/functions/v1/accounts':self.send_error(404);return
  self.send(200,{})
 def do_POST(self):
  if self.path!='/functions/v1/accounts' or self.headers.get('Origin') not in (None,*self.allowed):self.send_error(403);return
  try:
   size=int(self.headers.get('Content-Length','0'));assert 0<size<=12288
   body=json.loads(self.rfile.read(size));assert isinstance(body,dict)
  except (ValueError,AssertionError):self.send_error(400);return
  status,data,_=f.http(9000,self.path,body,self.headers.get('Authorization','').removeprefix('Bearer '));self.send(status or 503,data)

def identities(names):
 result=[]
 for name in names:
  d=json.loads(f.command(['docker','inspect',name]))[0]
  assert d['Config']['Labels']['slm.fixture']=='lineups-edge-stage2a' and not d['HostConfig']['PortBindings']
  assert d['HostConfig']['NetworkMode']=='none' or d['HostConfig']['NetworkMode'].startswith('container:')
  result.append({'name':name,'id':d['Id'],'image':d['Image']})
 return result

def serve():
 server=ThreadingHTTPServer(('127.0.0.1',55431),Relay)
 print('READY owned backend43 http://127.0.0.1:55431; private credentials '+str(LOGIN),flush=True)
 try:server.serve_forever()
 finally:server.server_close()

def renew_owned_edge(state,names):
 # Existing runner service JWTs expire after one hour. Retain the database and
 # its JWT signing key; replace only this verified, stateless fixture worker.
 rest=json.loads(f.command(['docker','inspect',names[2]]))[0]
 env=dict(item.split('=',1) for item in rest['Config']['Env'] if '=' in item)
 f.SECRET=env['PGRST_JWT_SECRET']
 assert len(f.SECRET)==64 and all(c in '0123456789abcdef' for c in f.SECRET)
 edge=json.loads(f.command(['docker','inspect',names[3]]))[0]
 mounts=[m for m in edge['Mounts'] if m['Destination']=='/fixture']
 assert len(mounts)==1 and edge['Mounts']==mounts and not mounts[0]['RW']
 assert edge['Image']==json.loads(f.command(['docker','image','inspect',f.EDGE_IMAGE]))[0]['Id']
 source=Path(mounts[0]['Source']).resolve()
 assert source.is_relative_to(repo/'.cache') and source.name==f.NAME
 actual={p.relative_to(source/'functions').as_posix():p.read_bytes() for p in (source/'functions').rglob('*') if p.is_file()}
 expected={p.relative_to(repo/'app/supabase/functions').as_posix():p.read_bytes() for p in (repo/'app/supabase/functions').rglob('*') if p.is_file()}
 assert actual==expected,'Retained fixture functions differ from reviewed sources'
 assert identities(names)==state['containers'],'Fixture identity changed during resume'
 f.command(['docker','stop','--timeout','5',names[3]])
 f.command(['docker','rm',names[3]])  # No -v; worker has only the read-only source bind, no database.
 f.start(names[3],f.EDGE_IMAGE,{'FIXTURE_ANON':f.jwt('anon'),'FIXTURE_SERVICE':f.jwt('service_role')},['start','--ip','127.0.0.1','--main-service','/fixture'],source)
 state['containers']=identities(names)
 STATE.write_text(json.dumps(state,indent=2))
 print('Renewed only owned stateless Edge fixture credentials; database/key/accounts retained.',flush=True)

try:
 if args.resume:
  import lineups_ci
  lineups_ci.verify_sources()
  state=json.loads(STATE.read_text());assert state['migrations']==43 and state['name'].startswith('slm-lineups-edge-')
  names=[state['name']+suffix for suffix in ('','-auth','-rest','-edge')]
  assert identities(names)==state['containers']
  f.NAME=state['name']
  f.command(['docker','start',names[0]]);f.started.append(names[0])
  for attempt in range(60):
   if subprocess.run(['docker','exec',names[0],'pg_isready','-U','postgres'],capture_output=True,timeout=10).returncode==0:break
   time.sleep(0.5)
  else:raise RuntimeError('Recorded local PostgreSQL did not become ready; no schema changed')
  for name in names[1:3]:f.command(['docker','start',name]);f.started.append(name)
  renew_owned_edge(state,names)
  for port,path in ((9999,'/health'),(3000,'/'),(9000,'/health')):f.wait_http(port,path)
  serve()
 else:
  if args.serve:assert not STATE.exists(),'Use resume for the recorded fixture'
  f.main(verify)
  if args.serve:
   admin,member=mobile
   group=f.write(admin,'groups_create',name='SLM RC minimum i telefon')['group_id']
   f.write(admin,'groups_invite',group_id=group,user_id=member['id'])
   invitation=f.account(member,'groups_inbox')['requests'][0];f.write(member,'groups_decide',id=invitation['id'],accept=True)
   event=f.write(admin,'matches_create',group_id=group,name='Minimum 13 - testy RC',visibility='private',date=(datetime.now()+timedelta(days=7)).strftime('%Y-%m-%d'),time='18:00',location='Boisko testowe',duration_minutes=90,capacity=15,minimum_players=13,cost_cents=0)['event_id']
   for user in mobile:f.write(user,'matches_join',event_id=event)
   for n in range(11):f.write(admin,'matches_guest',event_id=event,guest_name='Gosc RC '+str(n+1),list='registered')
   assert f.account(admin,'matches_detail',event_id=event)['event']['registered_count']==13
   LOGIN.write_text('LOCAL FICTIONAL ACCOUNTS ONLY\n'+''.join('Login: '+u['login']+'\nPhone: '+u['phone']+'\nPassword: '+u['password']+'\n\n' for u in mobile),encoding='utf-8')
   STATE.write_text(json.dumps({'name':f.NAME,'migrations':43,'containers':identities(f.started)},indent=2))
   serve()
except KeyboardInterrupt:print('Stopping only owned backend43 fixture.',flush=True)
finally:
 for name in reversed(f.started):subprocess.run(['docker','stop','--timeout','5',name],capture_output=True,timeout=25)
 print('Stopped/retained only NEW minimum-phone fixture: '+f.NAME,flush=True)
