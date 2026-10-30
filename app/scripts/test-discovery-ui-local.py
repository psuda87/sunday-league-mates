"""One NEW network-none GoTrue/Edge/PostgreSQL fixture; discovery + existing lineup browser regression."""
import importlib.util
import json
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import subprocess
import threading
import uuid

spec=importlib.util.spec_from_file_location('lineup_ui',Path(__file__).with_name('test-lineups-ui-local.py'))
ui=importlib.util.module_from_spec(spec);spec.loader.exec_module(ui)
fixture=ui.fixture

def verify(users,group,run_lineups=True):
    # Preserve all existing real browser lineup assertions on the same backend.
    if run_lineups:ui.verify_ui(users,group)
    member,outsider=users[1],users[3]
    tag=uuid.uuid4().hex[:8]
    bulk='Discovery bulk '+tag
    special='Łódź %_ [A] '+tag
    private=fixture.write(member,'matches_create',group_id=group,name='Discovery PRIVATE sentinel',visibility='private',date='2099-01-03',time='18:00',location='Local test',duration_minutes=90,capacity=15,cost_cents=0)['event_id']
    public=fixture.write(member,'matches_create',group_id=group,name=special,visibility='public',date='2099-01-03',time='18:00',location='Local test',duration_minutes=90,capacity=15,cost_cents=0)['event_id']
    fixture.sql("insert into public.slm_matches select (jsonb_populate_record(null::public.slm_matches,to_jsonb(e)||jsonb_build_object('id',gen_random_uuid(),'name','"+bulk+" '||n))).* from public.slm_matches e cross join generate_series(1,105) n where e.id='"+public+"'")
    for user in [member,outsider]:
        result=fixture.account(user,'matches_list',scope='public',period='upcoming',query=bulk,offset=0)
        fixture.check(len(result['events'])==100 and result['next_offset']==100 and result['has_more'],'real HTTP public first100, including user without groups')
        result=fixture.account(user,'matches_list',scope='public',period='upcoming',query=bulk,offset=100)
        fixture.check(len(result['events'])==5 and not result['has_more'] and result['next_offset'] is None,'real HTTP public remaining5')
    fixture.check(not fixture.account(outsider,'matches_list',scope='public',period='upcoming',query='PRIVATE')['events'],'real HTTP search never reveals private sentinel')
    fixture.check(not fixture.account(outsider,'matches_list',scope='groups',period='upcoming')['events'],'real HTTP groups empty for outsider')
    fixture.account(outsider,'matches_detail',expected=404,event_id=private)
    fixture.account(outsider,'lineups_get',expected=404,event_id=public)
    fixture.account(outsider,'group_finance_account',expected=404,group_id=group)
    fixture.check(not fixture.account(outsider,'groups_list')['groups'],'discovery grants no membership, private detail/lineup/finance privileges')
    fixture.account(outsider,'matches_list',expected=400,scope='public',query='x'*101)
    fixture.check(len(fixture.account(outsider,'matches_list',scope='public',period='upcoming',query=special)['events'])==1,'real HTTP Polish and literal special characters')
    class Bridge(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_POST(self):
            if self.path!='/functions/v1/accounts' or not 0<int(self.headers.get('Content-Length','0'))<=12288:
                self.send_error(400);return
            data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            status,payload,_=fixture.http(9000,self.path,data,self.headers.get('Authorization','').removeprefix('Bearer '))
            wire=json.dumps(payload).encode()
            try:
                self.send_response(status or 503);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(wire)));self.end_headers();self.wfile.write(wire)
            except (BrokenPipeError,ConnectionResetError):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),Bridge);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    setup={'proxy':'http://127.0.0.1:'+str(server.server_port),'privateId':private,'bulk':bulk,'special':special,'users':[{'id':u['id'],'refresh':u['session']['refresh_token']} for u in [member,outsider]]}
    try:
        run=subprocess.run(['node','app/scripts/test-discovery-ui-browser.mjs'],cwd=fixture.ROOT,input=json.dumps(setup),text=True,encoding='utf-8',capture_output=True,timeout=300)
        print(run.stdout,end='',flush=True)
        if run.returncode:raise RuntimeError('Discovery browser failed: '+run.stderr[-2000:])
        fixture.check(fixture.sql("select count(*) from public.slm_group_members where user_id='"+outsider['id']+"'")=='0','browser search/detail/logout leave outsider without membership')
    finally:
        server.shutdown();server.server_close();thread.join(timeout=5)

if __name__=='__main__':
    try:fixture.main(verify)
    finally:
        for name in reversed(fixture.started):subprocess.run(['docker','stop','--timeout','5',name],capture_output=True,timeout=25)
        print('Stopped/retained NEW discovery fixture: '+fixture.NAME,flush=True)

