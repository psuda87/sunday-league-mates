"""Local Android test service over the existing reviewed backend42 fixture.

No Cloud/CLI/reset. First launch creates ONLY new synthetic fixture data using
the unchanged genuine Stage2B runner. Resume starts only the recorded owned
containers. Loopback relay exposes accounts only; credentials stay in .cache.
"""
import argparse
import importlib.util
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import threading
from datetime import datetime, timedelta

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / '.cache/slm2/local-backend.json'
LOGIN = ROOT / '.cache/slm2/TEST-LOGIN.txt'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--fixture-repo', type=Path, required=True)
parser.add_argument('--resume', action='store_true')
parser.add_argument('--browser-tests', action='store_true')
args = parser.parse_args()
fixture_repo = args.fixture_repo.resolve()
assert not __import__('os').environ.get('GITHUB_ACTIONS'), 'Local execution only'
with socket.socket() as probe:
    try:probe.bind(('127.0.0.1',55421))
    except OSError:raise SystemExit('Port55421 already in use. Check /healthz; no containers changed.')
for directory in (ROOT, fixture_repo):
    subprocess.run(['git', '-C', str(directory), 'diff', '--exit-code',
                    'ae6bb4be2eafb9e5a8e70ef695242b40cc5d54cc', '--', 'app/supabase'], check=True)
assert subprocess.check_output(['git','-C',str(fixture_repo),'branch','--show-current'],text=True).strip() == 'feat/public-match-discovery-stage2b'
assert len(list((ROOT/'app/supabase/migrations').glob('*.sql'))) == 42
sys.path.insert(0, str(fixture_repo/'app/scripts'))
spec = importlib.util.spec_from_file_location('slm2_fixture', fixture_repo/'app/scripts/test-lineups-edge-local.py')
f = importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)


def identities(names):
    result = []
    for name in names:
        data = json.loads(f.command(['docker','inspect',name]))[0]
        assert data['Config']['Labels']['slm.fixture'] == 'lineups-edge-stage2a'
        assert not data['HostConfig']['PortBindings']
        assert data['HostConfig']['NetworkMode'] == 'none' or data['HostConfig']['NetworkMode'].startswith('container:')
        result.append({'name':name,'id':data['Id'],'image':data['Image']})
    return result


