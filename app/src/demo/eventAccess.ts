// Memory-only demo policy. Never a replacement for production Auth/RLS.
import type { Entry, Game, World } from './data';
import { groupCanOrganize, membership } from './groups';
export const organizingGroups=(world:World)=>world.players.some(p=>p.id===world.userId)?world.groupState.groups.filter(g=>groupCanOrganize(world,g.id)):[];
export const canCreateEvents=(world:World)=>organizingGroups(world).length>0;
export const groupName=(world:World,game:Game)=>world.groupState.groups.find(g=>g.id===game.groupId)?.name??'Grupa archiwalna';
export const ownParticipation=(world:World,game:Game)=>game.entries.filter(e=>e.playerId===world.userId||e.inviterId===world.userId);
export function eventAccess(world:World,game:Game):'full'|'own'|'none' {
  if(!world.players.some(p=>p.id===world.userId))return 'none';
  if(membership(world,game.groupId)||game.visibility==='public')return 'full';
  return ownParticipation(world,game).some(e=>e.status!=='withdrawn'||e.paidCents>0)?'own':'none';
}
export const canEditEvent=(world:World,game:Game)=>game.createdBy===world.userId&&!!membership(world,game.groupId)&&game.status==='upcoming';
export const canAdminEventFinance=(world:World,game:Game)=>!!membership(world,game.groupId)&&world.financeRole==='admin';
export const canViewEventProfile=(world:World,game:Game,id:string)=>id===world.userId?eventAccess(world,game)!=='none':eventAccess(world,game)==='full'&&game.entries.some(e=>e.status!=='withdrawn'&&(e.playerId===id||e.inviterId===id));
export const ownsCharge=(world:World,entry:Entry)=>(entry.inviterId??entry.playerId)===world.userId;
