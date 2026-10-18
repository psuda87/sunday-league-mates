// Deterministic, fictional, memory-only demo. Never imported by production screens.
export interface DemoPlayer { id: string; name: string }
export interface Entry { id: string; playerId: string | null; guestName?: string; inviterId?: string; status: 'registered' | 'reserve' | 'withdrawn'; attendance: boolean | null; paidCents: number }
export interface Game { id: string; name: string; startsAt: string; status: 'upcoming' | 'completed' | 'cancelled'; capacity: number; costCents: number; entries: Entry[] }
export interface World { players: DemoPlayer[]; games: Game[]; userId: string; notice: string }
export const names = ['Alex Nowak','Kamil Zieliński','Marek Lis','Piotr Wójcik','Adrian Maj','Łukasz Wrona','Tomasz Wilk','Oskar Król','Jan Sokół','Filip Góral','Igor Biały','Leon Zając','Dawid Polny','Adam Brzoza','Patryk Las','Rafał Dąb','Michał Sowa','Artur Bór','Daniel Rzeka','Szymon Wiatr'];
export const registered = (game: Game) => game.entries.filter(e => e.status === 'registered');
export const reserves = (game: Game) => game.entries.filter(e => e.status === 'reserve');
export const personName = (world: World, entry: Entry) => world.players.find(p => p.id === entry.playerId)?.name ?? entry.guestName ?? 'Gość bez profilu';
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
  const players=names.map((name,i)=>({id:`p${String(i+1).padStart(2,'0')}`,name}));
  const counts=[12,15,6,0,12,10,14,11,9,0];
  const games:Game[]=counts.map((count,index)=>({ id:`demo-${index+1}`,name:['El Clásico','La Liga','Rondo Cup','Derby','Jesienny sparing','Mecz przyjaźni','Wieczorne granie','Liga koleżeńska','Spotkanie odwołane','Przerwa techniczna'][index]+' · demo',startsAt:index<4?`2026-${index<2?'10':'11'}-${['22','29','05','12'][index]}T${index===0?'16':'17'}:00:00Z`:`2026-10-${String(18-(index-3)*2).padStart(2,'0')}T16:00:00Z`,status:index<4?'upcoming':index<8?'completed':'cancelled',capacity:15,costCents:27000,entries:Array.from({length:count},(_,i)=>({id:`g${index}-e${i}`,playerId:players[(i+(index<4?1:0))%players.length].id,status:'registered' as const,attendance:index>=4&&index<8?(i+index)%5!==0:null,paidCents:0})) }));
  games[0].entries[10]={...games[0].entries[10],playerId:'p19',inviterId:'p02'};
  games[0].entries[11]={...games[0].entries[11],playerId:null,guestName:'Gość Kamila · demo',inviterId:'p02'};
  for(const id of ['p16','p17']) games[0].entries.push({id:`reserve-${id}`,playerId:id,status:'reserve',attendance:null,paidCents:0});
  for(const game of games.filter(g=>g.status==='completed')) for(const {entry,due} of charges(game)) entry.paidCents=due;
  games[7].entries[3].paidCents=Math.floor(games[7].entries[3].paidCents/2);
  return {players,games,userId:'p01',notice:''};
}
export type Scenario = 'free'|'full'|'joined'|'reserve'|'completed'|'cancelled'|'debt';
export const scenarioGame:Record<Scenario,string>={free:'demo-1',full:'demo-2',joined:'demo-1',reserve:'demo-2',completed:'demo-5',cancelled:'demo-9',debt:'demo-1'};
export type Action = {type:'reset';scenario?:Scenario}|{type:'user';id:string}|{type:'join'|'withdraw'|'guest'|'resize'|'attendance'|'pay';gameId:string;entryId?:string;count?:number};
export function reduceWorld(previous:World,action:Action):World {
  if(action.type==='reset') {
    const world=initialWorld();
    if(action.scenario==='joined') world.userId='p02';
    if(action.scenario==='reserve') world.games[1].entries.push({id:'demo-user-reserve',playerId:world.userId,status:'reserve',attendance:null,paidCents:0});
    if(action.scenario==='debt') for(const game of world.games.slice(4,6)) for(const e of game.entries) if(e.playerId===world.userId) e.paidCents=0;
    return world;
  }
  const world=structuredClone(previous);world.notice='';
  if(action.type==='user'){world.userId=action.id;return world;}
  const game=world.games.find(g=>g.id===action.gameId);if(!game)return previous;
  const current=game.entries.find(e=>e.playerId===world.userId&&e.status!=='withdrawn');
  if(action.type==='attendance') {const entry=game.entries.find(e=>e.id===action.entryId);if(game.status==='completed'&&entry?.status==='registered')entry.attendance=!entry.attendance;return world;}
  if(action.type==='pay') {for(const {entry,due} of charges(game)) if(entry.id===action.entryId)entry.paidCents=due;world.notice='Symulacja wpłaty zapisana tylko w pamięci demo.';return world;}
  if(game.status!=='upcoming'){world.notice='Demo: zapisy zamknięte dla tego meczu.';return world;}
  if(action.type==='withdraw'){if(current)current.status='withdrawn';world.notice='Wycofano zapis w demo. Nikt nie jest automatycznie dopisywany z rezerwy.';return world;}
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
