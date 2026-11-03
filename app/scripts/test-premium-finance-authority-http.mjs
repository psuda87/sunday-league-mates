// Real isolated Auth/Edge/PostgREST. New synthetic fixtures only; retained, never reset.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {localKeys,project,base,sql,assertIsolated} from './stabilization-local.mjs';
import {randomUUID,randomBytes} from 'node:crypto';
const tag=randomUUID().slice(0,8);
assertIsolated();const keys=localKeys();
assert.equal(sql("select to_regclass('public.slm_account_model_state') is null"),'t');
let passed=0;function check(ok,label){assert(ok,label);passed++;console.log('PASS '+label);}
async function req(path,body,method='POST',token=keys.SERVICE_ROLE_KEY,key=keys.SERVICE_ROLE_KEY){const r=await fetch(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {ok:r.ok,status:r.status,data:await r.json().catch(()=>null)};}
const api=(u,action,values={})=>req('/functions/v1/accounts',{...values,action},'POST',u?.session.access_token??keys.ANON_KEY,keys.ANON_KEY);
async function yes(u,action,values={}){const r=await api(u,action,values);assert(r.ok,'Expected '+action+' HTTP '+r.status+' '+String(r.data?.code??''));return r.data;}
const write=(u,action,v={})=>yes(u,action,{...v,request_id:randomUUID()});
async function deny(u,action,v={}){const r=await api(u,action,{...v,request_id:randomUUID()});check(!r.ok,'deny '+action);return r;}

const users=[];
for(let i=0;i<4;i++){
 const email=randomUUID()+'@fixture.invalid',password=randomBytes(18).toString('base64url')+'Aa1!';
 const r=await req('/auth/v1/admin/users',{email,password,email_confirm:true});assert(r.ok,'New local fixture user');
 const u={id:r.data.id,email,password};u.session=await yes(null,'login',{identifier:email,password});await yes(u,'save_email_profile',{nickname:'AdminProof_'+tag+'_'+i,phone:''});users.push(u);
}
const [admin,creator,nextAdmin,foreign]=users;
const ga=(await write(admin,'groups_create',{name:'Admin authority A '+tag})).group_id,gb=(await write(foreign,'groups_create',{name:'Admin authority B '+tag})).group_id;
for(const u of [creator,nextAdmin]){await write(admin,'groups_invite',{group_id:ga,user_id:u.id});const i=(await yes(u,'groups_inbox')).requests.find(r=>r.group_id===ga);await write(u,'groups_decide',{id:i.id,accept:true});}
const create=async(u,name)=>(await write(u,'matches_create',{group_id:ga,name:name+' '+tag,visibility:'private',date:'2099-01-01',time:'18:00',location:'Local authority pitch',duration_minutes:90,capacity:10,cost_cents:10000})).event_id;
const id=await create(creator,'Member-created'),adminOwn=await create(admin,'Former-admin-created');
check(!!id,'active ordinary member creates match');await write(creator,'matches_join',{event_id:id});await write(admin,'matches_join',{event_id:id});
let d=await yes(creator,'matches_detail',{event_id:id});
await write(creator,'matches_edit',{event_id:id,group_id:ga,name:'Edited basic info '+tag,visibility:'private',starts_at:d.event.starts_at,location:'Edited local pitch',address:'',duration_minutes:90,capacity:10,cost_cents:10000,expected_version:d.event.version});
d=await yes(creator,'matches_detail',{event_id:id});check(d.event.can_edit&&!d.event.can_manage&&d.event.location==='Edited local pitch','creator edits basic information without finance authority');
await write(admin,'groups_permission',{group_id:ga,user_id:creator.id,organizer:true});
check(!(await yes(creator,'matches_detail',{event_id:id})).event.can_manage,'appointed organizer plus created_by still gives no finance authority');
const own=()=>yes(creator,'group_finance_account',{group_id:ga});check((await own()).surplus===null,'creator reads only own account');
const p=await write(creator,'group_finance_submit_payment',{group_id:ga,event_id:id,amount_cents:2000,reason:'Synthetic own payment'});
const participant=d.participants.find(p=>p.member_id===creator.id).id;
const operations={detail:{},pending:{},approve:{expected_version:d.event.version},cost:{expected_version:d.event.version,amount_cents:12000},charge:{expected_version:d.event.version,participant_id:participant,payable:false},attendance:{expected_version:d.event.version,participant_id:participant,absent:true},record_payment:{user_id:creator.id,amount_cents:500},accept_payment:{payment_id:p.payment_id,expected_amount_cents:2000},reject_payment:{payment_id:p.payment_id,expected_amount_cents:2000},correct_payment:{payment_id:p.payment_id,expected_amount_cents:2000,amount_cents:1500}};
for(const [action,values] of Object.entries(operations)){
 const r=await api(creator,'group_finance_'+action,{group_id:ga,event_id:id,reason:'Denied creator action',request_id:randomUUID(),...values});check(r.status===403,'creator/organizer denied '+action);
}
check((await own()).payments.some(x=>x.id===p.payment_id&&x.status==='pending'),'denied approvals do not alter own pending receipt');
check((await api(creator,'group_finance_account',{group_id:ga,user_id:admin.id})).status===403,'creator cannot read another payer account');
check((await api(foreign,'group_finance_detail',{group_id:ga,event_id:id})).status===403,'administrator of another group cannot read finance');
const forbiddenCreate=await api(foreign,'matches_create',{group_id:ga,name:'Forbidden',visibility:'private',date:'2099-01-01',time:'18:00',location:'Test',duration_minutes:90,capacity:10,cost_cents:0,request_id:randomUUID()});check(forbiddenCreate.status===403,'foreign group administrator cannot create here');
assert(/^[a-f0-9-]{36}$/.test(id));sql("update public.slm_matches set starts_at=clock_timestamp()-interval '3 hours' where id='"+id+"'");
d=await yes(admin,'matches_detail',{event_id:id});await write(admin,'group_finance_approve',{group_id:ga,event_id:id,expected_version:d.event.version,reason:'Synthetic finished approval'});
check((await own()).dues.some(x=>x.event_id===id&&x.outstanding_cents>0),'current admin approves real charges and member reads dues');
const acceptance={group_id:ga,event_id:id,payment_id:p.payment_id,expected_amount_cents:2000,reason:'Synthetic acceptance',request_id:randomUUID()};await yes(admin,'group_finance_accept_payment',acceptance);
check((await own()).payments.find(x=>x.id===p.payment_id)?.status==='accepted','current admin accepts own member receipt');
await write(admin,'group_finance_correct_payment',{group_id:ga,event_id:id,payment_id:p.payment_id,expected_amount_cents:2000,amount_cents:1500,reason:'Synthetic payment correction'});
check((await own()).payments.find(x=>x.id===p.payment_id)?.corrected_amount_cents===1500,'current admin corrects payment with CAS');
d=await yes(admin,'matches_detail',{event_id:id});await write(admin,'group_finance_cost',{group_id:ga,event_id:id,expected_version:d.event.version,amount_cents:12000,reason:'Synthetic cost correction'});
check((await yes(admin,'group_finance_detail',{group_id:ga,event_id:id})).event.cost_cents===12000,'current admin corrects approved cost');
const oldToken=admin.session.access_token;
const rest=async(u)=>req('/rest/v1/slm_group_ledger?group_id=eq.'+ga+'&user_id=eq.'+creator.id+'&select=*',undefined,'GET',u.session.access_token,keys.ANON_KEY);
check((await rest(admin)).data.length>0,'RLS exposes other payer ledger to current admin');
await write(admin,'groups_transfer',{group_id:ga,user_id:nextAdmin.id});
check(admin.session.access_token===oldToken,'role removal test reuses original access token without refresh');
for(const [action,values] of Object.entries(operations)){
 const r=await api(admin,'group_finance_'+action,{group_id:ga,event_id:id,reason:'Denied former admin action',request_id:randomUUID(),...values});check(r.status===403,'former admin denied '+action);
}
check((await api(admin,'group_finance_detail',{group_id:ga,event_id:adminOwn})).status===403,'former admin who created own match and remains organizer cannot manage finance');
check((await api(admin,'group_finance_accept_payment',acceptance)).status===403,'replay of formerly authorized UUID does not bypass revoked role');
check((await yes(admin,'group_finance_account',{group_id:ga})).surplus===null,'former admin falls back to own account projection');
const direct=await rest(admin);check(direct.ok&&direct.data.length===0,'RLS immediately hides other payer ledger from old token');
check((await rest(nextAdmin)).data.length>0,'RLS exposes scope to new current admin without login refresh');
check((await yes(nextAdmin,'group_finance_detail',{group_id:ga,event_id:id})).event.id===id,'new current admin reads event finance');
const p2=await write(creator,'group_finance_submit_payment',{group_id:ga,event_id:id,amount_cents:1000,reason:'Second own payment'});
await write(nextAdmin,'group_finance_accept_payment',{group_id:ga,event_id:id,payment_id:p2.payment_id,expected_amount_cents:1000,reason:'New admin decision'});
check((await own()).payments.find(x=>x.id===p2.payment_id)?.status==='accepted','new admin processes receipt; member retains own submit/history');
for(const u of [nextAdmin,creator]){
 assert(/^[a-f0-9-]{36}$/.test(u.id));sql("update public.slm_account_security set active=false where user_id='"+u.id+"'");
 try{
  const r=await api(u,u===creator?'matches_create':'group_finance_pending',u===creator?{group_id:ga,name:'Inactive',visibility:'private',date:'2099-01-01',time:'18:00',location:'Test',duration_minutes:90,capacity:10,cost_cents:0,request_id:randomUUID()}:{group_id:ga});
  check(r.status===401||r.status===403,'inactive '+(u===creator?'member cannot create':'administrator cannot manage finance'));
  if(u===nextAdmin){const hidden=await rest(u);check(hidden.ok&&hidden.data.length===0,'RLS denies inactive admin reading another payer ledger');}
 }finally{sql("update public.slm_account_security set active=true where user_id='"+u.id+"'");}
}
// Real legacy RPC must not fall back to a global administrative role without a mapped group.
const oldRole=sql("select role from public.slm_roles where user_id='"+foreign.id+"'");
try{sql("update public.slm_roles set role='admin' where user_id='"+foreign.id+"'");check(sql("select slm_private.legacy_finance_manager('"+foreign.id+"')")!=='t','no global legacy-role fallback without current group role');}
finally{assert(['member','admin'].includes(oldRole));sql("update public.slm_roles set role='"+oldRole+"' where user_id='"+foreign.id+"'");}
await write(foreign,'groups_leave',{group_id:gb});check((await api(foreign,'group_finance_pending',{group_id:gb})).status===403,'last admin outside archived group has no finance exception');
check(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','slm_private') and p.prokind='f' and p.proname~'(finance|payment|settlement)' and pg_get_functiondef(p.oid) like '%created_by%'")==='0','deployed financial functions contain no created_by authority');
await deny(null,'account_capabilities');
console.log('ADMIN_AUTHORITY_RESULT '+passed+' PASS; all fixture data retained in isolated55321');
