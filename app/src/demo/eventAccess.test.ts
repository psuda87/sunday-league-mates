import { describe, expect, it } from 'vitest';
import { defaultEvent } from './eventDraft';
import { charges, demoFinance, initialWorld, reduceWorld, registered, teamEntries } from './data';
import type { World } from './data';
import { canCreateEvents, canEditEvent, canViewEventProfile, eventAccess, organizingGroups } from './eventAccess';
import { membership } from './groups';
const as=(w:World,id:string)=>reduceWorld(w,{type:'user',id});
const input=(groupId='group-1')=>({...defaultEvent(),groupId});
const update=(w:World,visibility:'private'|'public')=>{const g=w.games[0];return reduceWorld(w,{type:'event_update',gameId:g.id,input:{...input(g.groupId),startsAt:g.startsAt,name:g.name,capacity:g.capacity,costCents:g.costCents,visibility}});};
describe('3.16 group events demo policy',()=>{
 it('maps every fixture deterministically, preserving independent entries and history',()=>{
  const a=initialWorld(),b=initialWorld();expect(a).toEqual(b);
  expect(a.games).toHaveLength(10);expect(a.games.every(g=>a.groupState.groups.some(group=>group.id===g.groupId)&&a.players.some(p=>p.id===g.createdBy))).toBe(true);
  expect(registered(a.games[0])).toHaveLength(12);expect(a.games[0].entries.filter(e=>e.inviterId)).toHaveLength(2);expect(a.games[0].lineup).toEqual(b.games[0].lineup);
 });
 it('uses per-group organizer permissions, including multiple memberships and commit-time revocation',()=>{
  let w=initialWorld();expect(organizingGroups(w).map(g=>g.id)).toEqual(['group-1','group-2']);
  expect(canCreateEvents(as(w,'p04'))).toBe(false);expect(canCreateEvents(as(w,'p40'))).toBe(false);
  w=as(w,'p03');expect(canCreateEvents(w)).toBe(true);
  const forbidden=reduceWorld(w,{type:'event_create',input:input('group-2'),key:'forbidden'});expect(forbidden).toBe(w);
  const created=reduceWorld(w,{type:'event_create',input:input(),key:'org'});expect(created.games[0]).toMatchObject({groupId:'group-1',createdBy:'p03',visibility:'private',entries:[]});
  w=as(w,'p01');w=reduceWorld(w,{type:'group_permission',groupId:'group-1',targetId:'p03',allow:false});w=as(w,'p03');
  expect(reduceWorld(w,{type:'event_create',input:input(),key:'revoked'})).toBe(w);
  expect(reduceWorld(as(w,'p04'),{type:'event_create',input:input(),key:'ordinary'}).games).toEqual(w.games);
 });
 it('only creator and current member edits; ownership survives revocation and departure',()=>{
  let w=initialWorld();const g=w.games[0];
  expect(canEditEvent(w,g)).toBe(true);expect(canEditEvent(as(w,'p02'),g)).toBe(false);
  // Make the group administrator a non-creator, then verify no inherited ownership.
  w=reduceWorld(w,{type:'group_transfer',groupId:g.groupId,targetId:'p02'});
  expect(canEditEvent(as(w,'p02'),g)).toBe(false);expect(canEditEvent(w,g)).toBe(true);
  expect(update(as(w,'p02'),'public').games).toEqual(w.games);
  const left=reduceWorld(w,{type:'group_leave',groupId:g.groupId});expect(canEditEvent(left,left.games[0])).toBe(false);expect(left.games[0].createdBy).toBe('p01');expect(left.games[0].entries).toEqual(g.entries);
  expect(update(left,'public')).toBe(left);
  for(const finished of left.games.filter(game=>game.status!=='upcoming'))expect(canEditEvent(left,finished)).toBe(false);
 });
 it('private outsiders see no profiles or financial projection and cannot bypass any game mutation',()=>{
  const w=as(initialWorld(),'p40'),g=w.games[0];expect(eventAccess(w,g)).toBe('none');expect(canViewEventProfile(w,g,'p02')).toBe(false);
  const admin=reduceWorld(w,{type:'finance_role',role:'admin'});expect(demoFinance(admin,g).rows).toEqual([]);expect(demoFinance(admin,g).retained).toEqual([]);
  const actions=[{type:'join'},{type:'guest'},{type:'withdraw'},{type:'remove_guest',entryId:g.entries[11].id},{type:'resize',count:15},{type:'attendance',entryId:g.entries[0].id},{type:'pay',entryId:g.entries[0].id},{type:'payment_set',entryId:g.entries[0].id,cents:20},{type:'lineup_reset'},{type:'lineup_swap',a:g.lineup!.a[0],b:g.lineup!.b[0]}] as const;
  for(const action of actions)expect(reduceWorld(admin,{...action,gameId:g.id})).toBe(admin);
 });
 it('public registration/guests do not grant group membership; reclosing keeps all history and own access',()=>{
  let w=update(initialWorld(),'public');w=as(w,'p40');const gid=w.games[0].id;
  w=reduceWorld(w,{type:'join',gameId:gid});w=reduceWorld(w,{type:'guest',gameId:gid});w=reduceWorld(w,{type:'lineup_reset',gameId:gid});
  expect(membership(w,'group-1')).toBeUndefined();expect(registered(w.games[0])).toHaveLength(14);
  const before=structuredClone(w.games[0]);w=as(w,'p01');w=update(w,'private');
  expect(w.games[0].entries).toEqual(before.entries);expect(w.games[0].lineup).toEqual(before.lineup);
  w=as(w,'p40');expect(eventAccess(w,w.games[0])).toBe('own');expect(canViewEventProfile(w,w.games[0],'p02')).toBe(false);
  for(const type of ['join','guest','lineup_reset','resize'] as const)expect(reduceWorld(w,{type,gameId:gid,count:15})).toBe(w);
  const admin=reduceWorld(w,{type:'finance_role',role:'admin'});expect(demoFinance(admin,admin.games[0]).admin).toBe(false);expect(demoFinance(admin,admin.games[0]).rows).toHaveLength(2);
  expect(eventAccess(as(w,'p38'),w.games[0])).toBe('none');
  const guest=w.games[0].entries.find(e=>e.inviterId==='p40')!;
  w=reduceWorld(w,{type:'remove_guest',gameId:gid,entryId:guest.id});expect(teamEntries(w.games[0]).a.concat(teamEntries(w.games[0]).b).some(e=>e.id===guest.id)).toBe(false);
  expect(reduceWorld(w,{type:'remove_guest',gameId:gid,entryId:guest.id})).toBe(w);
  w=reduceWorld(w,{type:'withdraw',gameId:gid});expect(eventAccess(w,w.games[0])).toBe('none');expect(membership(w,'group-1')).toBeUndefined();
 });
 it('retains reserve and existing guest profile, protects finance scope, and preserves cents and reset',()=>{
  let w=as(initialWorld(),'p40'),g=w.games[1];expect(eventAccess(w,g)).toBe('full');
  w=reduceWorld(w,{type:'join',gameId:g.id});expect(w.games[1].entries.at(-1)?.status).toBe('reserve');
  const financial=reduceWorld(w,{type:'finance_role',role:'admin'});expect(demoFinance(financial,financial.games[1]).admin).toBe(false);
  expect(reduceWorld(financial,{type:'pay',gameId:g.id,entryId:g.entries[0].id})).toBe(financial);
  w=as(w,'p02');g=w.games[1];w=reduceWorld(w,{type:'event_update',gameId:g.id,input:{...input(g.groupId),startsAt:g.startsAt,visibility:'private'}});w=as(w,'p40');expect(eventAccess(w,w.games[1])).toBe('own');
  expect(charges(w.games[1]).reduce((sum,r)=>sum+r.due,0)).toBe(27000);expect(reduceWorld(w,{type:'reset'})).toEqual(initialWorld());
 });
 it('does not move an existing event between groups or allow injected ownership or duplicate creation',()=>{
  let w=initialWorld();const g=w.games[0];expect(reduceWorld(w,{type:'event_update',gameId:g.id,input:input('group-2')})).toBe(w);
  const payload={...input(),createdBy:'p40',entries:g.entries};w=reduceWorld(w,{type:'event_create',input:payload,key:'stable'});expect(w.games[0].createdBy).toBe('p01');expect(w.games[0].entries).toEqual([]);
  expect(reduceWorld(w,{type:'event_create',input:input(),key:'stable'})).toBe(w);
 });
});
it('keeps an existing outsider reserve eligible to claim a freed seat, without a new registration or promotion',()=>{
 let w=as(initialWorld(),'p40');const id='demo-2';w=reduceWorld(w,{type:'join',gameId:id});
 w=as(w,'p02');const g=w.games[1];w=reduceWorld(w,{type:'event_update',gameId:id,input:{...input(g.groupId),startsAt:g.startsAt,visibility:'private'}});
 w=reduceWorld(w,{type:'resize',gameId:id,count:14});const count=w.games[1].entries.length;
 w=as(w,'p40');expect(eventAccess(w,w.games[1])).toBe('own');expect(w.games[1].entries.at(-1)?.status).toBe('reserve');
 w=reduceWorld(w,{type:'join',gameId:id});expect(registered(w.games[1])).toHaveLength(15);expect(w.games[1].entries).toHaveLength(count);expect(membership(w,g.groupId)).toBeUndefined();
});
it('keeps old ownership after losing organizer permission, and games survive deletion of an empty group',()=>{
 let w=as(initialWorld(),'p03');w=reduceWorld(w,{type:'event_create',input:input(),key:'owner'});const id=w.games[0].id;
 w=as(w,'p01');w=reduceWorld(w,{type:'group_permission',groupId:'group-1',targetId:'p03',allow:false});w=as(w,'p03');expect(canEditEvent(w,w.games[0])).toBe(true);
 expect(reduceWorld(w,{type:'event_create',input:input(),key:'denied'})).toBe(w);expect(w.games[0].id).toBe(id);
 w=as(w,'p39');w=reduceWorld(w,{type:'event_create',input:input('group-4'),key:'empty-group'});const game=w.games[0];w=reduceWorld(w,{type:'group_leave',groupId:'group-4'});
 expect(w.groupState.groups.some(g=>g.id==='group-4')).toBe(false);expect(w.games[0]).toEqual(game);expect(canEditEvent(w,w.games[0])).toBe(false);
});
