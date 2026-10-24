import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import B1App from './B1App';
import { SessionManager } from './sessionManager';
import { AccountError } from './api';
import type { Session } from './api';
import { b1Port } from './b1Port';
vi.mock('../demo/App',()=>({default:({onLogout,onAccount}:{onLogout:()=>void;onAccount:(view:string)=>void})=><div>Chroniony świat demo<button onClick={onLogout}>Wyloguj</button><button onClick={()=>onAccount('password')}>Hasło konta</button></div>}));
afterEach(cleanup);
const session=(temporary=false):Session=>({access_token:'access-test',refresh_token:'refresh-test',user_id:'fictional-test',role:'member',expires_in:3600,must_change_password:temporary});
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
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się zalogować'));
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
 it('does not implement registration/recovery/profile or authorize callback URL',async()=>{
  const request=vi.fn();const {manager}=setup(request);const port=b1Port(manager);
  await expect(port.requestPasswordReset('fictional@example.invalid')).rejects.toThrow('integration');
  await expect(port.completeRedirect('verify')).rejects.toThrow('integration');
  await expect(port.signUp({nickname:'Fikcyjny',fullName:'',phone:''},'fictional@example.invalid','test')).rejects.toThrow('integration');
  expect(request).not.toHaveBeenCalled();
 });
});
