import {afterEach,expect,it,vi} from 'vitest';
import {StrictMode} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import B1App from './B1App';
import {SessionManager} from './sessionManager';
import {AccountError} from './api';
vi.mock('./useOwnProfile',()=>({useOwnProfile:()=>({})}));
vi.mock('../events/PremiumWorld',()=>({default:()=> <div>Chronione dane poprzedniego konta</div>}));
afterEach(()=>{cleanup();vi.unstubAllEnvs();window.history.replaceState(null,'','/');});
const hash='c'.repeat(64);
function fixture(implementation:(action:string,body?:Record<string,unknown>)=>Promise<unknown>=async action=>action==='verify_email'?{email_verified:true}:action==='recover_password'?{password_changed:true}:{verification_required:true}){
 let token:string|null='old-vault-refresh';
 const store={read:async()=>token,write:vi.fn(async(v:string)=>{token=v;}),clear:vi.fn(async()=>{token=null;})};
 const request=vi.fn(implementation);
 const manager=new SessionManager(store,async<T,>(action:string,body?:Record<string,unknown>)=>await request(action,body) as T);
 return {manager,store,request};
}
async function resetForm(){
 await screen.findByRole('heading',{name:'Ustaw nowe hasło'});
 fireEvent.change(screen.getByLabelText('Nowe hasło'),{target:{value:crypto.randomUUID()}});
 // Use the same password only in this in-memory form.
 fireEvent.change(screen.getByLabelText('Powtórz nowe hasło'),{target:{value:(screen.getByLabelText('Nowe hasło') as HTMLInputElement).value}});
 fireEvent.submit(screen.getByRole('form'));
}
it('łączy formularz rejestracji z accounts i ekranem weryfikacji bez pozorowanej sesji',async()=>{
 vi.stubEnv('VITE_SLM_TERMS_URL','https://legal.example.invalid/terms');vi.stubEnv('VITE_SLM_PRIVACY_URL','https://legal.example.invalid/privacy');
 const f=fixture();await f.manager.logout();render(<B1App manager={f.manager}/>);
 await screen.findByRole('heading',{name:'Zaloguj się'});fireEvent.click(screen.getByRole('button',{name:'Nie masz konta? Zarejestruj się'}));
 fireEvent.change(screen.getByLabelText('Nazwa zawodnika / pseudonim'),{target:{value:'Fikcyjny'}});
 fireEvent.change(screen.getByLabelText('Adres e-mail'),{target:{value:'fixture@example.invalid'}});
 const password=crypto.randomUUID();fireEvent.change(screen.getByLabelText('Hasło'),{target:{value:password}});fireEvent.change(screen.getByLabelText('Powtórz hasło'),{target:{value:password}});
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(screen.getByRole('form'));
 await screen.findByRole('heading',{name:'Potwierdź e-mail'});expect(f.request).toHaveBeenCalledWith('signup',expect.objectContaining({profile:expect.objectContaining({nickname:'Fikcyjny'}),accept_policies:true}));
 fireEvent.click(screen.getByRole('button',{name:'Wyślij ponownie'}));await waitFor(()=>expect(f.request).toHaveBeenLastCalledWith('resend_verification',{email:'fixture@example.invalid'}));
 expect(f.store.write).not.toHaveBeenCalled();expect(screen.queryByText('Chronione dane poprzedniego konta')).toBeNull();
});
it('nie uruchamia rejestracji bez dokumentów prawnych',async()=>{
 const f=fixture();await f.manager.logout();render(<B1App manager={f.manager}/>);await screen.findByRole('heading',{name:'Zaloguj się'});
 fireEvent.click(screen.getByRole('button',{name:'Nie masz konta? Zarejestruj się'}));expect(screen.getByRole('button',{name:'Zarejestruj się'})).toBeDisabled();expect(screen.getByRole('checkbox')).toBeDisabled();
 expect(f.request).not.toHaveBeenCalled();
});
it('usuwa dowód z adresu przed transportem i potwierdza e-mail tylko raz także w StrictMode',async()=>{
 window.history.replaceState(null,'','/auth/callback#type=signup&token_hash='+hash);
 const f=fixture(async action=>{expect(window.location.href).not.toContain(hash);expect(action).toBe('verify_email');return {email_verified:true};});
 render(<StrictMode><B1App manager={f.manager}/></StrictMode>);
 await screen.findByRole('heading',{name:'E-mail potwierdzony'});expect(f.request).toHaveBeenCalledTimes(1);expect(f.store.clear).toHaveBeenCalledOnce();expect(f.store.write).not.toHaveBeenCalled();
 expect(screen.getByText('Zaloguj się adresem e-mail.')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Przejdź do logowania'}));await screen.findByRole('heading',{name:'Zaloguj się'});
});
it('wykonuje recovery bez odtworzenia starego konta, bez zapisu tokenów i kończy na logowaniu',async()=>{
 window.history.replaceState(null,'','/auth/callback#type=recovery&token_hash='+hash);
 const f=fixture();render(<B1App manager={f.manager}/>);await resetForm();
 await screen.findByRole('heading',{name:'Zmiana hasła'});expect(f.request).toHaveBeenCalledTimes(1);expect(f.request).toHaveBeenCalledWith('recover_password',expect.objectContaining({token_hash:hash}));
 expect(f.store.write).not.toHaveBeenCalled();expect(screen.queryByText('Chronione dane poprzedniego konta')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Wróć do logowania'}));await screen.findByRole('heading',{name:'Zaloguj się'});
});
it('wygasły dowód nie pokazuje sukcesu; powrót usuwa możliwość ponownego użycia',async()=>{
 window.history.replaceState(null,'','/auth/callback#type=recovery&token_hash='+hash);
 const f=fixture(async()=>{throw new AccountError('expired','invalid_email_link');});render(<B1App manager={f.manager}/>);await resetForm();
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Link jest nieprawidłowy lub wygasł'));
 expect(screen.queryByRole('heading',{name:'Zmiana hasła'})).toBeNull();expect(f.store.write).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Wróć do logowania'}));await screen.findByRole('heading',{name:'Zaloguj się'});
});
it('błędny callback usuwa także surowe JWT i nie wykonuje żądania Auth',async()=>{
 window.history.replaceState(null,'','/auth/callback#access_token=private-fixture&refresh_token=private-fixture');
 const f=fixture();render(<B1App manager={f.manager}/>);await screen.findByRole('heading',{name:'Link niedostępny'});
 expect(window.location.hash).toBe('');expect(f.request).not.toHaveBeenCalled();expect(f.store.write).not.toHaveBeenCalled();
});
it('ukrywa poprzednie konto natychmiast, nawet gdy czyszczenie magazynu trwa',async()=>{
 const f=fixture(async()=>({access_token:'a',refresh_token:'r',expires_in:3600,user_id:'fixture-user',role:'member',must_change_password:false}));
 await f.manager.signIn('fixture',crypto.randomUUID());let done!:()=>void;f.store.clear.mockImplementationOnce(()=>new Promise(resolve=>{done=resolve;}));
 window.history.replaceState(null,'','/auth/callback#type=recovery&token_hash='+hash);render(<B1App manager={f.manager}/>);
 expect(screen.queryByText('Chronione dane poprzedniego konta')).toBeNull();await waitFor(()=>expect(done).toBeTypeOf('function'));await act(async()=>{done();});await screen.findByRole('heading',{name:'Ustaw nowe hasło'});
 expect(f.store.write).toHaveBeenCalledTimes(1); // Only the pre-existing password login.
});
it('po błędzie czyszczenia callbacku online/retry nie odtwarza poprzedniego konta',async()=>{
 const f=fixture();f.store.clear.mockRejectedValueOnce(new AccountError('vault unavailable','storage_error'));
 window.history.replaceState(null,'','/auth/callback#type=recovery&token_hash='+hash);render(<B1App manager={f.manager}/>);
 await screen.findByRole('heading',{name:'Brak połączenia'});fireEvent(window,new Event('online'));
 await act(async()=>{await Promise.resolve();});expect(f.request).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Spróbuj ponownie'}));await screen.findByRole('heading',{name:'Zaloguj się'});
 expect(f.store.clear).toHaveBeenCalledTimes(2);expect(f.request).not.toHaveBeenCalled();expect(f.store.write).not.toHaveBeenCalled();
});
