import { expect,it } from 'vitest';
import { visiblePremiumEvents } from './eventFilters';
import type { EventSummary } from './premiumContracts';
const event=(id:string,group_id:string,history=false,visibility='private',own=false)=>({id,group_id,visibility,access:'full',starts_at:history?'2020-01-01T00:00:00Z':'2099-01-01T00:00:00Z',status:'scheduled',own_participation:own,own_history:own}) as EventSummary;
it('current groups/public upcoming and current-group/own former history have distinct scopes',()=>{
 const events=[event('member','g'),event('public','other',false,'public'),event('private','other'),event('group-history','g',true),event('own-history','left',true,'private',true),event('unrelated-public-history','other',true,'public')];
 const list=(period:'upcoming'|'history'|'mine',scope='')=>visiblePremiumEvents(events,[{id:'g'}],'2030-01-01T00:00:00Z',period,scope).map(e=>e.id);
 expect(list('upcoming')).toEqual(['member','public']);expect(list('history')).toEqual(['group-history','own-history']);
 expect(list('upcoming','public')).toEqual(['public']);expect(list('upcoming','g')).toEqual(['member']);expect(list('history','mine')).toEqual(['own-history']);
});
