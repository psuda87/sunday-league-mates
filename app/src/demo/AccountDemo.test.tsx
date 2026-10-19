import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AccountView } from '../account-ui/model';
vi.mock('./App',()=>({default:({onAccount,onLogout}:{onAccount:(view:AccountView,tab:'events')=>void;onLogout:()=>void})=><div data-testid="private-world"><p>Private fixture view</p><button onClick={()=>onAccount('login','events')}>Konta</button><button onClick={onLogout}>Wyjście</button></div>}));
import AccountDemo from './AccountDemo';
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
it('never mounts private views for unverified callback URLs or a first-profile bypass',()=>{
 for(const route of ['verify','recovery','first-profile']){window.history.replaceState(null,'',`/#account/${route}`);render(<AccountDemo/>);expect(screen.queryByTestId('private-world')).toBeNull();expect(screen.getByRole('heading',{name:'Link niedostępny'})).toBeTruthy();cleanup();}
});
it('unmounts the private world immediately on logout, before showing the next login',async()=>{
 render(<AccountDemo/>);expect(screen.getByTestId('private-world')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Wyjście'}));expect(screen.queryByTestId('private-world')).toBeNull();expect(screen.getByRole('heading',{name:'Wylogowywanie'})).toBeTruthy();await waitFor(()=>expect(screen.getByRole('heading',{name:'Zaloguj się'})).toBeTruthy());expect(screen.queryByTestId('private-world')).toBeNull();
});
it('invalidates in-flight login when navigation expires the simulated session',async()=>{
 window.history.replaceState(null,'','/#account/login');render(<AccountDemo/>);
 fireEvent.change(screen.getByLabelText('Adres e-mail'),{target:{value:'demo@example.invalid'}});fireEvent.change(screen.getByLabelText('Hasło'),{target:{value:crypto.randomUUID()}});fireEvent.click(screen.getByRole('button',{name:'Zaloguj'}));fireEvent.click(screen.getByRole('button',{name:'Sesja wygasła'}));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,350));});expect(screen.queryByTestId('private-world')).toBeNull();expect(screen.getByRole('heading',{name:'Sesja wygasła'})).toBeTruthy();
});
