import { describe, expect, it } from 'vitest';
import { charges, history, initialWorld, reduceWorld, registered, reserves, statistics, unpaidGames, teamEntries, demoFinance, parseDemoMoney, paymentStatus } from './data';
import type { World } from './data';
function coherent(world:World) {
  expect(world.players).toHaveLength(20);expect(world.games).toHaveLength(10);
  for(const game of world.games){
    expect(registered(game).length).toBeLessThanOrEqual(game.capacity);
    const active=game.entries.filter(e=>e.status!=='withdrawn'&&e.playerId);
    expect(new Set(active.map(e=>e.playerId)).size).toBe(active.length);
    for(const entry of game.entries){if(entry.playerId)expect(world.players.some(p=>p.id===entry.playerId)).toBe(true);if(entry.inviterId)expect(world.players.some(p=>p.id===entry.inviterId)).toBe(true);}
    const shares=charges(game);expect(shares.every(s=>Number.isInteger(s.due))).toBe(true);
    expect(shares.reduce((sum,s)=>sum+s.due,0)).toBe(shares.length?game.costCents:0);
    if(shares.length)expect(Math.max(...shares.map(s=>s.due))-Math.min(...shares.map(s=>s.due))).toBeLessThanOrEqual(1);
  }
}
describe('isolated demo world',()=>{
  it('is deterministic, coherent and derives history/statistics from confirmed attendance',()=>{
    const world=initialWorld();expect(world).toEqual(initialWorld());coherent(world);
    for(const player of world.players){const stats=statistics(world,player.id),rows=history(world,player.id);expect(stats.confirmed).toBe(rows.length);expect(stats.played).toBe(rows.filter(r=>r.entry.attendance).length);}
  });
  it('joins once, withdraws without promoting reserves and adds a guest without creating an account',()=>{
    let world=initialWorld();world=reduceWorld(world,{type:'join',gameId:'demo-1'});world=reduceWorld(world,{type:'join',gameId:'demo-1'});expect(registered(world.games[0])).toHaveLength(13);
    world=reduceWorld(world,{type:'guest',gameId:'demo-1'});expect(registered(world.games[0])).toHaveLength(14);expect(world.games[0].entries.at(-1)?.playerId).toBeNull();expect(world.games[0].entries.at(-1)?.inviterId).toBe('p01');
    world=reduceWorld(world,{type:'withdraw',gameId:'demo-1'});expect(registered(world.games[0])).toHaveLength(13);expect(reserves(world.games[0])).toHaveLength(2);coherent(world);
  });
  it('handles full/reserve/claim, cancellation and deterministic resize without exceeding capacity',()=>{
    let world=reduceWorld(initialWorld(),{type:'join',gameId:'demo-2'});expect(reserves(world.games[1])[0].playerId).toBe('p01');
    world=reduceWorld(world,{type:'resize',gameId:'demo-2',count:14});world=reduceWorld(world,{type:'join',gameId:'demo-2'});expect(registered(world.games[1])).toHaveLength(15);expect(reserves(world.games[1])).toHaveLength(0);
    for(const count of [0,10,15,99,-3,12]){world=reduceWorld(world,{type:'resize',gameId:'demo-1',count});coherent(world);}
    const before=world.games[8].entries;world=reduceWorld(world,{type:'join',gameId:'demo-9'});expect(world.games[8].entries).toEqual(before);expect(charges(world.games[8])).toHaveLength(0);
  });
  it('blocks only on two completed debts and unlocks after a simulated payment',()=>{
    let world=reduceWorld(initialWorld(),{type:'reset',scenario:'debt'});expect(unpaidGames(world,'p01')).toBe(2);
    world=reduceWorld(world,{type:'join',gameId:'demo-1'});expect(registered(world.games[0])).toHaveLength(12);
    const game=world.games[4],entry=game.entries.find(e=>e.playerId==='p01')!;
    world=reduceWorld(world,{type:'finance_role',role:'admin'});world=reduceWorld(world,{type:'pay',gameId:game.id,entryId:entry.id});expect(unpaidGames(world,'p01')).toBe(1);
    const paid=world.games[4].entries[0].paidCents;world=reduceWorld(world,{type:'finance_role',role:'admin'});world=reduceWorld(world,{type:'pay',gameId:game.id,entryId:entry.id});expect(world.games[4].entries[0].paidCents).toBe(paid);
    world=reduceWorld(world,{type:'join',gameId:'demo-1'});expect(registered(world.games[0])).toHaveLength(13);coherent(world);
  });
  it('updates attendance statistics and resets every mutation',()=>{
    let world=initialWorld();const entry=world.games[4].entries[0],before=statistics(world,'p01');world=reduceWorld(world,{type:'attendance',gameId:'demo-5',entryId:entry.id});expect(statistics(world,'p01').played).not.toBe(before.played);expect(reduceWorld(world,{type:'reset'})).toEqual(initialWorld());
  });
  it('does not duplicate a guest with a profile when simulating that player or every other user',()=>{
    let world=initialWorld();
    for(const player of world.players){world=reduceWorld(world,{type:'user',id:player.id});world=reduceWorld(world,{type:'join',gameId:'demo-1'});coherent(world);}
  });

  it('removes only an own guest once, preserves the profile, reserve and earlier payment',()=>{
    let world=initialWorld();const id=world.games[0].entries.find(e=>e.inviterId&&e.playerId)!.id;
    expect(reduceWorld(world,{type:'remove_guest',gameId:'demo-1',entryId:id})).toBe(world);
    world=reduceWorld(world,{type:'user',id:'p02'});
    world=reduceWorld(world,{type:'finance_role',role:'admin'});world=reduceWorld(world,{type:'pay',gameId:'demo-1',entryId:id});
    const paid=world.games[0].entries.reduce((sum,e)=>sum+e.paidCents,0),waiting=reserves(world.games[0]),players=world.players;
    world=reduceWorld(world,{type:'remove_guest',gameId:'demo-1',entryId:id});
    expect(registered(world.games[0])).toHaveLength(11);expect(reserves(world.games[0])).toEqual(waiting);expect(world.players).toEqual(players);
    expect(world.games[0].entries.reduce((sum,e)=>sum+e.paidCents,0)).toBe(paid);
    expect(reduceWorld(world,{type:'remove_guest',gameId:'demo-1',entryId:id})).toBe(world);coherent(world);
  });
  it('removes an own guest without a profile and a reserve guest, never an ordinary member',()=>{
    let world=reduceWorld(initialWorld(),{type:'user',id:'p02'});
    const guest=world.games[0].entries.find(e=>e.inviterId&&!e.playerId)!;
    guest.status='reserve';const count=registered(world.games[0]).length;
    world=reduceWorld(world,{type:'remove_guest',gameId:'demo-1',entryId:guest.id});
    expect(registered(world.games[0])).toHaveLength(count);expect(reserves(world.games[0])).toHaveLength(2);
    const member=world.games[0].entries.find(e=>!e.inviterId&&e.playerId==='p02')!;
    expect(reduceWorld(world,{type:'remove_guest',gameId:'demo-1',entryId:member.id})).toBe(world);coherent(world);
  });
  it('does not let a profiled guest remove an invitation owned by someone else via withdraw',()=>{
    const world=reduceWorld(initialWorld(),{type:'user',id:'p19'});
    expect(reduceWorld(world,{type:'withdraw',gameId:'demo-1'})).toBe(world);
    expect(registered(world.games[0])).toHaveLength(12);
  });
  it('assigns four fixed portrait variants across all twenty fictional players',()=>{
    const a=initialWorld(),b=initialWorld();expect(a.players.map(p=>p.portrait)).toEqual(b.players.map(p=>p.portrait));
    expect(new Set(a.players.map(p=>`${p.portrait!.column}-${p.portrait!.row}`)).size).toBe(4);
  });

});

