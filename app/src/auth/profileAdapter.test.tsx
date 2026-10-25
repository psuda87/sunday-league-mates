import UltimatePlayerCard from '../ui/UltimatePlayerCard';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { SessionManager } from './sessionManager';
import type { RequestAccount } from './sessionManager';
import type { Session } from './api';
import { profileAdapter } from './profileAdapter';
import { useOwnProfile } from './useOwnProfile';
import DemoProfile from '../demo/Profile';
import { initialWorld } from '../demo/data';
import type { PersonalProfileBinding } from '../ui/personalProfile';
afterEach(cleanup);
const profile=(id='own')=>({user_id:id,login:'Fikcyjny',phone:'+48000000999',full_name:'Testowy Zawodnik',display_as:'full_name' as const,display_name:'Testowy Zawodnik'});
function manager(request:(action:string,values?:Record<string,unknown>)=>Promise<unknown>,id='own'){
 const session:Session={access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user_id:id,role:'member',must_change_password:false};
 const api:RequestAccount=async<T,>(action:string,values?:Record<string,unknown>)=>(action==='login'?session:await request(action,values)) as T;
 return new SessionManager({read:async()=>null,write:async()=>{},clear:async()=>{}},api);
}
it('uses existing own-profile operations, preserves display preference and verifies read-back',async()=>{
 let stored=profile();const request=vi.fn(async(action:string,values?:Record<string,unknown>)=>{
  if(action==='save_profile')stored={...stored,full_name:values!.full_name as string,display_name:values!.full_name as string};
  return {...stored,role:'admin',metadata:'not for UI'};
 });
 const auth=manager(request);await auth.signIn('Fikcyjny','only-test-password');
 const adapter=profileAdapter(auth,'own');expect(await adapter.read()).toEqual({...profile(),jersey_number:null});
 const saved=await adapter.save('  Trwała Nazwa  ','full_name');expect(saved!.display_name).toBe('Trwała Nazwa');
 expect(request.mock.calls.map(call=>call[0])).toEqual(['profile','save_profile','profile']);
 expect(request.mock.calls[1][1]).toEqual({full_name:'Trwała Nazwa',display_as:'full_name'});
 await expect(adapter.save('<invalid>','full_name')).rejects.toThrow('profile_validation');
 expect(request).toHaveBeenCalledTimes(3);
});
it('fails closed on another account payload and never projects its contact',async()=>{
 const auth=manager(async()=>profile('other'));await auth.signIn('Fikcyjny','only-test-password');
 await expect(profileAdapter(auth,'own').read()).rejects.toThrow('profile_contract_invalid');
 const {result}=renderHook(()=>useOwnProfile(auth,'own'));
 await waitFor(()=>expect(result.current.phase).toBe('error'));expect(result.current.profile).toBeNull();
 expect(result.current.notice).not.toContain('+48');
});
it('does not reveal a late previous-account profile after logout or account switch',async()=>{
 let finish!:(value:unknown)=>void;
 const old=manager(()=>new Promise(resolve=>{finish=resolve;}));await old.signIn('Fikcyjny','only-test-password');
 const next=manager(async()=>profile('second'),'second');await next.signIn('Drugi','only-test-password');
 const {result,rerender}=renderHook(({auth,id}:{auth:SessionManager;id:string|null})=>useOwnProfile(auth,id),{initialProps:{auth:old,id:'own' as string|null}});
 expect(result.current.profile).toBeNull();
 rerender({auth:old,id:null});expect(result.current.profile).toBeNull();
 rerender({auth:next,id:'second'});await waitFor(()=>expect(result.current.profile?.user_id).toBe('second'));
 await act(async()=>{finish(profile());});expect(result.current.profile?.user_id).toBe('second');
});
it('reports success only after read-back and clears uncertain data when read-back fails',async()=>{
 let failing=false,stored=profile();const request=vi.fn(async(action:string,values?:Record<string,unknown>)=>{if(failing&&action==='profile')throw new Error('private-server-detail');if(action==='save_profile')stored={...stored,full_name:values!.full_name as string,display_name:values!.full_name as string};return stored;});
 const auth=manager(request);await auth.signIn('Fikcyjny','only-test-password');
 const {result}=renderHook(()=>useOwnProfile(auth,'own'));await waitFor(()=>expect(result.current.phase).toBe('ready'));
 await act(async()=>{expect(await result.current.save('Nowa Nazwa')).toBe(true);});expect(result.current.notice).toContain('Zapisano profil');
 failing=true;await act(async()=>{expect(await result.current.save('Inna Nazwa')).toBe(false);});
 expect(result.current.phase).toBe('error');expect(result.current.profile).toBeNull();expect(result.current.notice).not.toContain('private-server-detail');
});
it('handles a missing profile without fabricated identity',async()=>{
 const auth=manager(async()=>null);await auth.signIn('Fikcyjny','only-test-password');
 const {result}=renderHook(()=>useOwnProfile(auth,'own'));await waitFor(()=>expect(result.current.phase).toBe('missing'));
 expect(result.current.profile).toBeNull();expect(await result.current.save('Nie zapisuj')).toBe(false);
});
it('binds original own-profile controls only; identifiers/photo/number are read-only and stats unavailable',async()=>{
 const save=vi.fn().mockResolvedValue(true),dispatch=vi.fn();
 const binding:PersonalProfileBinding={phase:'ready',profile:profile(),saving:false,notice:'',reload:vi.fn(),save};
 const world=initialWorld();render(<DemoProfile world={world} id={world.userId} personal personalProfile={binding} dispatch={dispatch}/>);
 expect(screen.getByRole('heading',{name:'Testowy Zawodnik'})).toBeTruthy();
 expect(document.querySelector('.slm-ultimate-portrait')).toHaveAttribute('data-portrait','initials');
 expect([...document.querySelectorAll('.slm-ultimate-stats dd')].map(node=>node.textContent)).toEqual(['—','—','—','—']);
 expect(screen.getByRole('button',{name:'Zmień zdjęcie'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Edytuj profil'}));
 expect(screen.getByLabelText('Login / pseudonim')).toHaveAttribute('readonly');
 fireEvent.change(screen.getByLabelText('Imię i nazwisko · opcjonalnie'),{target:{value:'Nowe Dane'}});
 fireEvent.click(screen.getByRole('button',{name:'Zapisz dane'}));await waitFor(()=>expect(save).toHaveBeenCalledWith('Nowe Dane',undefined));
 expect(dispatch).not.toHaveBeenCalled();
 expect(world.players[0].name).not.toBe('Testowy Zawodnik');
});

it('rejects a successful HTTP response if read-back does not confirm the submitted value',async()=>{
 const auth=manager(async()=>profile());await auth.signIn('Fikcyjny','only-test-password');
 await expect(profileAdapter(auth,'own').save('Niepotwierdzony Zapis','full_name')).rejects.toThrow('profile_readback_mismatch');
});

it('saves name and jersey using existing operations and confirms both, preserving the photo binding',async()=>{
 let stored={...profile(),jersey_number:27};
 const request=vi.fn(async(action:string,values?:Record<string,unknown>)=>{
  if(action==='save_profile')stored={...stored,full_name:String(values!.full_name),display_name:String(values!.full_name)};
  if(action==='save_jersey_number')stored={...stored,jersey_number:Number(values!.jersey_number)};
  if(action==='profile_photo_get')return {image_data_url:null,revision:null,cleanup_pending:false};
  return {...stored};
 });
 const auth=manager(request);await auth.signIn('Fikcyjny','only-test-password');
 const {result}=renderHook(()=>useOwnProfile(auth,'own'));await waitFor(()=>expect(result.current.phase).toBe('ready'));
 await act(async()=>{expect(await result.current.save('Nowe Dane',0)).toBe(true);});
 expect(result.current.profile).toMatchObject({full_name:'Nowe Dane',jersey_number:0});expect(result.current.photo?.phase).toBe('ready');
 expect(request.mock.calls.filter(([action])=>action.startsWith('save_')).map(([action])=>action)).toEqual(['save_profile','save_jersey_number']);
});

it('changes a legacy alias with current password through existing session operation and confirms profile',async()=>{
 let stored={...profile(),email_account:false};
 const fresh:Session={access_token:'fresh-access',refresh_token:'fresh-refresh',expires_in:3600,user_id:'own',role:'member',must_change_password:false};
 const request=vi.fn(async(action:string,values?:Record<string,unknown>)=>{if(action==='identifiers'){stored={...stored,login:String(values!.login)};return fresh;}return stored;});
 const auth=manager(request);await auth.signIn('Fikcyjny','only-test-password');
 const saved=await profileAdapter(auth,'own').changeAlias('NowyLogin','only-current-test-password');
 expect(saved?.login).toBe('NowyLogin');expect(auth.getSnapshot().session?.access_token).toBe('fresh-access');
 expect(request.mock.calls.find(([action])=>action==='identifiers')?.[1]).toEqual({login:'NowyLogin',phone:'+48000000999',current_password:'only-current-test-password'});
});
it('does not send legacy identifier changes for an email account',async()=>{
 const request=vi.fn(async(action:string)=>action==='profile'?({...profile(),email_account:true}):null);const auth=manager(request);await auth.signIn('Fikcyjny','only-test-password');
 await expect(profileAdapter(auth,'own').changeAlias('NowyLogin','only-current-test-password')).rejects.toThrow('alias_not_supported');
 expect(request.mock.calls.map(([action])=>action)).toEqual(['profile']);
});
it('leaves the existing session in place when server rejects a duplicate alias',async()=>{
 const request=vi.fn(async(action:string)=>{if(action==='identifiers')throw new Error('identifier_taken');return {...profile(),email_account:false};});
 const auth=manager(request);await auth.signIn('Fikcyjny','only-test-password');
 await expect(profileAdapter(auth,'own').changeAlias('ZajetyLogin','only-current-test-password')).rejects.toThrow('identifier_taken');
 expect(auth.getSnapshot().session?.access_token).toBe('test-access');
});
it('covers only a single real portrait and preserves the original demo sheet rendering',()=>{
 const {rerender}=render(<UltimatePlayerCard name="Test" portrait={{src:'data:image/webp;base64,AA=='}} portraitFit="cover"/>);
 expect(document.querySelector('.slm-ultimate-portrait img')).toHaveStyle({objectFit:'cover',objectPosition:'50% 35%'});
 rerender(<UltimatePlayerCard name="Test" portrait={{src:'/assets/demo/fictional-portraits.webp',column:0,row:0}} portraitFit="cover"/>);
 expect((document.querySelector('.slm-ultimate-portrait img') as HTMLImageElement).style.objectFit).toBe('');
});
