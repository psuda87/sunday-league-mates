import { describe, expect, it } from 'vitest';
import { charges, history, initialWorld, reduceWorld, registered, reserves, statistics, unpaidGames } from './data';
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
    world=reduceWorld(world,{type:'pay',gameId:game.id,entryId:entry.id});expect(unpaidGames(world,'p01')).toBe(1);
    const paid=world.games[4].entries[0].paidCents;world=reduceWorld(world,{type:'pay',gameId:game.id,entryId:entry.id});expect(world.games[4].entries[0].paidCents).toBe(paid);
    world=reduceWorld(world,{type:'join',gameId:'demo-1'});expect(registered(world.games[0])).toHaveLength(13);coherent(world);
  });
  it('updates attendance statistics and resets every mutation',()=>{
    let world=initialWorld();const entry=world.games[4].entries[0],before=statistics(world,'p01');world=reduceWorld(world,{type:'attendance',gameId:'demo-5',entryId:entry.id});expect(statistics(world,'p01').played).not.toBe(before.played);expect(reduceWorld(world,{type:'reset'})).toEqual(initialWorld());
  });
  it('does not duplicate a guest with a profile when simulating that player or every other user',()=>{
    let world=initialWorld();
    for(const player of world.players){world=reduceWorld(world,{type:'user',id:player.id});world=reduceWorld(world,{type:'join',gameId:'demo-1'});coherent(world);}
  });

});
