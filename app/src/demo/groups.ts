import type { DemoPlayer, World } from './data';

export interface DemoGroup {id:string;name:string;description:string;adminId:string;creationKey?:string}
export interface Membership {groupId:string;playerId:string;joinedAt:string;organizer:boolean}
export interface GroupRequest {
 id:string;groupId:string;kind:'invite'|'proposal'|'join';status:'pending'|'accepted'|'rejected'|'cancelled';
 targetId:string|null;requestedBy:string;channel:'nick'|'phone';lookupKey?:string;
}
export interface GroupState {groups:DemoGroup[];members:Membership[];requests:GroupRequest[];nextId:number;clock:number}
export type GroupAction =
 |{type:'group_create';name:string;description:string;key:string}
 |{type:'group_invite';groupId:string;targetId:string}
 |{type:'group_phone';groupId:string;phone:string}
 |{type:'group_join';groupId:string}
 |{type:'group_decide';requestId:string;accept:boolean}
 |{type:'group_cancel';requestId:string}
 |{type:'group_permission';groupId:string;targetId:string;allow:boolean}
 |{type:'group_remove'|'group_transfer';groupId:string;targetId:string}
 |{type:'group_leave';groupId:string};
const groupActions=new Set(['group_create','group_invite','group_phone','group_join','group_decide','group_cancel','group_permission','group_remove','group_transfer','group_leave']);
export const isGroupAction=(action:{type:string}):action is GroupAction=>groupActions.has(action.type);
export const foldGroup=(value:string)=>value.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/ł/g,'l').trim();
export function validGroupText(name:string,description:string) {
 return name.trim().length>0&&name.trim().length<=64&&description.trim().length<=180&&
 !Array.from(name+description).some(char=>char.codePointAt(0)!<32||char.codePointAt(0)===127||char==='<'||char==='>');
}
export const membership=(world:World,groupId:string,playerId=world.userId)=>world.groupState.members.find(m=>m.groupId===groupId&&m.playerId===playerId);
export const groupAdmin=(world:World,groupId:string)=>world.groupState.groups.some(g=>g.id===groupId&&g.adminId===world.userId)&&!!membership(world,groupId);
export const groupCanOrganize=(world:World,groupId:string,playerId=world.userId)=>!!membership(world,groupId,playerId)&&(world.groupState.groups.some(g=>g.id===groupId&&g.adminId===playerId)||membership(world,groupId,playerId)!.organizer);
export const groupMembers=(world:World,groupId:string)=>membership(world,groupId)?world.groupState.members.filter(m=>m.groupId===groupId):[];
export const canViewGroupProfile=(world:World,groupId:string,targetId:string)=>!!membership(world,groupId)&&!!membership(world,groupId,targetId);
export function publicGroups(world:World,query:string) {
 if(foldGroup(query).length<2)return [];
 return world.groupState.groups.filter(g=>foldGroup(g.name).includes(foldGroup(query))).map(g=>({id:g.id,name:g.name,description:g.description,count:world.groupState.members.filter(m=>m.groupId===g.id).length}));
}
export function inviteCandidates(world:World,groupId:string,query:string) {
 if(!membership(world,groupId)||foldGroup(query).length<2)return [];
 return world.players.filter(p=>!membership(world,groupId,p.id)&&(foldGroup(p.name).includes(foldGroup(query))||foldGroup(p.nick??'').includes(foldGroup(query)))).slice(0,5).map(p=>({id:p.id,name:p.name,nick:p.nick}));
}
// Deliberately non-dialable fictional Polish contacts 000000001..000000040.
// Never returned by public selectors or rendered in profiles/search results.
export function normalizeDemoContact(value:string):string|null {
 let digits=value.replace(/[\s()-]/g,'');
 if(digits.startsWith('+48'))digits=digits.slice(3);else if(digits.startsWith('0048'))digits=digits.slice(4);
 return /^\d{9}$/.test(digits)?'+48'+digits:null;
}
function contactTarget(players:DemoPlayer[],phone:string) {
 return players.find(p=>'+48'+p.id.slice(1).padStart(9,'0')===phone)?.id??null;
}
export function initialGroups(players:DemoPlayer[]):GroupState {
 const groups=[
  {id:'group-1',name:'Czwartkowe granie',description:'Wieczorne spotkania naszej ekipy · grupa demonstracyjna',adminId:'p01'},
  {id:'group-2',name:'Niedzielne granie',description:'Piłkarskie zakończenie tygodnia · dane fikcyjne',adminId:'p02'},
  {id:'group-3',name:'Stadion po zmroku',description:'Kameralne granie pod reflektorami · demo',adminId:'p03'},
  {id:'group-4',name:'Nowa ekipa',description:'Przykład grupy z jednym członkiem',adminId:'p39'},
 ];
 const members:Membership[]=[];
 const add=(groupId:string,ids:string[])=>ids.forEach((playerId,i)=>members.push({groupId,playerId,joinedAt:new Date(Date.UTC(2026,8,1+i)).toISOString(),organizer:groupId==='group-1'?['p02','p03'].includes(playerId):groupId==='group-2'&&playerId==='p01'}));
 add('group-1',players.slice(0,25).map(p=>p.id));add('group-2',players.slice(0,35).map(p=>p.id));
 add('group-3',['p03','p04','p05','p26','p27','p28','p29','p30']);add('group-4',['p39']);
 return {groups,members,requests:[
  {id:'request-1',groupId:'group-3',kind:'invite',status:'pending',targetId:'p01',requestedBy:'p03',channel:'nick'},
  {id:'request-2',groupId:'group-1',kind:'join',status:'pending',targetId:'p36',requestedBy:'p36',channel:'nick'},
  {id:'request-3',groupId:'group-1',kind:'proposal',status:'pending',targetId:'p37',requestedBy:'p02',channel:'nick'},
 ],nextId:10,clock:100};
}
export function reduceGroups(previous:World,action:GroupAction):World {
 const state=previous.groupState,user=previous.userId;
 if(!previous.players.some(p=>p.id===user))return previous;
 const world={...previous,groupState:structuredClone(state),notice:''},s=world.groupState;
 const nextId=(prefix:string)=>`${prefix}-${s.nextId++}`;
 const member=(groupId:string,playerId=user)=>s.members.find(m=>m.groupId===groupId&&m.playerId===playerId);
 const admin=(groupId:string)=>s.groups.some(g=>g.id===groupId&&g.adminId===user)&&!!member(groupId);
 function addMember(groupId:string,playerId:string) {
  if(member(groupId,playerId)||!world.players.some(p=>p.id===playerId))return;
  s.members.push({groupId,playerId,joinedAt:new Date(Date.UTC(2026,9,19)+s.clock++*1000).toISOString(),organizer:false});
  for(const request of s.requests)if(request.groupId===groupId&&request.targetId===playerId&&request.status==='pending')request.status='cancelled';
 }
 function offer(groupId:string,targetId:string|null,kind:'invite'|'proposal',channel:'nick'|'phone',lookupKey?:string) {
  if(channel==='phone') {
   // A private placeholder has the same outward behaviour for unknown, existing
   // members and already invited contacts; no existence signal is returned.
   if(s.requests.some(r=>r.groupId===groupId&&r.channel==='phone'&&r.lookupKey===lookupKey&&r.status==='pending'))return;
   if(targetId&&(member(groupId,targetId)||(kind==='invite'&&s.requests.some(r=>r.groupId===groupId&&r.targetId===targetId&&r.kind==='invite'&&r.status==='pending'))))targetId=null;
   if(kind==='invite'&&targetId===null&&s.requests.some(r=>r.groupId===groupId&&r.channel==='phone'&&r.lookupKey===lookupKey&&r.kind==='invite'&&r.targetId===null&&r.status==='cancelled'))return;
  } else {
   if(targetId&&member(groupId,targetId))return;
   if(s.requests.some(r=>r.groupId===groupId&&r.status==='pending'&&(kind==='invite'?r.kind==='invite':r.kind!=='join')&&r.targetId===targetId))return;
  }
  s.requests.push({id:nextId('request'),groupId,targetId,requestedBy:user,kind,status:targetId===null&&kind==='invite'?'cancelled':'pending',channel,lookupKey});
 }
 if(action.type==='group_create') {
  if(!validGroupText(action.name,action.description)||!action.key||s.groups.some(g=>g.creationKey===action.key))return previous;
  const id=nextId('group');s.groups.push({id,name:action.name.trim(),description:action.description.trim(),adminId:user,creationKey:action.key});addMember(id,user);
  world.notice='Utworzono grupę w pamięci demo. Jesteś jej administratorem.';return world;
 }
 if(action.type==='group_decide'||action.type==='group_cancel') {
  const r=s.requests.find(r=>r.id===action.requestId&&r.status==='pending');if(!r||!s.groups.some(g=>g.id===r.groupId))return previous;
  if(action.type==='group_cancel') {
   if(r.kind!=='join'||r.requestedBy!==user)return previous;r.status='cancelled';world.notice='Anulowano własną prośbę w demo.';return world;
  }
  if(r.kind==='invite'?r.targetId!==user:!admin(r.groupId))return previous;
  r.status=action.accept?'accepted':'rejected';
  if(action.accept) {
   if(r.kind==='proposal')offer(r.groupId,r.channel==='phone'&&r.lookupKey?contactTarget(world.players,r.lookupKey):r.targetId,'invite',r.channel,r.lookupKey);
   else if(r.targetId)addMember(r.groupId,r.targetId);
  }
  world.notice=action.accept?(r.kind==='proposal'?'Zaakceptowano propozycję. Odbiorca musi jeszcze zaakceptować zaproszenie.':'Zaakceptowano w demo. Członkostwo zostało zaktualizowane.'):'Odrzucono w demo. Nie dodano członka.';return world;
 }
 const group=s.groups.find(g=>g.id===action.groupId);if(!group)return previous;
 if(action.type==='group_join') {
  if(member(group.id)||s.requests.some(r=>r.groupId===group.id&&r.kind==='join'&&r.targetId===user&&r.status==='pending'))return previous;
  s.requests.push({id:nextId('request'),groupId:group.id,kind:'join',targetId:user,requestedBy:user,status:'pending',channel:'nick'});
  world.notice='Wysłano prośbę do administratora grupy · demo.';return world;
 }
 if(action.type==='group_invite'||action.type==='group_phone') {
  if(!member(group.id))return previous;
  if(action.type==='group_invite') {
   if(!world.players.some(p=>p.id===action.targetId)||member(group.id,action.targetId))return previous;
   offer(group.id,action.targetId,admin(group.id)?'invite':'proposal','nick');
   world.notice=admin(group.id)?'Wysłano zaproszenie · wymagana akceptacja odbiorcy.':'Wysłano propozycję do administratora · bez dodawania członka.';
  } else {
   const phone=normalizeDemoContact(action.phone);if(!phone)return previous;
   const target=contactTarget(world.players,phone);
   offer(group.id,target&&!member(group.id,target)?target:null,admin(group.id)?'invite':'proposal','phone',phone);
   world.notice='Jeśli wskazana osoba może otrzymać zaproszenie, zgłoszenie zostanie obsłużone w demo.';
  }
  return world;
 }
 if(action.type==='group_permission') {
  const target=member(group.id,action.targetId);if(!admin(group.id)||!target||action.targetId===group.adminId)return previous;
  target.organizer=action.allow;world.notice=action.allow?'Nadano uprawnienie organizatora w tej grupie.':'Odebrano uprawnienie organizatora w tej grupie.';return world;
 }
 if(action.type==='group_transfer') {
  if(!admin(group.id)||!member(group.id,action.targetId)||action.targetId===user)return previous;
  group.adminId=action.targetId;world.notice='Przekazano administrację grupy · demo.';return world;
 }
 if(action.type!=='group_leave'&&action.type!=='group_remove')return previous;
 const leaving=action.type==='group_leave';
 const targetId=leaving?user:action.targetId;
 if(!member(group.id,targetId)||(!leaving&&(!admin(group.id)||targetId===group.adminId)))return previous;
 s.members=s.members.filter(m=>!(m.groupId===group.id&&m.playerId===targetId));
 for(const r of s.requests)if(r.groupId===group.id&&r.kind==='proposal'&&r.requestedBy===targetId&&r.status==='pending')r.status='cancelled';
 if(leaving&&group.adminId===user) {
  const remaining=s.members.filter(m=>m.groupId===group.id).sort((a,b)=>Number(b.organizer)-Number(a.organizer)||a.joinedAt.localeCompare(b.joinedAt)||a.playerId.localeCompare(b.playerId));
  if(!remaining.length){s.groups=s.groups.filter(g=>g.id!==group.id);s.requests=s.requests.filter(r=>r.groupId!==group.id);world.notice='Opuszczono i usunięto pustą grupę w demo.';return world;}
  group.adminId=remaining[0].playerId;
  world.notice=`Opuszczono grupę. Administrację przejmuje ${world.players.find(p=>p.id===group.adminId)!.name}.`;
 } else world.notice=leaving?'Opuszczono grupę w demo.':'Usunięto członka i jego uprawnienia grupowe w demo.';
 return world;
}
