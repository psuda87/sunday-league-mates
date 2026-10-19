import { expect, it } from 'vitest';
import { accountPlayer, initialAccountWorld } from './accountState';
import { emptyProfile } from '../account-ui/model';
import { canCreateEvents, eventAccess } from './eventAccess';
import { groupMembers } from './groups';
import { reduceWorld, statistics } from './data';
it('uses the existing world, with no automatic membership, private contacts, photo, jersey or invented statistics',()=>{
 const player=accountPlayer({...emptyProfile(),nickname:'Debiutant',phone:'000000000'}),world=initialAccountWorld(player);
 expect(world.players).toHaveLength(41);expect(world.games).toHaveLength(10);expect(world.userId).toBe(player.id);expect(canCreateEvents(world)).toBe(false);expect(groupMembers(world,'group-1')).toEqual([]);expect(eventAccess(world,world.games[0])).toBe('none');expect(eventAccess(world,world.games[1])).toBe('full');
 expect(statistics(world,player.id).played).toBe(0);expect(player.demoTotals).toEqual({goals:0,assists:0,mvp:0});expect(player.portrait).toBeUndefined();expect(player.jerseyNumber).toBeUndefined();expect('phone' in player||'email' in player||'password' in player).toBe(false);
 const joined=reduceWorld(world,{type:'join',gameId:'demo-4'});expect(joined.groupState).toEqual(world.groupState);expect(joined.games[3].entries[0].playerId).toBe(player.id);
});
