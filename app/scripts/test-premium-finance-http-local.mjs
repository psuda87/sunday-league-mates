// Real local Auth/Edge/PostgREST. No existing records reset/deleted; fixtures retained.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
const project='slm-premium-real-finance',base='http://127.0.0.1:64321',tag=randomUUID().slice(0,8);
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'feat/premium-real-finance-stage2');
assert.equal(JSON.parse(execFileSync('docker',['inspect','supabase_db_'+project],{encoding:'utf8'}))[0].Config.Labels['com.supabase.cli.project'],project);
const raw=execFileSync('cmd',['/c','npx','--yes','--package=supabase@2.121.0','supabase','status','--workdir','.cache/premium-finance-stack','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const keys=JSON.parse(raw.slice(raw.indexOf('{')));assert.equal(keys.API_URL,base);
function sql(query){return execFileSync('docker',['exec','-i','supabase_db_'+project,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
assert.equal(sql('select active from public.slm_account_model_state'),'f');assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'44');
const uuid=value=>{assert(/^[a-f0-9-]{36}$/.test(value));return "'"+value+"'";};
let passed=0;function check(ok,label){assert(ok,label);passed++;console.log('PASS '+label);}
async function request(path,body,token=keys.SERVICE_ROLE_KEY,key=keys.SERVICE_ROLE_KEY,method='POST'){
 const r=await fetch(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 return {ok:r.ok,status:r.status,data:await r.json().catch(()=>null)};
}
const api=(u,action,values={})=>request('/functions/v1/accounts',{...values,action},u?.session.access_token??keys.ANON_KEY,keys.ANON_KEY);
async function yes(u,action,values={}){const r=await api(u,action,values);assert(r.ok,'Expected '+action+' '+r.status+' '+String(r.data?.code??''));return r.data;}
const write=(u,action,body={})=>yes(u,action,{...body,request_id:randomUUID()});
async function deny(u,action,body={}){const r=await api(u,action,{...body,request_id:randomUUID()});assert(!r.ok,'Unauthorized write/read succeeded: '+action);return r;}
const account=(u,g,user)=>yes(u,'group_finance_account',{group_id:g,...(user?{user_id:user}:{})});
const match=(u,id)=>yes(u,'matches_detail',{event_id:id});
async function create(u,g,name,cost=10000){return (await write(u,'matches_create',{group_id:g,name:name+' '+tag,visibility:'private',date:'2099-01-01',time:'18:00',location:'Synthetic finance pitch',duration_minutes:90,capacity:10,cost_cents:cost})).event_id;}
async function joinGroup(admin,member,g){await write(admin,'groups_invite',{group_id:g,user_id:member.id});const inv=(await yes(member,'groups_inbox')).requests.find(r=>r.group_id===g);await write(member,'groups_decide',{id:inv.id,accept:true});}
// Temporal setup only: advance ONLY our freshly created fixture, never the system clock/functions.
function finishFixture(id,owner){const r=sql(`update public.slm_matches set starts_at=clock_timestamp()-interval '3 hours' where id=${uuid(id)} and created_by=${uuid(owner)} and approved_at is null returning id;`);assert.equal(r,id);}
async function approve(admin,id){const d=await match(admin,id);return write(admin,'group_finance_approve',{event_id:id,expected_version:d.event.version,reason:'Synthetic finished fixture approval'});}
const users=[];for(let n=0;n<4;n++){
 const email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa9!';
 const r=await request('/auth/v1/admin/users',{email,password,email_confirm:true});assert(r.ok,'New synthetic Auth account');
 const u={id:r.data.id,email,password,name:'Finance_'+tag+'_'+n};u.session=await yes(null,'login',{identifier:email,password});
 await yes(u,'save_email_profile',{nickname:u.name,phone:'+48000'+String(Math.floor(Math.random()*900000)+100000),current_password:password});users.push(u);
}
const [admin,player,otherAdmin,reserve]=users;
check(users.every(u=>u.session.user_id===u.id&&u.session.role==='member'),'four real Auth accounts; no global administrator granted');
check(Object.values(await yes(null,'account_capabilities')).every(v=>v===false),'new Auth signup/email model remains inactive');
const ga=(await write(admin,'groups_create',{name:'Finance Alpha '+tag})).group_id,gb=(await write(otherAdmin,'groups_create',{name:'Finance Beta '+tag})).group_id;
await joinGroup(admin,player,ga);await joinGroup(admin,reserve,ga);await joinGroup(otherAdmin,player,gb);
if(process.env.SLM_FINANCE_BROWSER_ONLY!=='1')await core();
if(process.env.SLM_FINANCE_BROWSER==='1'||process.env.SLM_FINANCE_BROWSER_ONLY==='1')await browser();
check(sql('select active from public.slm_account_model_state')==='f','candidate remains inactive after test');
console.log('FINANCE REAL HTTP '+passed+' PASS; real Auth/Edge/PostgREST; new synthetic records retained.');

async function core(){
 const id=await create(admin,ga,'Main finance');await write(player,'matches_join',{event_id:id});
 for(const guest of ['One','Two'])await write(player,'matches_guest',{event_id:id,guest_name:'Synthetic guest '+guest,guest_phone:'',list:'registered'});
 await write(reserve,'matches_reserve',{event_id:id});
 check((await match(player,id)).event.registered_count===3,'own player plus two real guests occupy three places');
 check((await account(player,ga)).dues.length===0,'future/unapproved participation is not a debt');
 await deny(admin,'group_finance_approve',{event_id:id,expected_version:(await match(admin,id)).event.version,reason:'Too early'});check(true,'server rejects approval before actual finish');
 finishFixture(id,admin.id);await approve(admin,id);
 let a=await account(player,ga),due=a.dues.find(d=>d.event_id===id);
 check(due.due_cents===10200&&a.balance_cents===-10200,'server rounds each100/3 share up to34; owner owes102 for self+two guests');
 check(a.registration_allowed,'one match with guests counts as one overdue match');
 check((await account(reserve,ga)).dues.every(d=>d.outstanding_cents===0),'unpromoted reserve has no payable charge');
 await deny(reserve,'group_finance_account',{group_id:ga,user_id:player.id});await deny(otherAdmin,'group_finance_detail',{group_id:ga,event_id:id});
 await deny(otherAdmin,'group_finance_record_payment',{group_id:ga,event_id:id,user_id:player.id,amount_cents:10200,reason:'Forged other group admin'});check(true,'member/foreign administrator cannot read or modify another scope');
 let p=await write(player,'group_finance_submit_payment',{group_id:ga,event_id:id,amount_cents:1000,reason:'Synthetic rejected payment'});
 check((await account(player,ga)).balance_cents===-10200,'pending report does not change balance');
 await write(admin,'group_finance_reject_payment',{group_id:ga,event_id:id,payment_id:p.payment_id,expected_amount_cents:1000,reason:'Synthetic rejection'});
 check((await account(player,ga)).payments.some(x=>x.id===p.payment_id&&x.status==='rejected'),'rejected report remains visible without credit');
 p=await write(player,'group_finance_submit_payment',{group_id:ga,event_id:id,amount_cents:4000,reason:'Synthetic partial payment'});
 const accept={group_id:ga,event_id:id,payment_id:p.payment_id,expected_amount_cents:4000,reason:'Synthetic receipt accepted',request_id:randomUUID()};
 await yes(admin,'group_finance_accept_payment',accept); // intentionally discard first acknowledgement
 await yes(admin,'group_finance_accept_payment',accept);
 a=await account(player,ga);check(a.balance_cents===-6200&&a.dues.find(d=>d.event_id===id).covered_cents===4000,'retry after discarded acknowledgement posts one partial receipt');
 check(Number(sql(`select count(*) from public.slm_group_ledger where payment_id=${uuid(p.payment_id)} and kind='payment'`))===1,'same idempotency UUID writes exactly one ledger credit');
 p=await write(player,'group_finance_submit_payment',{group_id:ga,event_id:id,amount_cents:6200,reason:'Synthetic remainder'});
 const race=await Promise.all([1,2].map(()=>api(admin,'group_finance_accept_payment',{group_id:ga,event_id:id,payment_id:p.payment_id,expected_amount_cents:6200,reason:'Concurrent receipt decision',request_id:randomUUID()})));
 check(race.filter(r=>r.ok).length===1&&race.filter(r=>!r.ok).length===1,'two concurrent decisions have exactly one successful writer');
 check((await account(player,ga)).balance_cents===0&&Number(sql(`select count(*) from public.slm_group_ledger where payment_id=${uuid(p.payment_id)} and kind='payment'`))===1,'concurrent acceptance settles debt once');
 await write(admin,'group_finance_record_payment',{group_id:ga,user_id:player.id,amount_cents:1500,reason:'Synthetic cash overpayment'});
 check((await account(player,ga)).balance_cents===1500,'manual receipt creates real positive overpayment');
 const second=await create(admin,ga,'Second qualifying debt',2700),cross=await create(otherAdmin,gb,'Independent other-group debt',10000),quit=await create(admin,ga,'Existing future registration',1000);
 for(const x of [second,cross,quit])await write(player,'matches_join',{event_id:x});
 finishFixture(second,admin.id);await approve(admin,second);check((await account(player,ga)).registration_allowed,'remaining credit reduces debt but only one qualifying match exists');
 finishFixture(cross,otherAdmin.id);await approve(otherAdmin,cross);
 check(!(await account(player,ga)).registration_allowed&&!(await account(player,gb)).registration_allowed,'two unpaid approved matches block paid signup globally');
 check((await account(player,ga)).balance_cents===-1200&&(await account(player,gb)).balance_cents===-10000,'group balances and credits are isolated');
 const blocked=await create(admin,ga,'Blocked new paid',1000),free=await create(admin,ga,'Allowed free',0);
 await deny(player,'matches_join',{event_id:blocked});await write(player,'matches_join',{event_id:free});
 await write(player,'matches_withdraw',{event_id:quit,participant_id:(await match(player,quit)).participants.find(x=>x.member_id===player.id).id});check(true,'two-debt block denies paid signup but allows free signup and withdrawal');
 await write(otherAdmin,'group_finance_record_payment',{group_id:gb,user_id:player.id,amount_cents:10000,reason:'Synthetic other-group cash receipt'});
 check((await account(player,ga)).registration_allowed,'settling one group removes global block without disclosing other account history');await write(player,'matches_join',{event_id:blocked});
 const direct=await request('/rest/v1/rpc/slm_group_finance_dispatch',{p_user:admin.id,p_session:randomUUID(),p_action:'account',p_body:{group_id:ga,user_id:player.id}},reserve.session.access_token,keys.ANON_KEY);
 const rows=await request('/rest/v1/slm_group_ledger?group_id=eq.'+ga,undefined,otherAdmin.session.access_token,keys.ANON_KEY,'GET');
 const patch=await request('/rest/v1/slm_group_payments?id=eq.'+p.payment_id,{status:'accepted'},reserve.session.access_token,keys.ANON_KEY,'PATCH');
 check(!direct.ok&&(!rows.ok||rows.data.length===0)&&!patch.ok,'direct RPC/REST cannot forge owner, read foreign finance or confirm payment');
 const before=await account(player,ga),count=(await match(admin,id)).participants.length;
 await write(admin,'matches_cancel',{event_id:id,reason:'Synthetic cancellation with retained history'});a=await account(player,ga);
 check(a.balance_cents===before.balance_cents+10200&&a.history.length>before.history.length&&a.payments.length===before.payments.length&&(await match(admin,id)).participants.length===count,'cancellation reverses charges while keeping payments, roster and history');
 await late();
}
async function late(){
 const hour=Number(sql("select extract(hour from clock_timestamp() at time zone 'Europe/Warsaw')::integer"));
 if(hour<17||hour>=23){console.log('NOT TESTED live late17 cutoff: current Warsaw clock outside safe17-23 window; clock untouched');return;}
 const date=sql("select (clock_timestamp() at time zone 'Europe/Warsaw')::date"),id=(await write(admin,'matches_create',{group_id:ga,name:'Real late cutoff '+tag,visibility:'private',date,time:'23:59',location:'Synthetic late pitch',duration_minutes:1,capacity:10,cost_cents:27000})).event_id;
 await write(admin,'matches_join',{event_id:id});await write(player,'matches_join',{event_id:id});for(let i=0;i<8;i++)await write(admin,'matches_guest',{event_id:id,guest_name:'Late guest '+i,guest_phone:'',list:'registered'});
 await write(reserve,'matches_reserve',{event_id:id});let state=await match(admin,id);const first=state.participants.find(p=>p.member_id===null),second=state.participants.find(p=>p.member_id===player.id);
 await write(admin,'matches_withdraw',{event_id:id,participant_id:first.id});await write(player,'matches_withdraw',{event_id:id,participant_id:second.id});
 check(sql(`select bool_and(payable) from public.slm_match_entries where id in (${uuid(first.id)},${uuid(second.id)})`)==='t','real server clock after17 retains responsibility below ten');
 state=await match(reserve,id);check(state.participants.some(p=>p.member_id===reserve.id&&p.status==='reserve'),'late vacancy never auto-promotes reserve');
 await write(reserve,'matches_join',{event_id:id});check(sql(`select replacement_id is not null and not payable from public.slm_match_entries where id=${uuid(first.id)}`)==='t'&&sql(`select payable from public.slm_match_entries where id=${uuid(second.id)}`)==='t','first real replacement releases oldest late withdrawal FIFO');
 await write(admin,'matches_guest',{event_id:id,guest_name:'Second late replacement',guest_phone:'',list:'registered'});check(sql(`select replacement_id is not null and not payable from public.slm_match_entries where id=${uuid(second.id)}`)==='t','second replacement releases the next responsible entry FIFO');
}
async function browser(){
 const g=(await write(admin,'groups_create',{name:'Finance Browser '+tag})).group_id;await joinGroup(admin,player,g);
 const id=await create(admin,g,'Browser finance');await write(player,'matches_join',{event_id:id});for(const guest of ['Browser one','Browser two'])await write(player,'matches_guest',{event_id:id,guest_name:guest,guest_phone:'',list:'registered'});finishFixture(id,admin.id);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const r=spawnSync(process.execPath,['app/scripts/premium-finance-e2e-browser.mjs'],{encoding:'utf8',env,input:JSON.stringify({admin_email:admin.email,admin_password:admin.password,player_email:player.email,player_password:player.password,player_name:player.name,player_id:player.id,other_group_id:gb,group_id:g,event_id:id,tag}),timeout:300000,maxBuffer:12*1024*1024});
 const prefix='FINANCE_BROWSER_RESULT ',line=r.stdout?.split(/\r?\n/).findLast(l=>l.startsWith(prefix));assert(line,'Sanitized browser result missing');const result=JSON.parse(line.slice(prefix.length));console.log('REAL FINANCE BROWSER '+result.passed+' PASS '+result.failed+' FAIL');for(const failure of result.failures??[])console.log(failure);assert.equal(result.failed,0,'Real finance browser flow');
 const a=await account(player,g);check(a.balance_cents===0&&a.dues.find(d=>d.event_id===id).outstanding_cents===0,'actual browser approval/payment decisions settle server balance');
 check(a.payments.filter(p=>p.status==='accepted').length===2,'lost browser response retry never creates a third receipt');
}
