"""New isolated fixture only: preserve original43 tests, then verify admin44.
No existing database, Cloud, device, key or real user is changed.
"""
from pathlib import Path
import importlib.util,sys,uuid,subprocess
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'app/scripts'))
spec=importlib.util.spec_from_file_location('fixture',ROOT/'app/scripts/test-lineups-edge-local.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)

def verify(users,group):
 admin,member,second,outsider=users
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

try:f.main(verify)
finally:
 for name in reversed(f.started):subprocess.run(['docker','stop','--timeout','5',name],capture_output=True,timeout=25)
 print('Stopped/retained only NEW admin44 fixture: '+f.NAME,flush=True)
