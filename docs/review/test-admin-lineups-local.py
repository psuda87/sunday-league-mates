"""New isolated fixture only: preserve original43 tests, then verify admin44.
No existing database, Cloud, device, key or real user is changed.
"""
from pathlib import Path
import argparse,importlib.util,sys,uuid,subprocess,json,socket,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'app/scripts'))
spec=importlib.util.spec_from_file_location('fixture',ROOT/'app/scripts/test-lineups-edge-local.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--serve',action='store_true');parser.add_argument('--resume',action='store_true')
parser.add_argument('--state-dir',type=Path,default=ROOT/'.cache/stabilization')
args=parser.parse_args();state_dir=args.state_dir.resolve();state_dir.mkdir(parents=True,exist_ok=True)
state_file=state_dir/'backend44.json';mobile=[]
if args.serve or args.resume:
 with socket.socket() as probe:
  try:probe.bind(('127.0.0.1',55441))
  except OSError:raise SystemExit('Port55441 occupied; no containers changed')

def verify(users,group):
 admin,member,second,outsider=users
 mobile.append(admin)
 f.sql((ROOT/'app/supabase/tests/lineup_admin.sql').read_text(encoding='utf-8'))
 events=f.account(member,'matches_list',scope='groups')['events']
 event=next(e for e in events if e['name']=='Lineup HTTP fixture')['id']
 def get(actor=admin):return f.account(actor,'lineups_get',event_id=event)
 def body(s,a=None,b=None):return dict(event_id=event,expected_version=s['version'],expected_roster_version=s['roster_version'],team_a=s['team_a'] if a is None else a,team_b=s['team_b'] if b is None else b,request_id=str(uuid.uuid4()))
 def check(ok,label):f.check(ok,'ADMIN44 '+label)
 before=get();check(before['can_write'] and not get(member)['can_write'],'only current group administrator receives write capability')
 f.account(member,'lineups_save',expected=403,**body(before))
 check(get()['version']==before['version'],'ordinary creator/member cannot write or change author/version')
 f.account(outsider,'lineups_get',expected=404,event_id=event)
 f.account(outsider,'lineups_save',expected=404,**body(before))
 check(True,'other-group administrator cannot read private lineup or write')
 request=body(before,before['team_b'],before['team_a']);saved=f.account(admin,'lineups_save',**request)
 check(saved['changed'] and saved['last_change']['user_id']==admin['id'],'non-creator group administrator writes shared lineup')
 replay=f.account(admin,'lineups_save',**request)
 check(replay['replayed'] and replay['version']==saved['version'],'admin request replay is idempotent')
 noop=f.account(admin,'lineups_save',**body(get()))
 check(not noop['changed'] and noop['last_change']==saved['last_change'] and noop['version']==saved['version'],'no-op preserves version/author/time')
 f.account(admin,'lineups_save',expected=409,**{**request,'request_id':str(uuid.uuid4())})
 f.account(admin,'lineups_save',expected=409,**{**body(get()),'expected_roster_version':'0'*64})
 f.account(admin,'lineups_save',expected=400,**body(get(),[str(uuid.uuid4())],[]))
 check(True,'version, roster and foreign-entry guards still reject invalid writes')
 client=f.account(None,'login',identifier=admin['login'],password=admin['password'])
 a,b=body(get(),[],[]),body(get(),get()['team_b'],get()['team_a'])
 race=f.parallel([lambda:f.http(9000,'/functions/v1/accounts',dict(a,action='lineups_save'),admin['token']),lambda:f.http(9000,'/functions/v1/accounts',dict(b,action='lineups_save'),client['access_token'])])
 check(sorted(r[0] for r in race)==[200,409] and any(r[1].get('code')=='lineup_version_conflict' for r in race),'two actual admin sessions race: one commit and one conflict')
 member_view=get(member);current=get()
 check(member_view['team_a']==current['team_a'] and member_view['team_b']==current['team_b'] and not member_view['can_write'],'member sees server assignment, never an administrator RAM draft')
 status,_,_=f.http(3000,'/slm_match_lineups?select=*',token=member['token'])
 check(status in (401,403,404),'direct authenticated REST cannot bypass lineup ACL/RLS')
 f.write(admin,'groups_transfer',group_id=group,user_id=member['id'])
 f.account(admin,'lineups_save',expected=403,**request)
 check(not get()['can_write'] and get(member)['can_write'],'permission follows current group administrator and old receipts do not bypass revocation')
 result=f.account(member,'lineups_save',**body(get(member),[],[]))
 check(result['changed'] is False or result['last_change']['user_id']==member['id'],'successor uses existing lineup API with the same CAS rules')
 f.write(member,'groups_transfer',group_id=group,user_id=admin['id'])
 check(get()['can_write'] and not get(member)['can_write'],'authority restored through authorized API; original leave/logout tests still run')

def identities(names):
 result=[]
 for name in names:
  item=json.loads(f.command(['docker','inspect',name]))[0]
  assert item['Config']['Labels']['slm.fixture']=='lineups-edge-stage2a' and not item['HostConfig']['PortBindings']
  assert item['HostConfig']['NetworkMode']=='none' or item['HostConfig']['NetworkMode'].startswith('container:')
  result.append({'name':name,'id':item['Id'],'image':item['Image']})
 return result

