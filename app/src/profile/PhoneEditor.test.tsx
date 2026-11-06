import { afterEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import PhoneEditor from './PhoneEditor';
import type { PersonalProfileBinding } from '../ui/personalProfile';
afterEach(cleanup);
function binding():PersonalProfileBinding{return {phase:'ready',profile:{user_id:'own',login:'own',phone:'+48000000111',full_name:'',display_name:'own',display_as:'nickname',email_account:false},saving:false,notice:'',reload:vi.fn(),save:vi.fn(),changePhone:vi.fn(async()=>true)};}
it.each(['00000011','0000001111','+12025550111','48000000222','abc'])('rejects invalid phone %s before network',phone=>{
 const b=binding();render(<PhoneEditor binding={b} onClose={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Telefon'),{target:{value:phone}});
 fireEvent.click(screen.getByText('Zmień telefon'));expect(screen.getByRole('alert')).toBeTruthy();expect(b.changePhone).not.toHaveBeenCalled();
});
it('normalizes +48, clears password immediately and blocks double submit until confirmed',async()=>{
 const b=binding();let done!:(ok:boolean)=>void;b.changePhone=vi.fn(()=>new Promise<boolean>(r=>{done=r;}));const close=vi.fn();
 render(<PhoneEditor binding={b} onClose={close}/>);
 fireEvent.change(screen.getByLabelText('Telefon'),{target:{value:'+48 000 000 222'}});
 fireEvent.change(screen.getByLabelText('Obecne hasło do zmiany telefonu'),{target:{value:'current-test-secret'}});
 fireEvent.click(screen.getByText('Zmień telefon'));fireEvent.click(screen.getByText('Zmień telefon'));
 expect(b.changePhone).toHaveBeenCalledExactlyOnceWith('+48000000222','current-test-secret',false);
 expect(screen.getByLabelText('Obecne hasło do zmiany telefonu')).toHaveValue('');expect(close).not.toHaveBeenCalled();
 done(true);await waitFor(()=>expect(close).toHaveBeenCalledOnce());
});
it('allows legacy phone removal and defaults sharing to off',async()=>{
 const b=binding();render(<PhoneEditor binding={b} onClose={vi.fn()}/>);
 expect(screen.getByRole('checkbox')).not.toBeChecked();fireEvent.change(screen.getByLabelText('Telefon'),{target:{value:''}});
 fireEvent.change(screen.getByLabelText('Obecne hasło do zmiany telefonu'),{target:{value:'fixture'}});fireEvent.submit(screen.getByRole('form'));
 await waitFor(()=>expect(b.changePhone).toHaveBeenCalledWith('','fixture',false));
});
it('saves explicit sharing opt-in without changing the number',async()=>{
 const b=binding();render(<PhoneEditor binding={b} onClose={vi.fn()}/>);
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.change(screen.getByLabelText('Obecne hasło do zmiany telefonu'),{target:{value:'fixture'}});fireEvent.submit(screen.getByRole('form'));
 await waitFor(()=>expect(b.changePhone).toHaveBeenCalledWith('+48000000111','fixture',true));
});
it('retains phone draft on failure without displaying server diagnostics or password',async()=>{
 const b=binding();b.changePhone=vi.fn(async()=>false);const close=vi.fn();render(<PhoneEditor binding={b} onClose={close}/>);
 fireEvent.change(screen.getByLabelText('Telefon'),{target:{value:'0048 000 000 222'}});
 fireEvent.change(screen.getByLabelText('Obecne hasło do zmiany telefonu'),{target:{value:'secret'}});
 fireEvent.click(screen.getByText('Zmień telefon'));await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
 expect(screen.getByLabelText('Telefon')).toHaveValue('0048 000 000 222');expect(screen.getByLabelText('Obecne hasło do zmiany telefonu')).toHaveValue('');expect(close).not.toHaveBeenCalled();
});
