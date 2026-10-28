// Real local Auth/Edge/PostgREST; only NEW fictional records, retained after test.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
const project='slm-premium-real-events',url='http://127.0.0.1:63321';
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'feat/premium-real-events-stage1');
const container=JSON.parse(execFileSync('docker',['inspect','supabase_db_'+project],{encoding:'utf8'}))[0];assert.equal(container.Config.Labels['com.supabase.cli.project'],project);
const raw=execFileSync('cmd',['/c','npx','--yes','--package=supabase@2.121.0','supabase','status','--workdir','.cache/premium-events-stack','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const keys=JSON.parse(raw.slice(raw.indexOf('{')));assert.equal(keys.API_URL,url);
function sql(q){return execFileSync('docker',['exec','-i','supabase_db_'+project,'psql','-X','-At','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
assert.equal(sql('select active from public.slm_account_model_state'),'f');
assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'44');
let count=0;const check=(value,label)=>{assert(value,label);count++;console.log('PASS '+label);};
async function request(path,body,token=keys.SERVICE_ROLE_KEY,key=keys.SERVICE_ROLE_KEY,method='POST'){
 const r=await fetch(url+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 return {ok:r.ok,status:r.status,data:await r.json().catch(()=>null)};
}
const api=(u,action,values={})=>request('/functions/v1/accounts',{...values,action},u?.session?.access_token??keys.ANON_KEY,keys.ANON_KEY);
async function yes(u,action,values={}){const r=await api(u,action,values);assert(r.ok,'Expected '+action+' HTTP '+r.status+' '+String(r.data?.code??''));return r.data;}
const write=(u,action,values={})=>yes(u,action,{...values,request_id:randomUUID()});
const denied=async(u,action,values={})=>{const r=await api(u,action,{...values,request_id:randomUUID()});assert(!r.ok,'Unexpected authorized '+action);return r;};
const tag=randomUUID().slice(0,8),users=[];
for(let i=0;i<4;i++){
 const email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa9!';
 const r=await request('/auth/v1/admin/users',{email,password,email_confirm:true});assert(r.ok,'Local fictional Auth provisioning');
 const u={id:r.data.id,email,password,nickname:'Real_'+tag+'_'+i};u.session=await yes(null,'login',{identifier:email,password});
 await yes(u,'save_email_profile',{nickname:u.nickname,phone:'+48000'+String(Math.floor(Math.random()*900000)+100000),current_password:password});users.push(u);
}
const [a,b,c,d]=users;
check(users.every(u=>u.session.user_id===u.id),'four independent real Auth users retain their UUID');
const caps=await yes(null,'account_capabilities');check(Object.values(caps).every(v=>v===false),'unfinished account model/signup/email remain disabled');
const ga=await write(a,'groups_create',{name:'Real Alpha '+tag,description:'Synthetic local test'}),gb=await write(d,'groups_create',{name:'Real Beta '+tag});
check((await yes(a,'groups_detail',ga)).group.admin_id===a.id,'group creator is group administrator, not global administrator');
await write(a,'groups_invite',{...ga,user_id:b.id});await denied(b,'groups_detail',ga);check(true,'invitation alone grants no private membership');
const invitation=(await yes(b,'groups_inbox')).requests.find(r=>r.group_id===ga.group_id);await write(b,'groups_decide',{id:invitation.id,accept:true});
check((await yes(a,'groups_detail',ga)).members.some(m=>m.user_id===b.id)&&(await yes(b,'groups_detail',ga)).members.some(m=>m.user_id===a.id),'both users see the same accepted membership');
if(process.env.SLM_PREMIUM_BROWSER_ONLY==='1'){const ui=await write(a,'matches_create',{...ga,name:'Shared browser '+tag,visibility:'private',date:'2099-01-01',time:'18:00',location:'Synthetic browser pitch',duration_minutes:90,capacity:10,cost_cents:27000});await write(a,'matches_join',{event_id:ui.event_id});await runBrowser(a,b,ga,ui);process.exit(0);}
await write(c,'groups_join',ga);const join=(await yes(a,'groups_detail',ga)).requests.find(r=>r.kind==='join'&&r.target_id===c.id);await write(a,'groups_decide',{id:join.id,accept:true});
check((await yes(c,'groups_list')).groups.some(g=>g.id===ga.group_id),'accepted request joins the actual group');
await denied(b,'groups_permission',{...ga,user_id:b.id,organizer:true});await denied(d,'groups_detail',ga);check(true,'member cannot escalate and other group admin cannot read members');
const input={...ga,name:'Shared API '+tag,visibility:'private',date:'2099-01-01',time:'18:00',location:'Synthetic pitch',address:'Synthetic address',duration_minutes:90,capacity:10,cost_cents:27000};
const created=await write(a,'matches_create',input),id=created.event_id;
const first=await yes(a,'matches_detail',{event_id:id}),second=await yes(b,'matches_detail',{event_id:id});
check(first.event.id===id&&second.event.id===id&&second.event.cost_cents===27000,'two real users read the same private match and cost');
await denied(b,'matches_create',{...input,name:'Forbidden create'});check(true,'ordinary group member cannot create a match');
const locked=await yes(d,'matches_detail',{event_id:id});check(locked.event.access==='none'&&locked.participants.length===0&&!Object.hasOwn(locked.event,'registered_count'),'other group sees only the allowed tile, no private roster/counts');
await denied(d,'matches_join',{event_id:id});await denied(b,'matches_join',{event_id:id,user_id:a.id});check(true,'cross-group and forged-owner registrations rejected');
await write(a,'matches_join',{event_id:id});await write(b,'matches_join',{event_id:id});
check((await yes(a,'matches_detail',{event_id:id})).event.registered_count===2,'two accounts occupy two real places');
await write(b,'matches_guest',{event_id:id,guest_name:'Synthetic guest one',guest_phone:'',list:'registered'});await write(b,'matches_guest',{event_id:id,guest_name:'Synthetic guest two',guest_phone:'',list:'registered'});
let state=await yes(a,'matches_detail',{event_id:id});const guests=state.participants.filter(p=>p.member_id===null&&p.responsible_user_id===b.id);
check(guests.length===2&&state.event.registered_count===4,'one and two guest registrations consume actual places and preserve responsible UUID');
await denied(c,'matches_withdraw',{event_id:id,participant_id:guests[0].id});await write(b,'matches_withdraw',{event_id:id,participant_id:guests[0].id});check(true,'only responsible player or authorized administrator withdraws a guest');
await write(c,'matches_reserve',{event_id:id});check((await yes(c,'matches_detail',{event_id:id})).participants.some(p=>p.member_id===c.id&&p.status==='reserve'),'reserve is separate and never auto-promotes even with space');
state=await yes(b,'matches_detail',{event_id:id});await write(b,'matches_withdraw',{event_id:id,participant_id:state.participants.find(p=>p.member_id===b.id&&p.status==='registered').id});
state=await yes(a,'matches_detail',{event_id:id});for(let n=state.event.registered_count;n<9;n++)await write(a,'matches_guest',{event_id:id,guest_name:'Capacity fixture '+n,guest_phone:'',list:'registered'});
const race=await Promise.all([api(b,'matches_join',{event_id:id,request_id:randomUUID()}),api(c,'matches_join',{event_id:id,request_id:randomUUID()})]);
check(race.filter(r=>r.ok).length===1&&race.filter(r=>r.data?.code==='event_full').length===1,'two real HTTP users race for last place; exactly one wins');
const loser=race[0].ok?c:b;state=await yes(loser,'matches_detail',{event_id:id});if(!state.participants.some(p=>p.member_id===loser.id&&p.status==='reserve'))await write(loser,'matches_reserve',{event_id:id});
state=await yes(a,'matches_detail',{event_id:id});await write(a,'matches_withdraw',{event_id:id,participant_id:state.participants.find(p=>p.member_id===a.id&&p.status==='registered').id});
state=await yes(loser,'matches_detail',{event_id:id});check(state.event.registered_count===9&&state.participants.some(p=>p.member_id===loser.id&&p.status==='reserve'),'withdrawal releases a place and keeps reserve unpromoted');
await write(loser,'matches_join',{event_id:id});check((await yes(a,'matches_detail',{event_id:id})).event.registered_count===10,'reserve player explicitly confirms the released place');
const repeat={event_id:id,guest_name:'Idempotent reserve guest',guest_phone:'',list:'reserve',request_id:randomUUID()};const before=(await yes(a,'matches_detail',{event_id:id})).participants.length;await yes(a,'matches_guest',repeat);await yes(a,'matches_guest',repeat);
check((await yes(a,'matches_detail',{event_id:id})).participants.length===before+1,'duplicate HTTP request never duplicates a guest');
const foreign=await write(d,'matches_create',{...input,...gb,name:'Other group match '+tag});await denied(a,'matches_cancel',{event_id:foreign.event_id,reason:'Forbidden'});await denied(a,'group_finance_detail',{...gb,event_id:foreign.event_id});check(true,'other group match management and finances remain isolated');
const rawRpc=await request('/rest/v1/rpc/slm_matches_dispatch',{p_user:a.id,p_session:randomUUID(),p_action:'detail',p_body:{event_id:id}},b.session.access_token,keys.ANON_KEY);
check(!rawRpc.ok,'direct authenticated RPC cannot impersonate owner');
const patch=await request('/rest/v1/slm_group_members?group_id=eq.'+ga.group_id,{organizer:true},b.session.access_token,keys.ANON_KEY,'PATCH');check(!patch.ok,'direct REST membership privilege injection denied');
const roster=await request('/rest/v1/slm_match_entries?event_id=eq.'+id,undefined,d.session.access_token,keys.ANON_KEY,'GET');check(!roster.ok||roster.data.length===0,'direct REST cannot read another group roster');
const accountBefore=await yes(d,'group_finance_account',gb);await write(a,'matches_cancel',{event_id:id,reason:'Synthetic controlled cancellation'});const cancelled=await yes(a,'matches_detail',{event_id:id});
check(cancelled.event.status==='cancelled'&&cancelled.participants.length===before+1,'cancellation preserves guest and participation history');
check(JSON.stringify(await yes(d,'group_finance_account',gb))===JSON.stringify(accountBefore),'another group financial account is unchanged by cancellation');
const ui=await write(a,'matches_create',{...input,name:'Shared browser '+tag});await write(a,'matches_join',{event_id:ui.event_id});
const refreshed=await yes(null,'refresh',{refresh_token:b.session.refresh_token});b.session=refreshed;check(refreshed.user_id===b.id,'server refresh retains identity before shared browser test');
check(sql('select active from public.slm_account_model_state')==='f','candidate Auth is still inactive after all actual API operations');
console.log('PREMIUM REAL HTTP '+count+' PASS; exact new local stack, records retained; no Cloud or fixture Auth.');
async function runBrowser(a,b,ga,ui){
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const r=spawnSync(process.execPath,['app/scripts/premium-events-browser-local.mjs'],{encoding:'utf8',env,input:JSON.stringify({a_email:a.email,a_password:a.password,b_email:b.email,b_password:b.password,a_name:a.nickname,b_name:b.nickname,group_id:ga.group_id,event_id:ui.event_id,tag}),timeout:240000,maxBuffer:8*1024*1024});
 const line=r.stdout?.split(/\r?\n/).findLast(l=>l.startsWith('PREMIUM_BROWSER_RESULT '));assert(line,'Sanitized browser report missing');const result=JSON.parse(line.slice(23));
 console.log('REAL PREMIUM BROWSER '+result.passed+' PASS '+result.failed+' FAIL');for(const message of result.failures??[])console.log(message);assert.equal(result.failed,0,'Actual Premium browser flow must pass');
 const actual=await yes(a,'matches_detail',{event_id:ui.event_id});check(actual.participants.some(p=>p.member_id===b.id&&p.status==='registered'),'browser signup persists in the same server roster seen by first user');
 const matches=(await yes(a,'matches_list')).events;check(matches.some(e=>e.name==='UI created '+tag),'original Premium form actually created a persisted backend match');
}

if(process.env.SLM_PREMIUM_BROWSER==='1')await runBrowser(a,b,ga,ui);
