import { describe, expect, it } from 'vitest';
import { initialWorld, reduceWorld } from './data';
import type { World } from './data';
import { canViewGroupProfile, groupAdmin, groupCanOrganize, groupMembers, inviteCandidates, membership, normalizeDemoContact, publicGroups, validGroupText } from './groups';
const user=(w:World,id:string)=>reduceWorld(w,{type:'user',id});
const pending=(w:World,kind:string,target:string)=>w.groupState.requests.find(r=>r.status==='pending'&&r.kind===kind&&r.targetId===target)!;
function coherent(w:World) {
 for(const g of w.groupState.groups){const members=w.groupState.members.filter(m=>m.groupId===g.id);expect(members.length).toBeGreaterThan(0);expect(members.filter(m=>m.playerId===g.adminId)).toHaveLength(1);expect(new Set(members.map(m=>m.playerId)).size).toBe(members.length);}
 for(const r of w.groupState.requests){expect(w.groupState.groups.some(g=>g.id===r.groupId)).toBe(true);if(r.targetId)expect(w.players.some(p=>p.id===r.targetId)).toBe(true);}
}
describe('isolated demo groups',()=>{
 it('has coherent 25/35 member fixtures, multiple memberships and a no-group user',()=>{
  const w=initialWorld();coherent(w);expect(w.groupState).toEqual(initialWorld().groupState);expect(groupMembers(w,'group-1')).toHaveLength(25);expect(groupMembers(w,'group-2')).toHaveLength(35);expect(w.groupState.members.filter(m=>m.playerId==='p40')).toHaveLength(0);
 });
 it('allows creation with duplicate names, stable ids and idempotent confirmation',()=>{
  const start=user(initialWorld(),'p40');expect(validGroupText('  ','')).toBe(false);expect(validGroupText('x'.repeat(65),'')).toBe(false);expect(validGroupText('Nowa','<tag>')).toBe(false);
  let w=reduceWorld(start,{type:'group_create',name:' Czwartkowe granie ',description:' demo ',key:'one'});const g=w.groupState.groups.at(-1)!;expect(g.adminId).toBe('p40');expect(g.name).toBe('Czwartkowe granie');expect(membership(w,g.id)).toBeTruthy();expect(groupCanOrganize(w,g.id)).toBe(true);expect(reduceWorld(w,{type:'group_create',name:g.name,description:'',key:'one'})).toBe(w);
  w=reduceWorld(w,{type:'group_create',name:g.name,description:'',key:'two'});expect(w.groupState.groups.at(-1)!.id).not.toBe(g.id);coherent(w);expect(reduceWorld(w,{type:'reset'})).toEqual(initialWorld());
 });
 it('admin invitation does not force membership; only receiver accepts once',()=>{
  let w=reduceWorld(initialWorld(),{type:'group_invite',groupId:'group-1',targetId:'p38'});const r=pending(w,'invite','p38');expect(membership(w,'group-1','p38')).toBeUndefined();expect(reduceWorld(w,{type:'group_decide',requestId:r.id,accept:true})).toBe(w);
  expect(reduceWorld(w,{type:'group_invite',groupId:'group-1',targetId:'p02'})).toBe(w);
  w=user(w,'p38');w=reduceWorld(w,{type:'group_decide',requestId:r.id,accept:true});expect(membership(w,'group-1')).toBeTruthy();expect(reduceWorld(w,{type:'group_decide',requestId:r.id,accept:true})).toBe(w);coherent(w);
 });
 it('requires administrator then recipient consent for member proposal',()=>{
  let w=user(initialWorld(),'p02');w=reduceWorld(w,{type:'group_invite',groupId:'group-1',targetId:'p38'});const r=pending(w,'proposal','p38');expect(reduceWorld(w,{type:'group_decide',requestId:r.id,accept:true})).toBe(w);
  w=user(w,'p01');w=reduceWorld(w,{type:'group_decide',requestId:r.id,accept:true});expect(membership(w,'group-1','p38')).toBeUndefined();const invite=pending(w,'invite','p38');w=user(w,'p38');w=reduceWorld(w,{type:'group_decide',requestId:invite.id,accept:true});expect(membership(w,'group-1')).toBeTruthy();coherent(w);
 });
 it('rejection never adds members and cannot be reversed by duplicate actions',()=>{
  let w=initialWorld();const p=pending(w,'proposal','p37');w=reduceWorld(w,{type:'group_decide',requestId:p.id,accept:false});expect(reduceWorld(w,{type:'group_decide',requestId:p.id,accept:true})).toBe(w);expect(membership(w,'group-1','p37')).toBeUndefined();
  const invite=pending(w,'invite','p01');w=reduceWorld(w,{type:'group_decide',requestId:invite.id,accept:false});expect(membership(w,'group-3')).toBeUndefined();
 });
 it('join requests deduplicate, cancel by requester only, and add on admin acceptance',()=>{
  let w=user(initialWorld(),'p40');w=reduceWorld(w,{type:'group_join',groupId:'group-1'});const r=pending(w,'join','p40');expect(reduceWorld(w,{type:'group_join',groupId:'group-1'})).toBe(w);
  expect(reduceWorld(user(w,'p02'),{type:'group_cancel',requestId:r.id}).groupState).toEqual(w.groupState);
  w=reduceWorld(w,{type:'group_cancel',requestId:r.id});expect(w.groupState.requests.find(x=>x.id===r.id)!.status).toBe('cancelled');w=reduceWorld(w,{type:'group_join',groupId:'group-1'});const next=pending(w,'join','p40');w=user(w,'p01');w=reduceWorld(w,{type:'group_decide',requestId:next.id,accept:true});expect(membership(w,'group-1','p40')).toBeTruthy();coherent(w);
 });
 it('keeps organizer permission group-local and independent from event role',()=>{
  let w=user(initialWorld(),'p04');const before=w;expect(groupCanOrganize(w,'group-1')).toBe(false);expect(reduceWorld(w,{type:'group_permission',groupId:'group-1',targetId:'p04',allow:true})).toBe(w);
  w=reduceWorld(w,{type:'event_role',role:'admin'});expect(groupAdmin(w,'group-1')).toBe(false);expect(groupCanOrganize(w,'group-1')).toBe(false);
  w=user(w,'p01');w=reduceWorld(w,{type:'group_permission',groupId:'group-1',targetId:'p04',allow:true});expect(groupCanOrganize(w,'group-1','p04')).toBe(true);expect(groupCanOrganize(before,'group-1','p04')).toBe(false);
  w=reduceWorld(w,{type:'group_permission',groupId:'group-1',targetId:'p04',allow:false});expect(groupCanOrganize(w,'group-1','p04')).toBe(false);expect(groupCanOrganize(w,'group-1','p01')).toBe(true);expect(reduceWorld(w,{type:'group_permission',groupId:'group-1',targetId:'p40',allow:true})).toBe(w);expect(reduceWorld(w,{type:'group_permission',groupId:'group-1',targetId:'p01',allow:false})).toBe(w);
 });
 it('removal revokes access and permission without removing profile/events',()=>{
  let w=initialWorld();const games=w.games,player=w.players[1];w=reduceWorld(w,{type:'group_remove',groupId:'group-1',targetId:'p02'});expect(membership(w,'group-1','p02')).toBeUndefined();expect(groupCanOrganize(w,'group-1','p02')).toBe(false);expect(w.players[1]).toEqual(player);expect(w.games).toBe(games);expect(canViewGroupProfile(user(w,'p02'),'group-1','p01')).toBe(false);coherent(w);
 });
 it('blocks outsider roster/profile lookup, exposes only public group fields and no full directory',()=>{
  const w=user(initialWorld(),'p40');expect(groupMembers(w,'group-1')).toEqual([]);expect(canViewGroupProfile(w,'group-1','p01')).toBe(false);expect(inviteCandidates(w,'group-1','slm')).toEqual([]);
  const found=publicGroups(w,'Czwartkowe')[0];expect(Object.keys(found).sort()).toEqual(['count','description','id','name']);expect(found.count).toBe(25);expect(inviteCandidates(initialWorld(),'group-1','')).toEqual([]);expect(inviteCandidates(initialWorld(),'group-1','slm36')[0]).toEqual({id:'p36',name:'Nikodem Lipa',nick:'slm36'});
 });
 it('normalizes exact phone and gives identical generic feedback without exposing contacts',()=>{
  expect(normalizeDemoContact('0048 000 000 036')).toBe('+48000000036');expect(normalizeDemoContact('+48 (000) 000-036')).toBe('+48000000036');expect(normalizeDemoContact('00000003')).toBeNull();
  const known=reduceWorld(initialWorld(),{type:'group_phone',groupId:'group-1',phone:'000000036'}),unknown=reduceWorld(initialWorld(),{type:'group_phone',groupId:'group-1',phone:'123456789'}),member=reduceWorld(initialWorld(),{type:'group_phone',groupId:'group-1',phone:'000000002'});
  expect(reduceWorld(unknown,{type:'group_phone',groupId:'group-1',phone:'123456789'}).groupState.requests).toEqual(unknown.groupState.requests);expect(known.notice).toBe(unknown.notice);expect(member.notice).toBe(known.notice);expect(pending(known,'invite','p36')).toBeTruthy();expect(member.groupState.requests.at(-1)!.targetId).toBeNull();expect(unknown.groupState.requests.at(-1)!.targetId).toBeNull();expect(known.players.some(p=>'phone' in p)).toBe(false);
  const duplicate=reduceWorld(known,{type:'group_phone',groupId:'group-1',phone:'+48 000 000 036'});expect(duplicate.groupState.requests).toEqual(known.groupState.requests);
 });
 it('private proposals still require two approvals and never expose recipient in proposal label',()=>{
  let w=reduceWorld(user(initialWorld(),'p02'),{type:'group_phone',groupId:'group-1',phone:'000000038'});const r=pending(w,'proposal','p38');w=user(w,'p01');w=reduceWorld(w,{type:'group_decide',requestId:r.id,accept:true});const invite=pending(w,'invite','p38');expect(membership(w,'group-1','p38')).toBeUndefined();w=user(w,'p38');w=reduceWorld(w,{type:'group_decide',requestId:invite.id,accept:true});expect(membership(w,'group-1')).toBeTruthy();
 });
 it('private receipts do not block a later valid invitation or duplicate an existing one',()=>{
  let w=initialWorld();w=reduceWorld(w,{type:'group_phone',groupId:'group-1',phone:'000000002'});expect(w.groupState.requests.at(-1)!.status).toBe('cancelled');
  w=reduceWorld(w,{type:'group_remove',groupId:'group-1',targetId:'p02'});w=reduceWorld(w,{type:'group_phone',groupId:'group-1',phone:'000000002'});expect(pending(w,'invite','p02')).toBeTruthy();
  let other=user(initialWorld(),'p02');other=reduceWorld(other,{type:'group_invite',groupId:'group-1',targetId:'p38'});const nick=pending(other,'proposal','p38');
  other=reduceWorld(other,{type:'group_phone',groupId:'group-1',phone:'000000038'});const phone=other.groupState.requests.find(r=>r.kind==='proposal'&&r.channel==='phone'&&r.status==='pending')!;
  other=user(other,'p01');other=reduceWorld(other,{type:'group_decide',requestId:phone.id,accept:true});expect(pending(other,'invite','p38')).toBeTruthy();other=reduceWorld(other,{type:'group_decide',requestId:nick.id,accept:true});expect(other.groupState.requests.filter(r=>r.kind==='invite'&&r.targetId==='p38'&&r.status==='pending')).toHaveLength(1);coherent(other);
 });
 it('manual transfer is atomic and forbids removing the administrator directly',()=>{
  let w=initialWorld();expect(reduceWorld(w,{type:'group_remove',groupId:'group-1',targetId:'p01'})).toBe(w);expect(reduceWorld(w,{type:'group_transfer',groupId:'group-1',targetId:'p40'})).toBe(w);
  w=reduceWorld(w,{type:'group_transfer',groupId:'group-1',targetId:'p03'});expect(groupAdmin(w,'group-1')).toBe(false);expect(groupAdmin(user(w,'p03'),'group-1')).toBe(true);expect(membership(w,'group-1')).toBeTruthy();coherent(w);
 });
 it('automatic succession prioritizes organizers, oldest joining date, then stable player id',()=>{
  let w=initialWorld();for(const m of w.groupState.members.filter(m=>m.groupId==='group-1'))m.organizer=['p03','p04'].includes(m.playerId);
  w.groupState.members.find(m=>m.groupId==='group-1'&&m.playerId==='p04')!.joinedAt=w.groupState.members.find(m=>m.groupId==='group-1'&&m.playerId==='p03')!.joinedAt;
  w=reduceWorld(w,{type:'group_leave',groupId:'group-1'});expect(w.groupState.groups[0].adminId).toBe('p03');expect(w.notice).toContain('Marek Lis');coherent(w);
 });
 it('falls back to oldest member and deletes last-member group with its pending records',()=>{
  let w=initialWorld();for(const m of w.groupState.members)m.organizer=false;w=reduceWorld(w,{type:'group_leave',groupId:'group-1'});expect(w.groupState.groups[0].adminId).toBe('p02');coherent(w);
  w=user(w,'p39');w=reduceWorld(w,{type:'group_leave',groupId:'group-4'});expect(w.groupState.groups.some(g=>g.id==='group-4')).toBe(false);expect(w.notice).toContain('pustą');coherent(w);
 });
 it('accepting one consent cancels other pending requests and never duplicates membership',()=>{
  let w=user(initialWorld(),'p01');w=reduceWorld(w,{type:'group_join',groupId:'group-3'});const join=pending(w,'join','p01'),invite=pending(w,'invite','p01');w=reduceWorld(w,{type:'group_decide',requestId:invite.id,accept:true});expect(w.groupState.requests.find(r=>r.id===join.id)!.status).toBe('cancelled');expect(w.groupState.members.filter(m=>m.groupId==='group-3'&&m.playerId==='p01')).toHaveLength(1);coherent(w);
 });
});
