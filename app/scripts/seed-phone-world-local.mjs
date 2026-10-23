// Persistent, explicitly fictional LOCAL data. No cleanup/reset, mail or saved credentials.
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assertBranch, assertSafeConfig, management, server, url } from './accounts-admin-local.mjs';

const root = new URL('../../', import.meta.url);
const manifestPath = new URL('.cache/phone-test-world.json', root);
const names = ['Adam Kapitan', 'Bartek Organizator', 'Cezary Obrońca', 'Damian Pomocnik',
  'Emil Napastnik', 'Filip Bramkarz', 'Grzegorz Skrzydłowy', 'Hubert Rezerwowy',
  'Igor Strzelec', 'Jakub Zaległości', 'Kamil Gościnny', 'Leon Spokojny',
  'Marek Rywal', 'Norbert Rywal'];
const state = { run:randomUUID(), createdAt:new Date().toISOString(), stage:'starting', users:[], groups:[], events:[], payments:[] };
const sessions = [], secrets = [];
let api;
async function save() { await writeFile(manifestPath, JSON.stringify(state, null, 2) + '\n'); }
async function rest(path, method='GET', body) {
  const result = await api.request(path, method, body);
  if (!result.ok) throw new Error(`Local fixture ${method} failed (${result.status}); sensitive response suppressed`);
  return result.data;
}
async function call(actor, action, body={}) {
  const session = sessions[actor];
  const response = await fetch(url+'/functions/v1/accounts', {
    method:'POST', headers:{'Content-Type':'application/json', ...(session?{Authorization:'Bearer '+session.access_token}:{})},
    body:JSON.stringify({...body, action}), signal:AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${action}: HTTP ${response.status}, ${result.code??'unknown'}; credentials suppressed`);
  return result;
}
const write = (actor, action, body) => call(actor, action, {...body, request_id:randomUUID()});
const instant = days => new Date(Date.now()+days*86400000).toISOString();
async function createGroup(owner, name, members) {
  const group = await write(owner,'groups_create',{name, description:'Wyłącznie fikcyjne dane do lokalnych testów telefonu. Bez prawdziwych opłat.'});
  const record = { id:group.group_id, name, owner, members:[owner] }; state.groups.push(record); await save();
  for (const member of members.filter(i=>i!==owner)) {
    await write(owner,'groups_invite',{group_id:record.id,user_id:state.users[member].id});
    const invite=(await call(member,'groups_inbox')).requests.find(r=>r.group_id===record.id&&r.state==='pending');
    if (!invite) throw new Error('Own fixture invitation not found');
    await write(member,'groups_decide',{id:invite.id,accept:true}); record.members.push(member);
  }
  await save(); return record;
}
async function future(group, label, days, count, visibility='private', capacity=14, reserve=0, guests=0) {
  const result=await write(group.owner,'matches_create',{group_id:group.id,name:'TEST · '+label,
    starts_at:instant(days), location:'Fikcyjne boisko testowe · bez rezerwacji', duration_minutes:90,capacity,cost_cents:27000,visibility});
  const event={id:result.event_id, groupId:group.id, name:label,kind:'future'};state.events.push(event);await save();
  for (const member of group.members.slice(0,count)) await write(member,'matches_join',{event_id:event.id});
  for(let i=0;i<guests;i++)await write(group.owner,'matches_guest',{event_id:event.id,guest_name:'TEST Gość '+(i+1),guest_phone:'',list:'registered'});
  for(const member of group.members.slice(count,count+reserve))await write(member,'matches_reserve',{event_id:event.id});
  if(reserve)await write(group.owner,'matches_guest',{event_id:event.id,guest_name:'TEST Gość na rezerwie',guest_phone:'',list:'reserve'});
  return event;
}
async function payment(group,event,member,amount,pending=false) {
  const action=pending?'group_finance_submit_payment':'group_finance_record_payment';
  const actor=pending?member:group.owner;
  const result=await write(actor,action,{group_id:group.id,event_id:event.id,user_id:state.users[member].id,amount_cents:amount,reason:'TEST · fikcyjna wpłata, bez rzeczywistego przelewu'});
  state.payments.push({id:result.payment_id,eventId:event.id,amountCents:amount,pending});await save();return result;
}
async function history(group,label,days,cost,members,mode='mixed') {
  // New past fixture snapshot only. Never redate an existing match or change server time.
  const id=randomUUID(), starts=instant(-days);
  await rest('/rest/v1/slm_matches','POST',{id,group_id:group.id,created_by:state.users[group.owner].id,
    name:'TEST · '+label,visibility:'private',starts_at:starts,location:'Fikcyjna historia testowa · bez prawdziwego meczu',
    duration_minutes:90,capacity:14,cost_cents:cost});
  const event={id,groupId:group.id,name:label,kind:'historical-fixture'};state.events.push(event);await save();
  const entries=members.map((member,index)=>({event_id:id,member_id:state.users[member].id,responsible_user_id:state.users[member].id,
    status:'registered',payable:true,absent:index===2,joined_at:new Date(Date.parse(starts)-3600000).toISOString()}));
  await rest('/rest/v1/slm_match_entries','POST',entries);
  await write(group.owner,'group_finance_approve',{event_id:id,expected_version:1,reason:'TEST · zatwierdzenie nowego historycznego fixture'});
  const share=Math.ceil(cost/members.length/100)*100;
  for(let i=0;i<members.length;i++) {
    if(mode==='paid'||i<6)await payment(group,event,members[i],share);
    else if(i===6)await payment(group,event,members[i],1000);
    else if(i===7)await payment(group,event,members[i],share,true);
  }
  return event;
}

try {
  assertBranch(); assertSafeConfig(await management('/config/auth')); api=await server();
  try { const previous=JSON.parse(await readFile(manifestPath,'utf8'));
    console.log(`Existing local world retained (${previous.stage}). No accounts, payments or events duplicated.`);process.exit(0);
  } catch(error) { if(error.code!=='ENOENT')throw error; }
  const users=(await rest('/auth/v1/admin/users?page=1&per_page=1000')).users;
  const target=users.find(user=>user.email==='phone-owner@phone-fixture.invalid');
  if(!target?.email_confirmed_at)throw new Error('Confirmed local phone-owner fixture required; no existing account changed');
  state.targetId=target.id;
  await mkdir(new URL('.cache/',root),{recursive:true});await save();
  for(let i=0;i<names.length;i++) {
    const email=`slm-seed-${state.run.slice(0,8)}-${String(i+1).padStart(2,'0')}@phone-fixture.invalid`;
    const password=randomBytes(24).toString('base64url')+'Aa1!';secrets.push(password);
    const user=await rest('/auth/v1/admin/users','POST',{email,password,email_confirm:true});
    state.users.push({id:user.id,email,name:'TEST '+names[i]});await save();
    sessions[i]=await call(i,'login',{identifier:email,password});
    if(sessions[i].role!=='member')throw new Error('Fixture must not have global admin');
    await call(i,'save_email_profile',{nickname:'TEST '+names[i],phone:'',current_password:password});
  }
  console.log('PASS: 14 fictional local players; all ordinary accounts, no mail/SMS.');
  const training=await createGroup(0,'TEST · España — treningi',[...Array(12).keys()]);
  const league=await createGroup(1,'TEST · Liga — mecze i opłaty',[...Array(11).keys()].map(i=>i+1));
  const rivals=await createGroup(12,'TEST · Rywale — prywatność',[10,11,12,13]);
  await write(0,'groups_permission',{group_id:training.id,user_id:state.users[1].id,organizer:true});
  console.log('PASS: 3 fictional groups; membership accepted by each generated player.');
  await future(training,'Trening — wolne miejsca',4,7,'private',14,2,1);
  await future(training,'Pełny mecz — sprawdź rezerwę',6,9,'private',10,3,1);
  await future(training,'Publiczny sparing',8,5,'public',14,1,1);
  const cancelled=await future(training,'Odwołany mecz',10,4);
  await write(0,'matches_cancel',{event_id:cancelled.id,reason:'TEST · fikcyjne odwołanie'});
  await future(league,'Liga — zapisy otwarte',5,6,'public',14,1,1);
  await future(league,'Liga — mecz członków',9,5);
  await future(rivals,'Prywatny mecz rywali',7,3);
  await future(rivals,'Otwarty mecz rywali',11,3,'public');
  console.log('PASS: 8 upcoming/cancelled matches, registered players, guests and separate reserves.');
  await history(training,'Historia — częściowe i oczekujące wpłaty',3,27000,[...Array(10).keys()]);
  await history(training,'Historia — rozliczone, nadwyżka 5 zł',5,24500,[...Array(10).keys()],'paid');
  await history(league,'Historia — zaległości w drugiej grupie',7,20000,[...Array(10).keys()].map(i=>i+1));
  console.log('PASS: 3 new historical fixtures approved by real finance API; partial/pending/accepted payments and group surplus.');
  // Existing phone user receives invitations, never forced membership or unsolicited debt.
  for(const group of [training,league])await write(group.owner,'groups_invite',{group_id:group.id,user_id:target.id});
  state.stage='ready-awaiting-invitations';await save();
  console.log('READY: phone account invited to TEST España and TEST Liga. Refresh Groups and accept invitations.');
  console.log('Waiting up to 20 minutes: after acceptance, España group administration will be transferred to the phone account.');
  const until=Date.now()+20*60000;
  let trainingAccepted=false,leagueAccepted=false;
  while(Date.now()<until) {
    const a=await call(0,'groups_detail',{group_id:training.id});
    const b=await call(1,'groups_detail',{group_id:league.id});
    trainingAccepted=a.members.some(member=>member.user_id===target.id);
    leagueAccepted=b.members.some(member=>member.user_id===target.id);
    if(trainingAccepted)break;
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  if(trainingAccepted) {
    // One own debt, below the global two-match block; only after voluntary membership.
    state.users.push({id:target.id,name:'Existing local phone fixture'});
    const targetIndex=state.users.length-1;
    const own=await history(training,'Twój przykład — pozostało 17 zł',2,27000,[...Array(9).keys(),targetIndex],'target');
    // history() leaves the tenth member unpaid; record 10 PLN toward their real 27 PLN share.
    await payment(training,own,targetIndex,1000);
    await write(0,'groups_transfer',{group_id:training.id,user_id:target.id});
    state.transferredGroupId=training.id;
    console.log('PASS: phone account is now admin of TEST España only; one sample own due (17 PLN outstanding).');
  }
  state.stage=trainingAccepted?'complete':'ready-invitations-pending';state.leagueAccepted=leagueAccepted;await save();
  // Log out only newly generated fixture sessions. Existing phone session is never accessed.
  for(let i=0;i<sessions.length;i++)await call(i,'logout').catch(()=>{});
  secrets.fill(null);sessions.fill(null);
  console.log(`DONE: ${state.events.length} matches retained, ${state.payments.length} fictional payments. No existing data removed.`);
  console.log('Local non-secret manifest: '+fileURLToPath(manifestPath));
} catch(error) {
  state.stage='incomplete';state.lastError=error.message;await save().catch(()=>{});
  console.error('STOP: '+error.message);console.error('Existing data and any created fixtures retained; no automatic cleanup/reset.');process.exitCode=1;
} finally { secrets.fill(null);sessions.fill(null); }
