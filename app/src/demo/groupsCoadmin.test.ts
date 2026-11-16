import { describe, expect, it } from 'vitest';
import { initialWorld } from './data';
import type { World } from './data';
import { groupAdmin, groupOwner, membership, reduceGroups } from './groups';

// group-1: administrator główny p01; członkowie p01..p25 w kolejności dołączenia.
const as = (world: World, userId: string): World => ({ ...world, userId });
const grant = (world: World, targetId: string, allow = true) => reduceGroups(world, { type: 'group_admin', groupId: 'group-1', targetId, allow });

describe('współadministratorzy grupy', () => {
  it('administrator główny nadaje i odbiera uprawnienia administratora', () => {
    let w = as(initialWorld(), 'p01');
    w = grant(w, 'p02');
    expect(membership(w, 'group-1', 'p02')?.admin).toBe(true);
    expect(groupAdmin(as(w, 'p02'), 'group-1')).toBe(true);
    expect(groupOwner(as(w, 'p02'), 'group-1')).toBe(false);
    w = grant(w, 'p02', false);
    expect(groupAdmin(as(w, 'p02'), 'group-1')).toBe(false);
  });

  it('współadministrator nie nadaje adminów, nie przekazuje grupy i nie usuwa administratorów', () => {
    let w = grant(as(initialWorld(), 'p01'), 'p02');
    w = grant(w, 'p03');
    const co = as(w, 'p02');
    expect(grant(co, 'p04')).toBe(co);
    expect(reduceGroups(co, { type: 'group_transfer', groupId: 'group-1', targetId: 'p04' })).toBe(co);
    expect(reduceGroups(co, { type: 'group_remove', groupId: 'group-1', targetId: 'p01' })).toBe(co);
    expect(reduceGroups(co, { type: 'group_remove', groupId: 'group-1', targetId: 'p03' })).toBe(co);
    expect(reduceGroups(co, { type: 'group_permission', groupId: 'group-1', targetId: 'p03', allow: false })).toBe(co);
  });

  it('współadministrator zarządza zwykłymi członkami i nazwą grupy', () => {
    let w = as(grant(as(initialWorld(), 'p01'), 'p02'), 'p02');
    w = reduceGroups(w, { type: 'group_permission', groupId: 'group-1', targetId: 'p04', allow: true });
    expect(membership(w, 'group-1', 'p04')?.organizer).toBe(true);
    w = reduceGroups(w, { type: 'group_remove', groupId: 'group-1', targetId: 'p05' });
    expect(membership(w, 'group-1', 'p05')).toBeUndefined();
    w = reduceGroups(w, { type: 'group_rename', groupId: 'group-1', name: 'Nowa nazwa' });
    expect(w.groupState.groups.find(g => g.id === 'group-1')?.name).toBe('Nowa nazwa');
  });

  it('po odejściu administratora głównego przejmuje najstarszy współadministrator, nawet gdy młodszy jest organizatorem', () => {
    let w = grant(grant(as(initialWorld(), 'p01'), 'p03'), 'p02');
    w = reduceGroups(w, { type: 'group_permission', groupId: 'group-1', targetId: 'p02', allow: false });
    expect(membership(w, 'group-1', 'p02')?.organizer).toBe(false);
    expect(membership(w, 'group-1', 'p03')?.organizer).toBe(true);
    w = reduceGroups(w, { type: 'group_leave', groupId: 'group-1' });
    const group = w.groupState.groups.find(g => g.id === 'group-1')!;
    expect(group.adminId).toBe('p02');
    expect(membership(w, 'group-1', 'p02')?.admin).toBe(false);
    expect(groupAdmin(as(w, 'p03'), 'group-1')).toBe(true);
  });

  it('przekazanie grupy zdejmuje flagę współadministratora z nowego głównego', () => {
    let w = grant(as(initialWorld(), 'p01'), 'p02');
    w = reduceGroups(w, { type: 'group_transfer', groupId: 'group-1', targetId: 'p02' });
    expect(w.groupState.groups.find(g => g.id === 'group-1')?.adminId).toBe('p02');
    expect(membership(w, 'group-1', 'p02')?.admin).toBe(false);
    expect(groupAdmin(w, 'group-1')).toBe(false);
  });
});
