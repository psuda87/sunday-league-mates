import { initialGroups, isGroupAction, reduceGroups } from './groups';
import type { GroupState, GroupAction } from './groups';
import { validateEvent } from './eventDraft';
import type { EventInput } from './eventDraft';
import { validDemoPortrait } from './portraits';
import type { DemoPortrait } from './portraits';
// Deterministic, fictional, memory-only demo. Never imported by production screens.
export interface DemoPlayer { id: string; name: string; jerseyNumber: number; demoTotals: {goals:number;assists:number;mvp:number}; portrait?: DemoPortrait; portraitEdited?:boolean; nick?:string }
export interface Entry { id: string; playerId: string | null; guestName?: string; inviterId?: string; status: 'registered' | 'reserve' | 'withdrawn'; attendance: boolean | null; paidCents: number }
export interface Game { id: string; name: string; startsAt: string; status: 'upcoming' | 'completed' | 'cancelled'; capacity: number; costCents: number; entries: Entry[]; location?:string; address?:string; durationMinutes?:number; minimum?:number; creationKey?:string; lineup?: {a:string[];b:string[]} }
export interface World { groupState:GroupState; players: DemoPlayer[]; games: Game[]; userId: string; financeRole: 'player'|'admin'; eventRole:'player'|'admin'; nextGameId:number; notice: string }
export const names = ['Alex Nowak','Kamil Zieliński','Marek Lis','Piotr Wójcik','Adrian Maj','Łukasz Wrona','Tomasz Wilk','Oskar Król','Jan Sokół','Filip Góral','Igor Biały','Leon Zając','Dawid Polny','Adam Brzoza','Patryk Las','Rafał Dąb','Michał Sowa','Artur Bór','Daniel Rzeka','Szymon Wiatr','Bruno Gaj','Emil Buk','Norbert Klon','Konrad Grab','Wiktor Cedr','Julian Świerk','Bartosz Cis','Hubert Jawor','Eryk Modrzew','Miłosz Topola','Alan Kasztan','Kacper Jesion','Robert Wiąz','Mateusz Wiśnia','Borys Jodła','Nikodem Lipa','Cezary Orzech','Marcel Deren','Witold Olcha','Dominik Leszczyna'];
export const registered = (game: Game) => game.entries.filter(e => e.status === 'registered');
export const reserves = (game: Game) => game.entries.filter(e => e.status === 'reserve');
export const personName = (world: World, entry: Entry) => world.players.find(p => p.id === entry.playerId)?.name ?? entry.guestName ?? 'Gość bez profilu';
// Entry ids keep guests distinct; selectors remove withdrawn/reserve entries without promoting anyone.
export function teamEntries(game:Game) {
  const active=registered(game),seen=new Set<string>();
  const side=(ids:string[])=>ids.flatMap(id=>{const entry=active.find(e=>e.id===id);if(!entry||seen.has(id))return [];seen.add(id);return [entry];});
  const a=side(game.lineup?.a??[]),b=side(game.lineup?.b??[]);
  return {a,b,unassigned:active.filter(e=>!seen.has(e.id))};
}
function exampleLineup(game:Game) {
  const ids=registered(game).map(e=>e.id);
  return {a:ids.filter((_,i)=>i%2===0),b:ids.filter((_,i)=>i%2===1)};
}
export function charges(game: Game) {
  if(game.status==='cancelled')return [];
  const entries = [...registered(game)].sort((a,b) => a.id.localeCompare(b.id));
  return entries.map((entry,index) => ({ entry, due: Math.floor(game.costCents / entries.length) + (index < game.costCents % entries.length ? 1 : 0) }));
}
export function unpaidGames(world: World, playerId: string) {
  return world.games.filter(game => game.status === 'completed' && charges(game).some(({entry,due}) => (entry.inviterId ?? entry.playerId) === playerId && entry.paidCents < due)).length;
}
export function history(world: World, playerId: string) {
  return world.games.filter(g => g.status === 'completed').flatMap(game => registered(game).filter(e => e.playerId === playerId && e.attendance !== null).map(entry => ({game,entry}))).sort((a,b)=>b.game.startsAt.localeCompare(a.game.startsAt));
}
export function statistics(world: World, playerId: string) {
  const rows=history(world,playerId), played=rows.filter(row=>row.entry.attendance).length;
  return { played, confirmed:rows.length, attendance:rows.length ? Math.round(played/rows.length*100) : null };
}
export function initialWorld(): World {
  // Explicit fictional career totals, not a formula based on attendance or sign-ups.
  const totals=[[2,1,1],[1,2,0],[3,1,1],[1,1,0],[2,0,0],[0,2,0],[1,1,0],[2,1,1],[0,1,0],[1,0,0],[1,1,0],[0,1,0],[1,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
  const players=names.map((name,i)=>({id:`p${String(i+1).padStart(2,'0')}`,name,nick:`slm${String(i+1).padStart(2,'0')}`,jerseyNumber:[10,7,9,4,8,6,11,3,5,14,17,20,21,23,25,27,30,33,40,99][i]??i,demoTotals:{goals:totals[i]?.[0]??0,assists:totals[i]?.[1]??0,mvp:totals[i]?.[2]??0},portrait:{src:'/assets/demo/fictional-portraits.webp',column:(i%2) as 0|1,row:(Math.floor(i/2)%2) as 0|1}}));
  const counts=[12,15,6,0,12,10,14,11,9,0];
  const games:Game[]=counts.map((count,index)=>({ id:`demo-${index+1}`,name:['El Clásico','La Liga','Rondo Cup','Derby','Jesienny sparing','Mecz przyjaźni','Wieczorne granie','Liga koleżeńska','Spotkanie odwołane','Przerwa techniczna'][index]+' · demo',startsAt:index<4?`2026-${index<2?'10':'11'}-${['22','29','05','12'][index]}T${index===0?'16':'17'}:00:00Z`:`2026-10-${String(18-(index-3)*2).padStart(2,'0')}T16:00:00Z`,status:index<4?'upcoming':index<8?'completed':'cancelled',capacity:15,costCents:27000,entries:Array.from({length:count},(_,i)=>({id:`g${index}-e${i}`,playerId:players[(i+(index<4?1:0))%players.length].id,status:'registered' as const,attendance:index>=4&&index<8?(i+index)%5!==0:null,paidCents:0})) }));
  games[0].entries[10]={...games[0].entries[10],playerId:'p19',inviterId:'p02'};
  games[0].entries[11]={...games[0].entries[11],playerId:null,guestName:'Gość Kamila · demo',inviterId:'p02'};
  // Authored fictional payments in cents: paid, partial and unpaid examples.
  [2250,1000,0,2250,0,0,0,0,0,0,900,0].forEach((cents,i)=>{games[0].entries[i].paidCents=cents;});
  for(const id of ['p16','p17']) games[0].entries.push({id:`reserve-${id}`,playerId:id,status:'reserve',attendance:null,paidCents:0});
  for(const game of games.filter(g=>g.status==='completed')) for(const {entry,due} of charges(game)) entry.paidCents=due;
  games[7].entries[3].paidCents=Math.floor(games[7].entries[3].paidCents/2);
  for(const game of [games[0],games[1],...games.slice(4,8)])game.lineup=exampleLineup(game);
  return {groupState:initialGroups(players),players,games,userId:'p01',financeRole:'player',eventRole:'player',nextGameId:11,notice:''};
}
export type Scenario = 'free'|'full'|'joined'|'reserve'|'completed'|'cancelled'|'debt';
export const scenarioGame:Record<Scenario,string>={free:'demo-1',full:'demo-2',joined:'demo-1',reserve:'demo-2',completed:'demo-5',cancelled:'demo-9',debt:'demo-1'};
export const canManageDemoEvents=(world:World)=>world.eventRole==='admin';
export type Action = GroupAction|{type:'event_role';role:'player'|'admin'}|{type:'event_create';input:EventInput;key:string}|{type:'event_update';gameId:string;input:EventInput}|{type:'reset';scenario?:Scenario}|{type:'user';id:string}|{type:'finance_role';role:'player'|'admin'}|{type:'payment_set';gameId:string;entryId:string;cents:number}|{type:'lineup_reset';gameId:string}|{type:'lineup_swap';gameId:string;a:string;b:string}|{type:'identity';playerId:string;name:string}|{type:'portrait';playerId:string;portrait:DemoPortrait}|{type:'jersey';playerId:string;number:number}|{type:'join'|'withdraw'|'guest'|'remove_guest'|'resize'|'attendance'|'pay';gameId:string;entryId?:string;count?:number};
export function reduceWorld(previous:World,action:Action):World {
  if(isGroupAction(action))return reduceGroups(previous,action);
  if(action.type==='reset') {
    const world=initialWorld();
    if(action.scenario==='joined') world.userId='p02';
    if(action.scenario==='reserve') world.games[1].entries.push({id:'demo-user-reserve',playerId:world.userId,status:'reserve',attendance:null,paidCents:0});
    if(action.scenario==='debt') for(const game of world.games.slice(4,6)) for(const e of game.entries) if(e.playerId===world.userId) e.paidCents=0;
    return world;
  }
  if(action.type==='event_role')return {...previous,eventRole:action.role,notice:''};
  if(action.type==='event_create'||action.type==='event_update') {
    if(!canManageDemoEvents(previous))return previous;
    const original=action.type==='event_update'?previous.games.find(g=>g.id===action.gameId):undefined;
    if(action.type==='event_update'&&(!original||original.status!=='upcoming'))return previous;
    if(validateEvent(action.input,original?registered(original).length:0).length)return previous;
    const input={...action.input,name:action.input.name.trim()||'Mecz · demo',location:action.input.location.trim(),address:action.input.address.trim()};
    if(action.type==='event_create') {
      if(!action.key||previous.games.some(g=>g.creationKey===action.key))return previous;
      const game:Game={...input,id:`demo-${previous.nextGameId}`,creationKey:action.key,status:'upcoming',entries:[]};
      return {...previous,games:[game,...previous.games],nextGameId:previous.nextGameId+1,notice:'Utworzono mecz wyłącznie w pamięci demo.'};
    }
    return {...previous,games:previous.games.map(g=>g===original?{...g,...input}:g),notice:'Zapisano zmiany meczu wyłącznie w pamięci demo.'};
  }
  if(action.type==='identity'||action.type==='portrait') {
    if(action.playerId!==previous.userId||!previous.players.some(p=>p.id===action.playerId))return previous;
    if(action.type==='identity'&&!validDemoName(action.name))return previous;
    if(action.type==='portrait'&&!validDemoPortrait(action.portrait))return previous;
    return {...previous,players:previous.players.map(p=>p.id!==action.playerId?p:action.type==='identity'?{...p,name:normalizeDemoName(action.name)}:{...p,portrait:{...action.portrait},portraitEdited:true}),notice:''};
  }
  if(action.type==='jersey') {
    if(action.playerId!==previous.userId||!Number.isInteger(action.number)||action.number<0||action.number>99)return previous;
    const player=previous.players.find(p=>p.id===action.playerId);
    if(!player||player.jerseyNumber===action.number)return previous;
    return {...previous,players:previous.players.map(p=>p.id===action.playerId?{...p,jerseyNumber:action.number}:p),notice:'Zmieniono numer tylko w pamięci demo.'};
  }
  if(action.type==='finance_role')return {...previous,financeRole:action.role,notice:''};
  const world=structuredClone(previous);world.notice='';
  if(action.type==='user'){world.userId=action.id;world.financeRole='player';world.eventRole='player';return world;}
  const game=world.games.find(g=>g.id===action.gameId);if(!game)return previous;
  if(action.type==='lineup_reset') {
    if(game.status==='cancelled'||registered(game).length<2)return previous;
    game.lineup=exampleLineup(game);return world;
  }
  if(action.type==='lineup_swap') {
    const sides=teamEntries(game);
    if(game.status==='cancelled'||!sides.a.some(e=>e.id===action.a)||!sides.b.some(e=>e.id===action.b))return previous;
    game.lineup={a:sides.a.map(e=>e.id===action.a?action.b:e.id),b:sides.b.map(e=>e.id===action.b?action.a:e.id)};
    return world;
  }
  const current=game.entries.find(e=>e.playerId===world.userId&&e.status!=='withdrawn');
  if(action.type==='attendance') {const entry=game.entries.find(e=>e.id===action.entryId);if(game.status==='completed'&&entry?.status==='registered')entry.attendance=!entry.attendance;return world;}
  if(action.type==='pay'||action.type==='payment_set') {
    if(world.financeRole!=='admin'||game.status==='cancelled')return previous;
    const share=charges(game).find(({entry})=>entry.id===action.entryId);if(!share)return previous;
    const cents=action.type==='payment_set'?action.cents:share.due;
    if(!Number.isSafeInteger(cents)||cents<0||cents>100000000)return previous;
    share.entry.paidCents=cents;world.notice='Zmieniono fikcyjną wpłatę tylko w pamięci demo.';return world;
  }
  if(game.status!=='upcoming'){world.notice='Demo: zapisy zamknięte dla tego meczu.';return world;}
  if(action.type==='remove_guest') {
    const guest=game.entries.find(e=>e.id===action.entryId);
    if(!guest||guest.inviterId!==world.userId||guest.status==='withdrawn')return previous;
    guest.status='withdrawn';
    world.notice='Usunięto własnego gościa w demo. Rezerwa nie jest automatycznie awansowana.';
    return world;
  }
  if(action.type==='withdraw'){if(current?.inviterId&&current.inviterId!==world.userId)return previous;if(current)current.status='withdrawn';world.notice='Wycofano zapis w demo. Nikt nie jest automatycznie dopisywany z rezerwy.';return world;}
  if(action.type==='resize') {
    const count=Math.max(0,Math.min(game.capacity,Math.trunc(Number.isFinite(action.count)?action.count!:0)));
    const rows=registered(game);for(const e of rows.slice(count))e.status='withdrawn';
    for(const player of world.players) {if(registered(game).length>=count)break;if(game.entries.some(e=>e.playerId===player.id&&e.status!=='withdrawn'))continue;game.entries.push({id:`resize-${game.id}-${player.id}-${game.entries.length}`,playerId:player.id,status:'registered',attendance:null,paidCents:0});}
    return world;
  }
  if(unpaidGames(world,world.userId)>=2){world.notice='Demo: blokada zapisów — dwa nieopłacone zakończone mecze.';return world;}
  if(action.type==='join') {
    if(current){if(current.status==='reserve'&&registered(game).length<game.capacity){current.status='registered';world.notice='Zajęto wolne miejsce w demo.';}else world.notice='Ten użytkownik jest już na liście demo.';return world;}
    const full=registered(game).length>=game.capacity;
    game.entries.push({id:`join-${world.userId}-${game.entries.length}`,playerId:world.userId,status:full?'reserve':'registered',attendance:null,paidCents:0});
    world.notice=full?'Dołączono do rezerwy w demo.':'Zapisano na mecz w demo.';
  } else if(action.type==='guest') {
    if(current?.status!=='registered'){world.notice='Najpierw zapisz się na mecz w demo.';return world;}
    if(registered(game).length>=game.capacity){world.notice='Brak wolnych miejsc dla gościa w demo.';return world;}
    game.entries.push({id:`guest-${game.id}-${game.entries.length}`,playerId:null,guestName:`Gość ${world.players.find(p=>p.id===world.userId)?.name} · demo`,inviterId:world.userId,status:'registered',attendance:null,paidCents:0});world.notice='Dodano gościa bez konta w demo.';
  }
  return world;
}

// View projection mirrors own-obligation visibility; this is not server authorization.
export function demoFinance(world:World,game:Game) {
 const admin=world.financeRole==='admin',all=charges(game);
 const owns=(entry:Entry)=>(entry.inviterId??entry.playerId)===world.userId;
 const rows=all.filter(({entry})=>admin||owns(entry));
 const retained=game.status==='cancelled'?[]:game.entries.filter(e=>e.status!=='registered'&&e.paidCents>0&&(admin||owns(e)));
 const paid=rows.reduce((sum,{entry})=>sum+entry.paidCents,0)+retained.reduce((sum,e)=>sum+e.paidCents,0);
 const due=game.status==='cancelled'?0:admin?game.costCents:rows.reduce((sum,row)=>sum+row.due,0);
 return {admin,rows,retained,paid,due,remaining:Math.max(0,due-paid),overpaid:Math.max(0,paid-due),percent:due>0?Math.min(100,Math.round(paid/due*100)):0,shares:all.length?{min:Math.min(...all.map(r=>r.due)),max:Math.max(...all.map(r=>r.due))}:null};
}
export function paymentStatus(due:number,paid:number) {return paid>due?'Nadpłata':paid===due?'Opłacono':paid>0?'Częściowo':'Do zapłaty';}
export function parseDemoMoney(value:string):number|null {
 if(!/^\d{1,7}([,.]\d{1,2})?$/.test(value.trim()))return null;
 const [whole,fraction='']=value.trim().replace(',','.').split('.');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return cents<=100000000?cents:null;
}

export const normalizeDemoName=(value:string)=>value.trim().replace(/\s+/gu,' ');
export const validDemoName=(value:string)=>normalizeDemoName(value).length>0&&Array.from(normalizeDemoName(value)).length<=48&&!Array.from(value).some(char=>char.codePointAt(0)!<32||char.codePointAt(0)===127||char==='<'||char==='>');
