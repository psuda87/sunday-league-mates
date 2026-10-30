// Actual existing local project only. Creates NEW tagged fictional fixtures;
// never edits old users/passwords. No Docker project/container creation.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID, randomBytes} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const project = 'slm-main-stabilization', base = 'http://127.0.0.1:55321';
const inspect = name => JSON.parse(execFileSync('docker', ['inspect', name], {encoding:'utf8'}))[0];
const db = inspect('supabase_db_' + project);
assert.equal(db.Config.Labels['com.supabase.cli.project'], project);
assert.equal(execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),'chore/local-live-backend');
const env = Object.fromEntries(inspect('supabase_edge_runtime_' + project).Config.Env.map(s => {const n=s.indexOf('='); return [s.slice(0,n),s.slice(n+1)];}));
assert.equal(env.SUPABASE_URL,'http://kong:8000');
const anon=env.SUPABASE_ANON_KEY, service=env.SUPABASE_SERVICE_ROLE_KEY;
assert(anon && service);
function sql(query) {return execFileSync('docker',['exec','-i','supabase_db_'+project,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
const oldUsers=JSON.parse(sql("select coalesce(json_object_agg(id,md5(to_jsonb(u)::text)),'{}') from auth.users u"));
let passed=0;
function check(value,label) {assert(value,label);passed++;console.log('PASS '+label);}
async function request(path,body,token=anon,method='POST',origin='https://localhost') {
 const r=await fetch(base+path,{method,headers:{apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:origin},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,ok:r.ok,cors:r.headers.get('access-control-allow-origin'),data:await r.json().catch(()=>null)};
}
async function account(u,action,body={},expected=200) {
 const r=await request('/functions/v1/accounts',{action,...body},u?.session.access_token??anon);
 assert.equal(r.status,expected,'accounts '+action+' returned '+r.status+' '+String(r.data?.code??''));return r.data;
}
const write=(u,action,body={})=>account(u,action,{...body,request_id:randomUUID()});
const run=randomUUID().slice(0,8), users=[];
for (let i=0;i<4;i++) {
 const email='slm.live.'+run+'.'+i+'@fixture.invalid',password=randomBytes(18).toString('base64url')+'Aa1!';
 const r=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true})});
 assert(r.ok,'Create new local fictional user');const created=await r.json();
 const u={id:created.id,email,password};u.session=await account(null,'login',{identifier:email,password});
 await account(u,'save_email_profile',{nickname:'LIVE_'+run+'_'+i,phone:''});users.push(u);
}
const [admin,member,second,outsider]=users;
check(users.every(u=>u.session.access_token && u.session.refresh_token),'four real GoTrue logins through accounts; existing accounts untouched');
await account(member,'status');
const refreshed=await account(null,'refresh',{refresh_token:member.session.refresh_token});member.session=refreshed;
check(!!refreshed.access_token,'real refresh and server session recheck');
const group=(await write(admin,'groups_create',{name:'SLM LIVE test '+run})).group_id;
for (const u of [member,second]) {
 await write(admin,'groups_invite',{group_id:group,user_id:u.id});
 const inbox=await account(u,'groups_inbox');const invitation=inbox.requests.find(x=>x.group_id===group);
 await write(u,'groups_decide',{id:invitation.id,accept:true});
}
check((await account(member,'groups_list')).groups.some(x=>x.id===group),'real group creation, invitation, consent and membership');
const event=(await write(member,'matches_create',{group_id:group,name:'LIVE POCO '+run,visibility:'private',date:'2099-01-01',time:'18:00',location:'Lokalne boisko testowe',duration_minutes:90,capacity:15,cost_cents:0})).event_id;
for (const u of [member,second]) await write(u,'matches_join',{event_id:event});
for (let i=0;i<9;i++) await write(member,'matches_guest',{event_id:event,guest_name:'Gosc LIVE '+i,list:'registered'});
await write(member,'matches_guest',{event_id:event,guest_name:'Rezerwa LIVE',list:'reserve'});
const detail=await account(member,'matches_detail',{event_id:event});
check(detail.participants.filter(x=>x.status==='registered').length===11 && detail.participants.filter(x=>x.status==='reserve').length===1,'real match, registrations, distinct guests and separate reserve');
const get=(u=member)=>account(u,'lineups_get',{event_id:event});
const payload=(s,a,b)=>({event_id:event,expected_version:s.version,expected_roster_version:s.roster_version,team_a:a,team_b:b,request_id:randomUUID()});
const s=await get(), ids=s.unassigned;
check(s.version===0 && ids.length===11 && !s.last_change,'lineups GET uses live registered roster; reserve excluded');
const initial=payload(s,ids.filter((_,i)=>i%2===0),ids.filter((_,i)=>i%2));
const saved=await account(member,'lineups_save',initial);
check(saved.version===1 && saved.changed && saved.last_change.user_id===member.id && (await get(second)).team_a.length===6,'ordinary member persists 6:5 and second GoTrue client reads it');
const noop=await account(second,'lineups_save',payload(await get(),[...saved.team_a].reverse(),saved.team_b));
check(!noop.changed && JSON.stringify(noop.last_change)===JSON.stringify(saved.last_change) && noop.version===1,'no-op preserves author, time and version');
const replay=await account(member,'lineups_save',initial);
check(replay.replayed && replay.version===1,'identical request_id replays original committed receipt');
await account(member,'lineups_save',{...initial,team_a:[]},409);
check(true,'request_id reuse with different body is rejected');
await account(outsider,'lineups_get',{event_id:event},404);
await account(outsider,'lineups_save',payload(await get(),[],ids),404);
await account(member,'lineups_save',{...payload(await get(),[],ids),updated_by:outsider.id},400);
check(true,'private outsider and forged author rejected');
const current=await get();
const race=await Promise.all([request('/functions/v1/accounts',{action:'lineups_save',...payload(current,current.team_b,current.team_a)},member.session.access_token),request('/functions/v1/accounts',{action:'lineups_save',...payload(current,[],ids)},second.session.access_token)]);
check(race.map(r=>r.status).sort().join(',')==='200,409','concurrent real Edge writes: one commit and one conflict');
const stale=await get();await write(member,'matches_guest',{event_id:event,guest_name:'Nowy gosc roster',list:'registered'});
await account(member,'lineups_save',payload(stale,[],ids),409);
await account(member,'lineups_save',payload(await get(),[randomUUID()],[]),400);
check(true,'stale roster and foreign participation UUID rejected');
const fresh=await get(), registered=[...fresh.team_a,...fresh.team_b,...fresh.unassigned].filter(id=>!fresh.stale_entry_ids.includes(id));
await account(member,'lineups_save',payload(fresh,registered.filter((_,i)=>i%2===0),registered.filter((_,i)=>i%2)));
const raw=await request('/rest/v1/slm_match_lineups?select=*',undefined,member.session.access_token,'GET');
const direct=await request('/rest/v1/rpc/slm_lineups_dispatch',{p_user:admin.id,p_session:randomUUID(),p_action:'get',p_body:{event_id:event}},member.session.access_token);
check([401,403,404].includes(raw.status)&&[401,403,404].includes(direct.status),'actual GoTrue JWT cannot bypass RLS/ACL or invoke service RPC');
await account(member,'group_finance_detail',{group_id:group,event_id:event},403);
await account(member,'group_finance_account',{group_id:group});
await account(admin,'group_finance_detail',{group_id:group,event_id:event});
check(true,'ordinary member sees own finance; only current group admin sees administration');
// Separate financial event; only this run's synthetic rows are adjusted.
const financial=(await write(member,'matches_create',{group_id:group,name:'Finance LIVE '+run,visibility:'private',date:'2099-01-02',time:'18:00',location:'Test finances',duration_minutes:90,capacity:10,cost_cents:10000})).event_id;
await write(member,'matches_join',{event_id:financial});
const payment=await write(member,'group_finance_submit_payment',{group_id:group,event_id:financial,amount_cents:2000,reason:'New local synthetic test payment'});
assert(/^[a-f0-9-]{36}$/.test(financial));sql("update public.slm_matches set starts_at=clock_timestamp()-interval '3 hours' where id='"+financial+"' and created_by='"+member.id+"'");
const fd=await account(admin,'matches_detail',{event_id:financial});
await write(admin,'group_finance_approve',{group_id:group,event_id:financial,expected_version:fd.event.version,reason:'Local synthetic approval'});
await write(admin,'group_finance_accept_payment',{group_id:group,event_id:financial,payment_id:payment.payment_id,expected_amount_cents:2000,reason:'Local synthetic acceptance'});
const own=await account(member,'group_finance_account',{group_id:group});
check(own.dues.some(x=>x.event_id===financial) && own.payments.some(x=>x.id===payment.payment_id&&x.status==='accepted'),'real charges, submitted payment, current-admin approval and own balance');
await write(second,'groups_leave',{group_id:group});
await account(second,'lineups_get',{event_id:event},404);
check(true,'old live token loses private lineup access after membership removal');
await account(outsider,'logout');await account(outsider,'status',{},401);
check(true,'revoked real session denied');
const deniedOrigin=await request('/functions/v1/accounts',{action:'status'},member.session.access_token,'POST','https://not-allowed.invalid');
check(deniedOrigin.status===403,'actual Edge rejects unapproved web origin');
const afterUsers=JSON.parse(sql("select coalesce(json_object_agg(id,md5(to_jsonb(u)::text)),'{}') from auth.users u"));
check(Object.entries(oldUsers).every(([id,value])=>afterUsers[id]===value),'all pre-existing Auth user rows/password hashes unchanged');
const privateDir=resolve(root,'.cache/live-backend/poco-fixture');mkdirSync(privateDir,{recursive:true});
if(process.platform==='win32') {
 const identity=execFileSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8'});const sid=identity.match(/S-1-[0-9-]+/)[0];
 execFileSync('icacls',[privateDir,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F'],{stdio:'pipe'});
}
writeFileSync(resolve(privateDir,'account.private.json'),JSON.stringify({project,api:base,groupId:group,eventId:event,admin:{login:admin.email,password:admin.password},member:{login:member.email,password:member.password}},null,2));
console.log('RESULT '+passed+' PASS; real Kong -> GoTrue/accounts Edge -> PostgREST/PostgreSQL. New fixtures retained for POCO; credentials only in owner-private ignored file.');