class Relay(BaseHTTPRequestHandler):
    allowed = {'http://localhost','https://localhost','capacitor://localhost'}
    def log_message(self, *args):
        pass
    def headers_out(self, status, payload):
        origin = self.headers.get('Origin')
        if origin and origin not in self.allowed:
            self.send_error(403)
            return
        wire = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store')
        if origin:
            self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Vary','Origin')
        self.send_header('Access-Control-Allow-Headers','Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
        self.send_header('Content-Length',str(len(wire)))
        self.end_headers()
        try:self.wfile.write(wire)
        except (BrokenPipeError,ConnectionResetError):pass
    def do_GET(self):
        if self.path != '/healthz':
            self.send_error(404);return
        healthy = f.http(9000,'/health')[0] == 200
        self.headers_out(200 if healthy else 503,{'ready':healthy,'migrations':42,'local_test_only':True})
    def do_OPTIONS(self):
        if self.path != '/functions/v1/accounts':
            self.send_error(404);return
        self.headers_out(200,{})
    def do_POST(self):
        if self.path != '/functions/v1/accounts' or self.headers.get('Origin') not in (None,*self.allowed):
            self.send_error(403);return
        try:
            size = int(self.headers.get('Content-Length','0'))
            assert 0 < size <= 12288
            body = json.loads(self.rfile.read(size))
            assert isinstance(body,dict)
        except (ValueError,AssertionError):
            self.send_error(400);return
        status,payload,_ = f.http(9000,self.path,body,self.headers.get('Authorization','').removeprefix('Bearer '))
        self.headers_out(status or 503,payload)


def browser(script, setup):
    run = subprocess.run(['node',str(ROOT/'app/scripts'/script)],cwd=ROOT,
                         input=json.dumps(setup),encoding='utf-8',text=True,capture_output=True,timeout=300)
    # Existing browser runners log assertion labels, never setup credentials.
    print(run.stdout,end='',flush=True)
    if run.returncode:
        raise RuntimeError(script+' failed; '+run.stderr[-1500:])


def serve(users=None, group=None):
    server = ThreadingHTTPServer(('127.0.0.1',55421),Relay)
    thread = threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        if users is not None:
            if args.browser_tests:
                member,second,outsider=users[1:]
                event=f.write(member,'matches_create',group_id=group,name='SLM2 real UI fixture',visibility='private',date='2099-01-01',time='18:00',location='Fictional local pitch',duration_minutes=90,capacity=15,cost_cents=0)['event_id']
                for u in (member,second):f.write(u,'matches_join',event_id=event)
                for n in range(9):f.write(member,'matches_guest',event_id=event,guest_name='Guest UI '+str(n),list='registered')
                browser('test-lineups-ui-browser.mjs',{'proxy':'http://127.0.0.1:55421','eventId':event,'groupId':group,'users':[{'id':u['id'],'refresh':u['session']['refresh_token']} for u in (member,second)]})
                bulk='SLM2 Discovery bulk'
                special='Łódź %_ [A] SLM2'
                private=f.write(member,'matches_create',group_id=group,name='PRIVATE sentinel',visibility='private',date='2099-01-03',time='18:00',location='Fixture',duration_minutes=90,capacity=15,cost_cents=0)['event_id']
                public=f.write(member,'matches_create',group_id=group,name=special,visibility='public',date='2099-01-03',time='18:00',location='Fixture',duration_minutes=90,capacity=15,cost_cents=0)['event_id']
                f.sql("insert into public.slm_matches select (jsonb_populate_record(null::public.slm_matches,to_jsonb(e)||jsonb_build_object('id',gen_random_uuid(),'name','"+bulk+" '||n))).* from public.slm_matches e cross join generate_series(1,105) n where e.id='"+public+"'")
                # The first browser rotated member's refresh token. Use a new
                # real account instead of replaying that consumed credential.
                email=secrets.token_hex(8)+'@fixture.invalid'
                password=secrets.token_urlsafe(20)+'Aa7!'
                status,person,_=f.http(9999,'/admin/users',{'email':email,'password':password,'email_confirm':True},f.jwt('service_role'))
                assert status in (200,201)
                session=f.account(None,'login',identifier=email,password=password)
                discovery_member={'id':person['id'],'token':session['access_token'],'session':session}
                f.write(users[0],'groups_invite',group_id=group,user_id=person['id'])
                invitation=f.account(discovery_member,'groups_inbox')['requests'][0]
                f.write(discovery_member,'groups_decide',id=invitation['id'],accept=True)
                browser('test-discovery-ui-browser.mjs',{'proxy':'http://127.0.0.1:55421','privateId':private,'bulk':bulk,'special':special,'users':[{'id':u['id'],'refresh':u['session']['refresh_token']} for u in (discovery_member,outsider)]})
            accounts=[]
            for index in (1,2):
                email='slm2.rc.'+str(index)+'@fixture.invalid'
                password=secrets.token_urlsafe(16)+'Aa7!'
                status,user,_=f.http(9999,'/admin/users',{'email':email,'password':password,'email_confirm':True},f.jwt('service_role'))
                assert status in (200,201)
                session=f.account(None,'login',identifier=email,password=password)
                accounts.append({'id':user['id'],'token':session['access_token'],'email':email,'password':password})
            admin,member=accounts
            phone_group=f.write(admin,'groups_create',name='SLM 2.0 RC testy')['group_id']
            f.write(admin,'groups_invite',group_id=phone_group,user_id=member['id'])
            invitation=f.account(member,'groups_inbox')['requests'][0]
            f.write(member,'groups_decide',id=invitation['id'],accept=True)
            for public in (False,True):
                event=f.write(admin,'matches_create',group_id=phone_group,name='SLM RC '+('Publiczny' if public else 'Prywatny'),visibility='public' if public else 'private',date=(datetime.now()+timedelta(days=7)).strftime('%Y-%m-%d'),time='18:00',location='Boisko testowe',duration_minutes=90,capacity=15,cost_cents=27000)['event_id']
                for u in accounts:f.write(u,'matches_join',event_id=event)
                f.write(member,'matches_guest',event_id=event,guest_name='Gosc testowy',list='registered')
            assert f.account(member,'matches_list',scope='public')['public_discovery_version']==1
            LOGIN.write_text('LOCAL SYNTHETIC TEST ACCOUNTS ONLY\n'+''.join('Group '+('admin' if n==0 else 'member')+'\nLogin: '+a['email']+'\nPassword: '+a['password']+'\n\n' for n,a in enumerate(accounts)),encoding='utf-8')
            STATE.write_text(json.dumps({'containers':identities(f.started),'name':f.NAME,'backend_pin':'24a59e104bfe80b4d2f41cbd0ad02b58fc546040','port':55421},indent=2),encoding='utf-8')
        print('READY local backend42 at http://127.0.0.1:55421; private test login file: '+str(LOGIN),flush=True)
        print('No Cloud. Ctrl+C stops only this fixture; --resume reuses its data.',flush=True)
        while True:thread.join(1)
    finally:
        server.shutdown();server.server_close();thread.join(timeout=5)


try:
    if args.resume:
        state=json.loads(STATE.read_text(encoding='utf-8'))
        assert state['backend_pin']=='24a59e104bfe80b4d2f41cbd0ad02b58fc546040'
        assert state['name'].startswith('slm-lineups-edge-')
        assert [c['name'] for c in state['containers']]==[state['name']+suffix for suffix in ('','-auth','-rest','-edge')]
        assert identities([c['name'] for c in state['containers']])==state['containers']
        f.NAME=state['name']  # Only the recorded owned transport, never branch/CI context.
        for c in state['containers']:
            f.command(['docker','start',c['name']]);f.started.append(c['name'])
        for port,path in ((9999,'/health'),(3000,'/'),(9000,'/health')):f.wait_http(port,path)
        serve()
    else:
        assert not STATE.exists(), 'Fixture already recorded; use --resume instead of creating more databases'
        f.main(serve)
except KeyboardInterrupt:
    print('Stopping owned local RC fixture.',flush=True)
finally:
    for name in reversed(f.started):
        subprocess.run(['docker','stop','--timeout','5',name],capture_output=True,timeout=25)