it('edits only the simulated player number, accepts 0 and 99, keeps duplicates and rejects invalid numbers',()=>{
 let world=initialWorld();
 for(const number of [-1,100,1.5,NaN,Infinity]) expect(reduceWorld(world,{type:'jersey',playerId:'p01',number})).toBe(world);
 expect(reduceWorld(world,{type:'jersey',playerId:'p02',number:12})).toBe(world);
 for(const number of [0,99,7]){world=reduceWorld(world,{type:'jersey',playerId:'p01',number});expect(world.players[0].jerseyNumber).toBe(number);}
 const games=world.games,totals=world.players[0].demoTotals;
 world=reduceWorld(world,{type:'user',id:'p02'});world=reduceWorld(world,{type:'user',id:'p01'});
 expect(world.players[0].jerseyNumber).toBe(7);expect(world.players[1].jerseyNumber).toBe(7);expect(world.games).toEqual(games);expect(world.players[0].demoTotals).toEqual(totals);
 expect(reduceWorld(world,{type:'reset'}).players[0].jerseyNumber).toBe(10);
});
it('keeps authored fictional goals, assists and MVP independent from attendance and sign-ups',()=>{
 let world=initialWorld();const totals=world.players.map(p=>p.demoTotals);
 world=reduceWorld(world,{type:'join',gameId:'demo-1'});
 world=reduceWorld(world,{type:'attendance',gameId:'demo-5',entryId:world.games[4].entries[0].id});
 expect(world.players.map(p=>p.demoTotals)).toEqual(totals);
 expect(totals).toEqual(initialWorld().players.map(p=>p.demoTotals));
 expect(totals.every(s=>Object.values(s).every(v=>Number.isInteger(v)&&v>=0))).toBe(true);
});

