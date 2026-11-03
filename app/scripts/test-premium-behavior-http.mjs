// Real isolated Auth/Edge/PostgREST. New synthetic fixtures only; retained, never reset.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {localKeys,project,base,sql,assertIsolated} from './stabilization-local.mjs';
import {randomUUID,randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
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
 const created=await req('/auth/v1/admin/users',{email,password,email_confirm:true});assert(created.ok,'Synthetic local user');
 const u={id:created.data.id,email,password};u.session=await yes(null,'login',{identifier:email,password});await yes(u,'save_email_profile',{nickname:'Behavior_'+tag+'_'+i,phone:''});users.push(u);
}
const [admin,member,other,outsider]=users;
check(users.every(u=>u.session.role==='member'),'no global administrator roles');
const ga=(await write(admin,'groups_create',{name:'POCO behavior A '+tag})).group_id,gb=(await write(other,'groups_create',{name:'POCO behavior B '+tag})).group_id;
await write(admin,'groups_invite',{group_id:ga,user_id:member.id});const inv=(await yes(member,'groups_inbox')).requests.find(r=>r.group_id===ga);await write(member,'groups_decide',{id:inv.id,accept:true});
const groups=await yes(member,'groups_list');check(groups.groups.some(g=>g.id===ga&&!g.organizer&&g.admin_id!==member.id),'ordinary active member, not organizer/admin');
const create=async(u,g,name,visibility='private',extra={})=>(await write(u,'matches_create',{group_id:g,name:name+' '+tag,visibility,date:'2099-01-01',time:'18:00',location:'Local test pitch',duration_minutes:90,capacity:10,cost_cents:10000,...extra})).event_id;
const own=await create(member,ga,'Member-created','private',{user_id:other.id});check(!!own,'ordinary member creates match');
const privateB=await create(other,gb,'PRIVATE SECRET'),publicB=await create(other,gb,'Public future','public');
const ownPast=await create(admin,ga,'Own history'),groupPast=await create(admin,ga,'Group history'),unrelatedPast=await create(other,gb,'Old public outsider','public');
await write(member,'matches_join',{event_id:own});await write(member,'matches_guest',{event_id:own,guest_name:'Test guest',guest_phone:'',list:'registered'});await write(member,'matches_guest',{event_id:own,guest_name:'Odd guest',guest_phone:'',list:'registered'});
await write(member,'matches_join',{event_id:ownPast});
for(const id of [ownPast,groupPast,unrelatedPast]){assert(/^[a-f0-9-]{36}$/.test(id));sql("update public.slm_matches set starts_at=clock_timestamp()-interval '3 hours' where id='"+id+"'");}
const list=await yes(member,'matches_list');check(list.member_creation_enabled===true,'server capability enables member creation');
const ids=list.events.map(e=>e.id);check(ids.includes(own)&&ids.includes(publicB)&&ids.includes(ownPast)&&ids.includes(groupPast),'current groups and upcoming public included');
check(!ids.includes(privateB)&&!ids.includes(unrelatedPast),'foreign private and unrelated public history absent');
check(!JSON.stringify(list).includes('PRIVATE SECRET'),'private title absent from DTO');
const scoped=await yes(member,'matches_list',{scope:'group',group_id:ga,period:'upcoming'});check(scoped.events.every(e=>e.group_id===ga&&e.starts_at>'2080'),'group/period filters execute in API');
const publicOnly=await yes(member,'matches_list',{scope:'public',period:'upcoming'});check(publicOnly.events.every(e=>e.visibility==='public'),'public scope API filter');
const outList=await yes(outsider,'matches_list');check(outList.events.filter(e=>e.name.endsWith(tag)).length===1&&outList.events.some(e=>e.id===publicB),'outsider sees only upcoming public event');
await deny(outsider,'matches_detail',{event_id:privateB});await deny(member,'matches_detail',{event_id:privateB});await deny(outsider,'matches_create',{group_id:ga,name:'Forbidden',visibility:'public',date:'2099-01-01',time:'18:00',location:'Test',capacity:10,duration_minutes:90,cost_cents:0});
check((await yes(admin,'matches_detail',{event_id:own})).event.can_manage===true,'group administrator retains event finance authority');
const ownDetail=await yes(member,'matches_detail',{event_id:own});check(ownDetail.event.created_by===member.id&&!ownDetail.event.can_manage,'creator UUID correct but no finance privileges');
await deny(member,'group_finance_detail',{event_id:own,group_id:ga});
await deny(member,'group_finance_record_payment',{event_id:own,group_id:ga,user_id:member.id,amount_cents:100,reason:'Forbidden'});
const roleDenial=await deny(member,'groups_permission',{group_id:ga,user_id:member.id,organizer:true});check(roleDenial.status===403,'real group-permission endpoint rejects escalation');
await write(other,'matches_join',{event_id:publicB});
const publicDetail=await yes(member,'matches_detail',{event_id:publicB});check(publicDetail.participants.every(p=>p.contact_phone===null&&p.guest_phone===null),'public roster never exposes nonmember phones');
const direct=await req('/rest/v1/slm_matches?select=*',undefined,'GET',outsider.session.access_token,keys.ANON_KEY);check(!direct.ok||Array.isArray(direct.data)&&direct.data.length===0,'direct REST cannot bypass projection');
const rpc=await req('/rest/v1/rpc/slm_matches_dispatch',{p_user:admin.id,p_session:randomUUID(),p_action:'list',p_body:{}},'POST',outsider.session.access_token,keys.ANON_KEY);check(!rpc.ok,'direct RPC impersonation denied');
const before=await yes(member,'groups_list');check(before.groups.find(g=>g.id===ga).organizer===false,'creation does not mutate group role');
// Revoke membership through the existing voluntary leave API, no SQL membership rewrite.
await write(member,'groups_leave',{group_id:ga});const after=await yes(member,'matches_list');
check(after.events.some(e=>e.id===ownPast&&e.access==='own'&&e.own_history),'own history retained after leaving');
check(!after.events.some(e=>e.id===groupPast||e.id===own),'unrelated former-group history and future private excluded');
const myHistory=await yes(member,'matches_list',{scope:'mine',period:'history'});check(myHistory.events.length===1&&myHistory.events[0].id===ownPast,'server own history filter after leaving');
const history=await yes(member,'matches_detail',{event_id:ownPast});check(history.participants.every(p=>p.responsible_user_id===member.id),'former-group history contains only own entries');
await deny(member,'matches_create',{group_id:ga,name:'Left',visibility:'public',date:'2099-01-01',time:'18:00',location:'Test',duration_minutes:90,capacity:10,cost_cents:0});
// A separate current membership fixture for browser; keep the former-group history above unchanged.
await write(admin,'groups_invite',{group_id:ga,user_id:outsider.id});const invitation=(await yes(outsider,'groups_inbox')).requests.find(r=>r.group_id===ga);await write(outsider,'groups_decide',{id:invitation.id,accept:true});
await deny(null,'account_capabilities');
writeFileSync('.cache/behavior-fixture.json',JSON.stringify({admin_email:admin.email,admin_password:admin.password,member_email:outsider.email,member_password:outsider.password,former_email:member.email,former_password:member.password,group_id:ga,group_name:'POCO behavior A '+tag,event_id:own,private_id:privateB,public_id:publicB,own_past_id:ownPast,tag}));
console.log('HTTP_RESULT '+passed+' PASS; credentials remain in ignored cache only');
