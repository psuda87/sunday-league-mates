import { canCreateEvents } from './eventAccess';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultEvent, eventInstant, localEventTime, validateEvent } from './eventDraft';
import { charges, initialWorld, reduceWorld, registered, reserves } from './data';
afterEach(()=>vi.useRealTimers());
const admin=()=>initialWorld();
const inputEvent=()=>({...defaultEvent(),groupId:'group-1'});
describe('demo events only',()=>{
 it('converts Warsaw dates and rejects DST gaps/ambiguity and invalid dates',()=>{
  expect(eventInstant('2026-07-01','18:00')).toBe('2026-07-01T16:00:00.000Z');
  expect(eventInstant('2026-12-01','18:00')).toBe('2026-12-01T17:00:00.000Z');
  for(const [date,time] of [['2026-03-29','02:30'],['2026-10-25','02:30'],['2026-02-30','18:00'],['2026-12-01','25:00'],['','']])expect(eventInstant(date,time)).toBeNull();
 });
 it('defaults to a future local date even late at night',()=>{
  const now=Date.parse('2026-12-31T23:59:00Z'),draft=defaultEvent(now);
  expect(validateEvent(draft,0,now)).toEqual([]);expect(localEventTime(draft.startsAt).date).toBe('2027-01-02');expect(draft).toMatchObject({minimum:10,capacity:15,costCents:27000,durationMinutes:90});
 });
 it('rejects invalid input and capacity below active entries, not reserves',()=>{
  const draft=defaultEvent();expect(validateEvent({...draft,minimum:0,capacity:0,costCents:-1,durationMinutes:0,location:' ',startsAt:'bad'}).length).toBeGreaterThan(4);
  expect(validateEvent({...draft,minimum:2,capacity:10},12).join()).toContain('zapisanych (12)');
  expect(validateEvent({...draft,minimum:2,capacity:12},12)).toEqual([]);
  expect(validateEvent({...draft,costCents:0.5})).not.toEqual([]);
 });
 it('guards create/edit in reducer, allocates stable ids and deduplicates create',()=>{
  const input=inputEvent(),ordinary=reduceWorld(initialWorld(),{type:'user',id:'p04'});
  expect(reduceWorld(ordinary,{type:'event_create',input,key:'one'})).toBe(ordinary);
  let world=admin();expect(canCreateEvents(world)).toBe(true);
  world=reduceWorld(world,{type:'event_create',input,key:'one'});const game=world.games[0];
  expect(game.id).toBe('demo-11');expect(game.entries).toEqual([]);expect(charges(game)).toEqual([]);
  expect(reduceWorld(world,{type:'event_create',input,key:'one'})).toBe(world);
  world=reduceWorld(world,{type:'event_create',input,key:'two'});expect(world.games[0].id).toBe('demo-12');
  expect(canCreateEvents(reduceWorld(world,{type:'user',id:'p04'}))).toBe(false);
  expect(reduceWorld(world,{type:'reset'})).toEqual(initialWorld());
 });
 it('edits metadata without touching entries/guests/reserve/lineup and rejects undersized limits',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
  let world=admin();const game=world.games[0],input={...inputEvent(),startsAt:game.startsAt,name:'Nowa nazwa',capacity:12,minimum:8,costCents:30001};
  world=reduceWorld(world,{type:'event_update',gameId:game.id,input});
  expect(world.games[0].entries).toEqual(game.entries);expect(world.games[0].lineup).toEqual(game.lineup);expect(reserves(world.games[0])).toHaveLength(2);
  expect(charges(world.games[0]).reduce((s,r)=>s+r.due,0)).toBe(30001);
  expect(reduceWorld(world,{type:'event_update',gameId:game.id,input:{...input,capacity:11}})).toBe(world);
  const ordinary=reduceWorld(world,{type:'user',id:'p02'});expect(reduceWorld(ordinary,{type:'event_update',gameId:game.id,input})).toBe(ordinary);
 });
 it('new event supports registration, guest removal, teams and financial shares',()=>{
  let world=reduceWorld(admin(),{type:'event_create',input:inputEvent(),key:'demo'});const id=world.games[0].id;
  world=reduceWorld(world,{type:'join',gameId:id});world=reduceWorld(world,{type:'guest',gameId:id});expect(registered(world.games[0])).toHaveLength(2);
  world=reduceWorld(world,{type:'lineup_reset',gameId:id});expect(world.games[0].lineup?.a).toHaveLength(1);
  expect(charges(world.games[0]).reduce((sum,r)=>sum+r.due,0)).toBe(27000);
  world=reduceWorld(world,{type:'remove_guest',gameId:id,entryId:world.games[0].entries[1].id});expect(registered(world.games[0])).toHaveLength(1);
 });
});