it('swaps opposite sides only and keeps entry ids, guests, numbers and withdrawals coherent',()=>{
 let world=initialWorld();const gameId=world.games[0].id,original=teamEntries(world.games[0]);
 expect(original.a).toHaveLength(6);expect(original.b).toHaveLength(6);expect(original.unassigned).toHaveLength(0);
 const a=original.a[0].id,b=original.b[0].id;
 world=reduceWorld(world,{type:'lineup_swap',gameId,a,b});
 expect(teamEntries(world.games[0]).a[0].id).toBe(b);expect(teamEntries(world.games[0]).b[0].id).toBe(a);
 expect(reduceWorld(world,{type:'lineup_swap',gameId,a,b})).toBe(world);
 expect(reduceWorld(world,{type:'lineup_swap',gameId,a:'reserve-p16',b})).toBe(world);
 world=reduceWorld(world,{type:'lineup_reset',gameId});expect(teamEntries(world.games[0])).toEqual(original);
 world=reduceWorld(world,{type:'user',id:'p02'});
 const guest=world.games[0].entries.find(e=>e.inviterId&&!e.playerId)!;
 world=reduceWorld(world,{type:'remove_guest',gameId,entryId:guest.id});
 const teams=teamEntries(world.games[0]);expect([...teams.a,...teams.b]).toHaveLength(11);
 expect([...teams.a,...teams.b].some(e=>e.id===guest.id)).toBe(false);expect(reserves(world.games[0])).toHaveLength(2);
 world=reduceWorld(world,{type:'jersey',playerId:'p02',number:0});expect(world.players.find(p=>p.id===teams.a[0].playerId)?.jerseyNumber).toBe(0);
});
it('has honest empty teams, never auto-adds a new participant and resets from current registered entries only',()=>{
 let world=initialWorld();expect(world.games[2].lineup).toBeUndefined();
 world=reduceWorld(world,{type:'lineup_reset',gameId:'demo-3'});expect(teamEntries(world.games[2]).a.length+teamEntries(world.games[2]).b.length).toBe(6);
 expect(reduceWorld(world,{type:'lineup_reset',gameId:'demo-4'})).toBe(world);
 expect(reduceWorld(world,{type:'lineup_reset',gameId:'demo-9'})).toBe(world);
 world=reduceWorld(world,{type:'join',gameId:'demo-1'});expect(teamEntries(world.games[0]).unassigned.map(e=>e.playerId)).toEqual(['p01']);
 world=reduceWorld(world,{type:'lineup_reset',gameId:'demo-1'});expect(teamEntries(world.games[0]).unassigned).toHaveLength(0);
 expect([...teamEntries(world.games[0]).a,...teamEntries(world.games[0]).b]).toHaveLength(13);
 expect(reduceWorld(world,{type:'reset'})).toEqual(initialWorld());
});

