import { initialWorld } from './data';
import type { DemoPlayer } from './data';
import type { ProfileDraft } from '../account-ui/model';
// Only a public player projection enters the existing World. Never email/phone/password.
export function accountPlayer(profile:ProfileDraft):DemoPlayer {
 return {id:'demo-new-player',name:profile.nickname,nick:profile.nickname,fullName:profile.fullName,accountSetup:true,jerseyNumber:profile.jerseyNumber,portrait:profile.portrait,demoTotals:{goals:0,assists:0,mvp:0}};
}
export function initialAccountWorld(player?:DemoPlayer) {
 const world=initialWorld();
 if(player){world.players.push(accountPlayer({nickname:player.name,fullName:player.fullName??'',phone:'',jerseyNumber:player.jerseyNumber,portrait:player.portrait}));world.userId='demo-new-player';}
 return world;
}
