import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccountScreens from './AccountScreens';
import type { AccountUiPort } from './model';
import { accountRoute, emptyProfile, emailProblem, passwordProblem, profileProblems, AccountUiFailure } from './model';
const port=():AccountUiPort=>({signIn:vi.fn().mockResolvedValue(undefined),signUp:vi.fn().mockResolvedValue(undefined),signOut:vi.fn().mockResolvedValue(undefined),resendVerification:vi.fn().mockResolvedValue(undefined),requestPasswordReset:vi.fn().mockResolvedValue(undefined),updatePassword:vi.fn().mockResolvedValue(undefined),restoreSession:vi.fn().mockResolvedValue(undefined),completeRedirect:vi.fn().mockResolvedValue(undefined),saveProfile:vi.fn().mockResolvedValue(undefined)});
afterEach(cleanup);
it('validates login, normalizes email, toggles password, serializes submits and clears transient password',async()=>{
 const adapter=port();let finish=()=>{};adapter.signIn=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
 render(<AccountScreens view="login" port={adapter} onNavigate={vi.fn()} demo/>);
 fireEvent.click(screen.getByRole('button',{name:'Zaloguj'}));expect(screen.getByRole('alert')).toHaveTextContent('Podaj adres e-mail');expect(adapter.signIn).not.toHaveBeenCalled();
 const secret=crypto.randomUUID();fireEvent.change(screen.getByLabelText('Adres e-mail'),{target:{value:'  GRACZ@example.invalid  '}});fireEvent.change(screen.getByLabelText('Hasło'),{target:{value:secret}});fireEvent.click(screen.getByRole('button',{name:'Pokaż hasło: Hasło'}));expect(screen.getByLabelText('Hasło')).toHaveAttribute('type','text');
 const form=screen.getByRole('form');fireEvent.submit(form);fireEvent.submit(form);expect(adapter.signIn).toHaveBeenCalledTimes(1);expect(adapter.signIn).toHaveBeenCalledWith('gracz@example.invalid',secret);finish();await waitFor(()=>expect(screen.getByLabelText('Hasło')).toHaveValue(''));
});
it('shows a clear, neutral message for incorrect login or password',async()=>{
 const adapter=port();adapter.signIn=vi.fn().mockRejectedValue(new AccountUiFailure('credentials'));
 render(<AccountScreens view="login" port={adapter} onNavigate={vi.fn()} loginOrPhone/>);
 fireEvent.change(screen.getByLabelText('E-mail lub login'),{target:{value:'nieznany'}});
 fireEvent.change(screen.getByLabelText('Hasło'),{target:{value:'bledne-haslo'}});
 fireEvent.submit(screen.getByRole('form'));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Nieprawidłowy e-mail, login lub hasło.'));
 expect(screen.getByRole('alert')).not.toHaveTextContent('AccountUiFailure');
});
it('registers only after consent and matching policy, with optional phone/number and no group',async()=>{
 const adapter=port();render(<AccountScreens view="register" port={adapter} onNavigate={vi.fn()} demo/>);
 const secret=crypto.randomUUID();fireEvent.change(screen.getByLabelText('Nazwa zawodnika / pseudonim'),{target:{value:'Debiutant'}});fireEvent.change(screen.getByLabelText('Adres e-mail'),{target:{value:'demo@example.invalid'}});fireEvent.change(screen.getByLabelText('Hasło'),{target:{value:secret}});fireEvent.change(screen.getByLabelText('Powtórz hasło'),{target:{value:secret}});
 fireEvent.submit(screen.getByRole('form'));expect(adapter.signUp).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('Akceptacja');fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(screen.getByRole('form'));
 await waitFor(()=>expect(adapter.signUp).toHaveBeenCalledOnce());expect(vi.mocked(adapter.signUp).mock.calls[0][0]).toEqual({...emptyProfile(),nickname:'Debiutant',jerseyNumber:undefined});expect(screen.queryByLabelText('Grupa')).toBeNull();
});
it('has neutral network/credential errors and never claims real demo mail was sent',async()=>{
 const adapter=port();adapter.requestPasswordReset=vi.fn().mockRejectedValue(new AccountUiFailure('network'));render(<AccountScreens view="forgot" port={adapter} onNavigate={vi.fn()} demo/>);
 fireEvent.change(screen.getByLabelText('Adres e-mail'),{target:{value:'demo@example.invalid'}});fireEvent.submit(screen.getByRole('form'));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Brak połączenia'));
 cleanup();render(<AccountScreens view="verify" port={port()} onNavigate={vi.fn()} demo/>);expect(screen.getByText(/Żadna wiadomość nie została wysłana/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Wyślij ponownie'}));await waitFor(()=>expect(screen.getByRole('button',{name:/Ponów za/})).toBeDisabled());
});
it('blocks wrong confirmation and renders optional first profile with zero stats/no photo',()=>{
 const adapter=port();const {rerender}=render(<AccountScreens view="reset" port={adapter} onNavigate={vi.fn()} demo/>);fireEvent.change(screen.getByLabelText('Nowe hasło'),{target:{value:crypto.randomUUID()}});fireEvent.submit(screen.getByRole('form'));expect(screen.getByRole('alert')).toHaveTextContent('Hasła muszą być takie same');expect(adapter.updatePassword).not.toHaveBeenCalled();
 rerender(<AccountScreens key="profile" view="first-profile" port={adapter} profile={{...emptyProfile(),nickname:'Debiutant'}} onNavigate={vi.fn()} demo/>);expect(document.querySelector('.slm-ultimate-portrait')).toHaveAttribute('data-portrait','initials');expect([...document.querySelectorAll('.slm-ultimate-stats dd')].map(el=>el.textContent)).toEqual(['0','0','0','0']);expect(screen.getByRole('img',{name:'Ocena 7,0 na 10'})).toBeInTheDocument();expect(screen.queryByLabelText('Adres e-mail')).toBeNull();
});
it('keeps callback routes fail-closed, validates optional fields and matches the existing password boundary',()=>{
 expect(accountRoute('#account/verify')).toBe('invalid-link');expect(accountRoute('#account/recovery')).toBe('invalid-link');expect(accountRoute('#account/first-profile')).toBe('invalid-link');expect(accountRoute('#group/group-1')).toBeNull();
 expect(emailProblem('demo@example.invalid')).toBe('');expect(emailProblem('bad')).not.toBe('');expect(passwordProblem('x'.repeat(8))).toBe('');expect(passwordProblem('x'.repeat(7))).not.toBe('');expect(passwordProblem('ą'.repeat(37))).not.toBe('');
 expect(profileProblems({...emptyProfile(),nickname:'Debiutant'})).toEqual([]);expect(profileProblems({...emptyProfile(),nickname:'Debiutant',jerseyNumber:100})).not.toEqual([]);
});