it('limits finance to own obligations including guests, with full details only in demo admin',()=>{
 let world=reduceWorld(initialWorld(),{type:'user',id:'p02'});const game=world.games[0];
 const own=demoFinance(world,game);expect(own.rows).toHaveLength(3);expect(own.due).toBe(6750);expect(own.rows.every(r=>(r.entry.inviterId??r.entry.playerId)==='p02')).toBe(true);
 expect(reduceWorld(world,{type:'pay',gameId:game.id,entryId:own.rows[0].entry.id})).toBe(world);
 expect(reduceWorld(world,{type:'payment_set',gameId:game.id,entryId:own.rows[0].entry.id,cents:100})).toBe(world);
 world=reduceWorld(world,{type:'finance_role',role:'admin'});expect(demoFinance(world,game).rows).toHaveLength(12);
 expect(reduceWorld(world,{type:'user',id:'p03'}).financeRole).toBe('player');
 expect(reduceWorld(world,{type:'reset'}).financeRole).toBe('player');
});
it('sums cents, validates amounts, clamps progress and keeps withdrawn payments visible to their owner only',()=>{
 let world=reduceWorld(initialWorld(),{type:'finance_role',role:'admin'});const id=world.games[0].id,entry=world.games[0].entries[0].id;
 for(const cents of [-1,NaN,Infinity,1.1,100000001])expect(reduceWorld(world,{type:'payment_set',gameId:id,entryId:entry,cents})).toBe(world);
 expect(reduceWorld(world,{type:'payment_set',gameId:id,entryId:'reserve-p16',cents:500})).toBe(world);
 for(const {entry} of charges(world.games[0]))world=reduceWorld(world,{type:'pay',gameId:id,entryId:entry.id});
 expect(demoFinance(world,world.games[0])).toMatchObject({paid:27000,remaining:0,percent:100,overpaid:0});
 world=reduceWorld(world,{type:'payment_set',gameId:id,entryId:entry,cents:3000});
 expect(demoFinance(world,world.games[0])).toMatchObject({paid:27750,remaining:0,percent:100,overpaid:750});
 expect(paymentStatus(2250,3000)).toBe('Nadpłata');expect(paymentStatus(2250,2250)).toBe('Opłacono');expect(paymentStatus(2250,1000)).toBe('Częściowo');expect(paymentStatus(2250,0)).toBe('Do zapłaty');
 world=reduceWorld(world,{type:'payment_set',gameId:id,entryId:entry,cents:1000});expect(demoFinance(world,world.games[0]).paid).toBe(25750);
 world=reduceWorld(world,{type:'user',id:'p02'});const guest=world.games[0].entries.find(e=>e.inviterId&&!e.playerId)!;
 world=reduceWorld(world,{type:'remove_guest',gameId:id,entryId:guest.id});expect(demoFinance(world,world.games[0]).retained.map(e=>e.id)).toEqual([guest.id]);
 world=reduceWorld(world,{type:'user',id:'p03'});expect(demoFinance(world,world.games[0]).retained).toHaveLength(0);
 for(const [text,cents] of [['0',0],['12,34',1234],['12.3',1230],['1000000',100000000]] as const)expect(parseDemoMoney(text)).toBe(cents);
 for(const text of ['','-1','1,234','1e2','abc','1000000,01'])expect(parseDemoMoney(text)).toBeNull();
});