class Relay(BaseHTTPRequestHandler):
 origins={'http://localhost','https://localhost','capacitor://localhost'}
 def log_message(self,*args):pass
 def send(self,status,data):
  origin=self.headers.get('Origin')
  if origin and origin not in self.origins:self.send_error(403);return
  wire=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store')
  if origin:self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin')
  self.send_header('Access-Control-Allow-Headers','Content-Type, Authorization');self.send_header('Access-Control-Allow-Methods','POST, OPTIONS');self.send_header('Content-Length',str(len(wire)));self.end_headers()
  try:self.wfile.write(wire)
  except (BrokenPipeError,ConnectionResetError):pass
 def do_GET(self):
  if self.path!='/healthz':self.send_error(404);return
  ready=f.http(9000,'/health')[0]==200;self.send(200 if ready else 503,{'ready':ready,'migrations':44,'local_test_only':True})
 def do_OPTIONS(self):
  if self.path!='/functions/v1/accounts':self.send_error(404);return
  self.send(200,{})
 def do_POST(self):
  if self.path!='/functions/v1/accounts' or self.headers.get('Origin') not in (None,*self.origins):self.send_error(403);return
  try:
   size=int(self.headers.get('Content-Length','0'));assert 0<size<=12288
   body=json.loads(self.rfile.read(size));assert isinstance(body,dict)
  except (ValueError,AssertionError):self.send_error(400);return
  status,data,_=f.http(9000,self.path,body,self.headers.get('Authorization','').removeprefix('Bearer '));self.send(status or 503,data)

try:
 if args.resume:
  import lineups_ci
  lineups_ci.verify_sources()
  state=json.loads(state_file.read_text());assert state['migrations']==44
  names=[state['name']+suffix for suffix in ('','-auth','-rest','-edge')]
  assert identities(names)==state['containers'];f.NAME=state['name']
  f.command(['docker','start',names[0]]);f.started.append(names[0])
  for _ in range(60):
   if subprocess.run(['docker','exec',names[0],'pg_isready','-U','postgres'],capture_output=True,timeout=10).returncode==0:break
   time.sleep(.5)
  else:raise RuntimeError('Owned PG44 not ready')
  for name in names[1:3]:f.command(['docker','start',name]);f.started.append(name)
  rest=json.loads(f.command(['docker','inspect',names[2]]))[0]
  f.SECRET=dict(x.split('=',1) for x in rest['Config']['Env'] if '=' in x)['PGRST_JWT_SECRET']
  edge=json.loads(f.command(['docker','inspect',names[3]]))[0];mounts=edge['Mounts']
  assert len(mounts)==1 and mounts[0]['Destination']=='/fixture' and not mounts[0]['RW']
  source=Path(mounts[0]['Source']).resolve();assert source.is_relative_to(ROOT/'.cache') and source.name==f.NAME
  actual={p.relative_to(source/'functions'):p.read_bytes() for p in (source/'functions').rglob('*') if p.is_file()}
  expected={p.relative_to(ROOT/'app/supabase/functions'):p.read_bytes() for p in (ROOT/'app/supabase/functions').rglob('*') if p.is_file()}
  assert actual==expected and identities(names)==state['containers']
  assert edge['Image']==json.loads(f.command(['docker','image','inspect',f.EDGE_IMAGE]))[0]['Id']
  f.command(['docker','stop','--timeout','5',names[3]]);f.command(['docker','rm',names[3]])
  f.start(names[3],f.EDGE_IMAGE,{'FIXTURE_ANON':f.jwt('anon'),'FIXTURE_SERVICE':f.jwt('service_role')},['start','--ip','127.0.0.1','--main-service','/fixture'],source)
  state['containers']=identities(names);state_file.write_text(json.dumps(state,indent=2))
  for port,path in ((9999,'/health'),(3000,'/'),(9000,'/health')):f.wait_http(port,path)
 else:
  if args.serve:assert not state_file.exists(),'Use --resume; do not duplicate an existing owned fixture'
  f.main(verify)
  if args.serve:
   u=mobile[0];(state_dir/'TEST-LOGIN.txt').write_text('LOCAL FICTIONAL ADMIN44 ONLY\nLogin: '+u['login']+'\nPassword: '+u['password']+'\n',encoding='utf-8')
   state_file.write_text(json.dumps({'name':f.NAME,'migrations':44,'containers':identities(f.started)},indent=2))
 if args.serve or args.resume:
  print('READY isolated admin44 on http://127.0.0.1:55441; private fixture login in ignored state directory',flush=True)
  server=ThreadingHTTPServer(('127.0.0.1',55441),Relay)
  try:server.serve_forever()
  finally:server.server_close()
except KeyboardInterrupt:pass
finally:
 for name in reversed(f.started):subprocess.run(['docker','stop','--timeout','5',name],capture_output=True,timeout=25)
 print('Stopped/retained only NEW admin44 fixture: '+f.NAME,flush=True)
