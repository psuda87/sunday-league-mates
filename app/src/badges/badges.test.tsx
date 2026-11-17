import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {SessionManager} from '../auth/sessionManager';
import GroupNotifications from '../groups/GroupNotifications';
import {BadgesProvider,usePlayerBadges} from './BadgesProvider';
import BadgeList from './BadgeList';
import {badgeStates,bellBadges,celebrateBadges,playerBadges,takeOwnBadgesRequest} from './badgeContracts';
afterEach(()=>{cleanup();takeOwnBadgesRequest();});

const now=new Date().toISOString();
const own={user_id:'me',own:true,earned:[
 {code:'SLM-MAT-001',group_id:null,group_name:null,season:null,earned_at:now,new:true,celebrate:true},
 {code:'SLM-STR-010',group_id:'g',group_name:'Orliki',season:null,earned_at:now,new:true,celebrate:true},
 {code:'SLM-MAT-010',group_id:null,group_name:null,season:null,earned_at:'2020-01-01T18:00:00Z',new:true,celebrate:false},
 {code:'SLM-XXX-999',group_id:null,group_name:null,season:null,earned_at:now,new:true,celebrate:true}],
 progress:[{code:'SLM-MAT-050',progress:12,threshold:50},{code:'SLM-MAT-001',progress:1,threshold:1}]};

it('parsuje odpowiedź serwera, pomija nieznane kody i preferuje zdobycie nad postępem',()=>{
 const data=playerBadges(own);
 const states=badgeStates(data);
 expect(states.find(s=>s.code==='SLM-MAT-001')?.earnedAt).toBe(now);
 expect(states.find(s=>s.code==='SLM-MAT-050')).toEqual({code:'SLM-MAT-050',current:12});
 expect(states.some(s=>s.code==='SLM-XXX-999')).toBe(false);
 expect(celebrateBadges(data).map(b=>b.code)).toEqual(['SLM-MAT-001','SLM-STR-010']);
 // Dzwonek: wszystkie nieodklikane, także starsze niż 7 dni.
 expect(bellBadges(data).map(b=>b.code)).toEqual(['SLM-MAT-001','SLM-STR-010','SLM-MAT-010']);
 expect(bellBadges({...data,own:false})).toEqual([]);
 expect(()=>playerBadges({user_id:'x'})).toThrow();
});

it('lista pokazuje zdobyte i postęp z prawdziwych danych',()=>{
 render(<BadgeList states={badgeStates(playerBadges(own))} own anchorId="slm-own-badges"/>);
 expect(screen.getByText('Debiutant')).toBeTruthy();expect(screen.getByText('Żelazne płuca')).toBeTruthy();
 expect(screen.getByRole('button',{name:/Pokaż pozostałe/})).toBeTruthy();
 expect(document.getElementById('slm-own-badges')).toBeTruthy();
});

const setup=(response:unknown=own)=>{
 const state={phase:'ready',session:{user_id:'me'}};
 const call=vi.fn(async(action:string)=>action==='badges_player'?response:action==='badges_seen'?{seen:2}:action==='group_finance_wallet'?{accounts:[]}:{groups:[]});
 return {call,manager:{call,subscribe:()=>()=>{},getSnapshot:()=>state} as unknown as SessionManager};
};

it('okienko „Nowa odznaka!” pokazuje nowe po kolei i po „Super” wywołuje badges_seen',async()=>{
 const {manager,call}=setup();
 render(<BadgesProvider manager={manager} userId="me"><p>app</p></BadgesProvider>);
 const dialog=await screen.findByRole('dialog',{name:'Debiutant'});
 expect(within(dialog).getByText('Nowa odznaka! (1/2)')).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('button',{name:'Super'}));
 const second=await screen.findByRole('dialog',{name:'Żelazne płuca'});
 expect(within(second).getByText(/Orliki/)).toBeTruthy();
 expect(call).not.toHaveBeenCalledWith('badges_seen',expect.anything());
 fireEvent.click(within(second).getByRole('button',{name:'Super'}));
 await waitFor(()=>expect(call).toHaveBeenCalledWith('badges_seen',{scope:'dialog'}));
 expect(call).not.toHaveBeenCalledWith('badges_seen',{scope:'bell'});
 expect(screen.queryByRole('dialog')).toBeNull();
});

it('brak backendu odznak ukrywa sekcję zamiast pokazywać fikcyjne dane',async()=>{
 const state={phase:'ready',session:{user_id:'me'}};
 const call=vi.fn(async()=>{throw Error('service_unavailable');});
 const manager={call,subscribe:()=>()=>{},getSnapshot:()=>state} as unknown as SessionManager;
 function Probe(){const b=usePlayerBadges('me');return <p>{b?'jest':'brak'}</p>;}
 render(<BadgesProvider manager={manager} userId="me"><Probe/></BadgesProvider>);
 await waitFor(()=>expect(call).toHaveBeenCalledWith('badges_player',{user_id:'me'}));
 expect(screen.getByText('brak')).toBeTruthy();expect(screen.queryByRole('dialog')).toBeNull();
});

it('dzwonek pokazuje „Nowa odznaka: X” do odklikania i prowadzi do sekcji odznak w profilu',async()=>{
 const {manager,call}=setup({...own,earned:own.earned.map(b=>({...b,celebrate:false,new:b.code!=='SLM-MAT-010'}))});
 const onBadges=vi.fn();
 render(<BadgesProvider manager={manager} userId="me"><GroupNotifications manager={manager} userId="me" onGroups={()=>{}} onBadges={onBadges} refreshKey={false}/></BadgesProvider>);
 fireEvent.click(await screen.findByRole('button',{name:/nowe odznaki: 2/}));
 const panel=screen.getByRole('region',{name:'Powiadomienia'});
 const entry=await within(panel).findByRole('button',{name:/Nowa odznaka: Debiutant/});
 expect(within(panel).queryByText(/Stały bywalec/)).toBeNull();
 fireEvent.click(entry);
 expect(onBadges).toHaveBeenCalledOnce();expect(takeOwnBadgesRequest()).toBe(true);
 await waitFor(()=>expect(call).toHaveBeenCalledWith('badges_seen',{scope:'bell'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:/nowe odznaki/})).toBeNull());
});
