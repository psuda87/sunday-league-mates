import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect,useState } from 'react';
import B1App from './B1App';
import { SessionManager } from './sessionManager';
import { AccountError } from './api';
import type { Session } from './api';
import { b1Port } from './b1Port';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
vi.mock('@capacitor/app',()=>({App:{addListener:vi.fn(async()=>({remove:async()=>{}}))}}));
vi.mock('./useOwnProfile',()=>({useOwnProfile:(_manager:unknown,_owner:unknown,selection?:{begin:()=>void;end:()=>void})=>({photo:{beginSelection:selection?.begin,endSelection:selection?.end}})}));
const worldLifecycle=vi.hoisted(()=>({mounts:0,unmounts:0}));
vi.mock('../events/PremiumWorld',()=>({default:function MockWorld({onLogout,onAccount,personalProfile}:{personalProfile?:{photo:{beginSelection:()=>void;endSelection:()=>void}};onLogout:()=>void;onAccount:(view:string)=>void}){
 const [draft,setDraft]=useState(false);
 useEffect(()=>{worldLifecycle.mounts++;return()=>{worldLifecycle.unmounts++;};},[]);
 return <div>Chroniony świat demo{draft&&<span>Wybrany plik RAM</span>}<button onClick={()=>{setDraft(true);personalProfile?.photo.beginSelection();}}>Otwórz galerię</button><button onClick={()=>personalProfile?.photo.endSelection()}>Zakończ wybór</button><button onClick={onLogout}>Wyloguj</button><button onClick={()=>onAccount('password')}>Hasło konta</button></div>;
}}));
afterEach(()=>{cleanup();vi.restoreAllMocks();worldLifecycle.mounts=0;worldLifecycle.unmounts=0;});
const session=(temporary=false):Session=>({access_token:'access-test',refresh_token:'refresh-test',user_id:'fictional-test',role:'member',expires_in:3600,must_change_password:temporary});
it('does not resume or retain a private world while explicit logout is clearing the vault',async()=>{
 let release!:()=>void;const clearing=new Promise<void>(resolve=>{release=resolve;});
 let token:string|null='saved-test';
 const request=vi.fn(async(action:string)=>action==='logout'?undefined:session());
 const manager=new SessionManager({read:async()=>token,write:async value=>{token=value;},clear:async()=>{await clearing;token=null;}},async<T,>(action:string)=>await request(action) as T);
 render(<B1App manager={manager}/>);await screen.findByText('Chroniony świat demo');
 fireEvent.click(screen.getByRole('button',{name:'Wyloguj'}));
 fireEvent(window,new Event('online'));await act(async()=>{await Promise.resolve();});
 expect(request.mock.calls.filter(c=>c[0]==='refresh')).toHaveLength(1);
 expect(screen.queryByText('Chroniony świat demo')).toBeNull();
 await act(async()=>{release();});await screen.findByRole('heading',{name:'Zaloguj się'});expect(token).toBeNull();
});
function setup(request:(action:string,values?:Record<string,unknown>,session?:Session|null)=>Promise<unknown>,token:string|null=null){
 const store={read:async()=>token,write:async(value:string)=>{token=value;},clear:async()=>{token=null;}};
 return {manager:new SessionManager(store,async<T,>(action:string,values?:Record<string,unknown>,session?:Session|null)=>await request(action,values,session) as T),peek:()=>token};
}
async function login(identifier='Fikcyjny'){
 await screen.findByRole('heading',{name:'Zaloguj się'});
 fireEvent.change(screen.getByLabelText('Login lub numer telefonu'),{target:{value:identifier}});
 fireEvent.change(screen.getByLabelText('Hasło'),{target:{value:'Test-only-secret'}});
 fireEvent.submit(screen.getByRole('form'));
}
describe('B1 existing Auth into frozen account UI',()=>{
 it('accepts aliases/phones, keeps credential errors in original form, never exposes protected world',async()=>{
  const request=vi.fn().mockRejectedValue(new AccountError('Denied','invalid_credentials'));
  const {manager}=setup(request);render(<B1App manager={manager}/>);
  await login('+48 123 456 789');
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Nieprawidłowy login, numer telefonu lub hasło.'));
  expect(request).toHaveBeenCalledWith('login',{identifier:'+48 123 456 789',password:'Test-only-secret'},undefined);
  expect(screen.queryByText('Chroniony świat demo')).toBeNull();
  expect(screen.getByLabelText('Hasło')).toHaveValue('');
 });
 it('requires temporary password change before world; real logout removes refresh',async()=>{
  const request=vi.fn(async(action:string)=>action==='login'?session(true):action==='password'?session():undefined);
  const {manager,peek}=setup(request);render(<B1App manager={manager}/>);await login();
  await screen.findByRole('heading',{name:'Zmień hasło'});expect(screen.queryByText('Chroniony świat demo')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Wróć do logowania'}));expect(screen.queryByText('Chroniony świat demo')).toBeNull();
  await login();await screen.findByRole('heading',{name:'Zmień hasło'});
  fireEvent.change(screen.getByLabelText('Obecne hasło'),{target:{value:'Test-only-secret'}});
  fireEvent.change(screen.getByLabelText('Nowe hasło'),{target:{value:'Another-test-secret'}});
  fireEvent.change(screen.getByLabelText('Powtórz nowe hasło'),{target:{value:'Another-test-secret'}});
  fireEvent.submit(screen.getByRole('form'));await screen.findByText('Chroniony świat demo');
  expect(request.mock.calls.map(call=>call[0])).toEqual(['login','logout','login','password']);
  fireEvent.click(screen.getByRole('button',{name:'Wyloguj'}));await screen.findByRole('heading',{name:'Zaloguj się'});expect(peek()).toBeNull();
 });
 it('restores only after server verification; hides world offline and rejects revoked session',async()=>{
  let mode='ready';const request=vi.fn(async()=>{if(mode==='offline')throw new AccountError('Offline','network_error');if(mode==='expired')throw new AccountError('Expired','session_invalid');return session();});
  const {manager,peek}=setup(request,'saved-test-refresh');render(<B1App manager={manager}/>);
  await screen.findByText('Chroniony świat demo');mode='offline';fireEvent(window,new Event('offline'));
  await screen.findByRole('heading',{name:'Brak połączenia'});expect(screen.queryByText('Chroniony świat demo')).toBeNull();expect(peek()).not.toBeNull();
  mode='expired';fireEvent.click(screen.getByRole('button',{name:'Spróbuj ponownie'}));
  await screen.findByRole('heading',{name:'Sesja wygasła'});expect(peek()).toBeNull();expect(screen.queryByText('Chroniony świat demo')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Wróć do logowania'}));await screen.findByRole('heading',{name:'Zaloguj się'});
 });
 it('keeps the native world visible through short minimize/resume without remounting',async()=>{
  vi.spyOn(Capacitor,'isNativePlatform').mockReturnValue(true);
  vi.spyOn(App,'addListener').mockResolvedValue({remove:async()=>{}});
  let visibility:DocumentVisibilityState='visible';vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility);
  const request=vi.fn().mockResolvedValue(session());const {manager}=setup(request,'saved-test-refresh');render(<B1App manager={manager}/>);
  await screen.findByText('Chroniony \u015bwiat demo');
  visibility='hidden';fireEvent(document,new Event('visibilitychange'));
  expect(screen.getByText('Chroniony \u015bwiat demo')).toBeVisible();
  visibility='visible';fireEvent(document,new Event('visibilitychange'));fireEvent(window,new Event('focus'));
  await act(async()=>{await Promise.resolve();});
  expect(request).toHaveBeenCalledTimes(1);expect(worldLifecycle.mounts).toBe(1);expect(worldLifecycle.unmounts).toBe(0);
  expect(screen.queryByRole('heading',{name:'Sprawdzanie sesji'})).toBeNull();
 });
 it('retains a native picker during background verification and removes it on revocation',async()=>{
  vi.spyOn(Capacitor,'isNativePlatform').mockReturnValue(true);
  vi.spyOn(App,'addListener').mockResolvedValue({remove:async()=>{}});
  let finishRefresh!:(value:Session)=>void;
  const request=vi.fn().mockResolvedValueOnce(session()).mockImplementationOnce(()=>new Promise<Session>(resolve=>{finishRefresh=resolve;})).mockRejectedValueOnce(new AccountError('Revoked','session_invalid'));
  const {manager}=setup(request,'saved-test-refresh');render(<B1App manager={manager}/>);
  await screen.findByText('Chroniony \u015bwiat demo');fireEvent.click(screen.getByText('Otw\u00f3rz galeri\u0119'));
  let pending!:Promise<void>;act(()=>{pending=manager.refresh(true);});
  expect(screen.getByText('Wybrany plik RAM')).toBeVisible();expect(screen.queryByRole('heading',{name:'Sprawdzanie sesji'})).toBeNull();
  await act(async()=>{finishRefresh(session());await pending;});expect(worldLifecycle.mounts).toBe(1);
  await act(async()=>{await manager.refresh(true);});await screen.findByRole('heading',{name:'Sesja wygas\u0142a'});
  expect(screen.queryByText('Wybrany plik RAM')).toBeNull();expect(screen.queryByText('Chroniony \u015bwiat demo')).toBeNull();
 });
 it('does not authorize an unverified callback, expose a fake profile, or register without policies',async()=>{
  const request=vi.fn();const {manager}=setup(request);const port=b1Port(manager);
  await expect(port.completeRedirect('verify')).rejects.toThrow('link');
  await expect(port.saveProfile({nickname:'Fikcyjny',fullName:'',phone:''})).rejects.toThrow('integration');
  await expect(port.signUp({nickname:'Fikcyjny',fullName:'',phone:''},'fictional@example.invalid','test')).rejects.toThrow('Rejestracja oczekuje');
  expect(request).not.toHaveBeenCalled();
 });
});
