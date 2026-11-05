import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {AccountDeletion} from './PhoneEditor';
import {AccountError} from '../auth/api';
import type {PersonalProfileBinding} from '../ui/personalProfile';
afterEach(cleanup);
function binding():PersonalProfileBinding{return {phase:'ready',profile:null,saving:false,notice:'',reload:vi.fn(),save:vi.fn(),deleteAccount:vi.fn(async()=>undefined)};}
it('requires explicit confirmation and current password before any network call',()=>{
 const b=binding();render(<AccountDeletion binding={b}/>);fireEvent.click(screen.getByText('Usuń konto'));
 fireEvent.submit(screen.getByRole('form'));expect(b.deleteAccount).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('USUŃ KONTO');
});
it('clears password, blocks duplicates, retains the same capability and retries uncertain work without reauthentication',async()=>{
 const b=binding();b.deleteAccount=vi.fn().mockRejectedValueOnce(new AccountError('network','network_error')).mockResolvedValue(undefined);
 render(<AccountDeletion binding={b}/>);fireEvent.click(screen.getByText('Usuń konto'));
 fireEvent.change(screen.getByLabelText('Obecne hasło do usunięcia konta'),{target:{value:'fixture-password'}});
 fireEvent.change(screen.getByLabelText('Wpisz USUŃ KONTO'),{target:{value:'USUŃ KONTO'}});
 fireEvent.submit(screen.getByRole('form'));fireEvent.submit(screen.getByRole('form'));
 await screen.findByText('Ponów sprawdzenie usuwania');expect(b.deleteAccount).toHaveBeenCalledOnce();
 const first=vi.mocked(b.deleteAccount!).mock.calls[0];expect(first[2].proof).toHaveLength(64);
 expect(screen.queryByLabelText('Obecne hasło do usunięcia konta')).toBeNull();
 fireEvent.submit(screen.getByRole('form'));await waitFor(()=>expect(b.deleteAccount).toHaveBeenCalledTimes(2));
 expect(vi.mocked(b.deleteAccount!).mock.calls[1]).toEqual(['','USUŃ KONTO',first[2],true]);
});
it('requires group handover without claiming deletion has started',async()=>{
 const b=binding();b.deleteAccount=vi.fn(async()=>{throw new AccountError('transfer','group_transfer_required');});
 render(<AccountDeletion binding={b}/>);fireEvent.click(screen.getByText('Usuń konto'));
 fireEvent.change(screen.getByLabelText('Obecne hasło do usunięcia konta'),{target:{value:'fixture-password'}});
 fireEvent.change(screen.getByLabelText('Wpisz USUŃ KONTO'),{target:{value:'USUŃ KONTO'}});fireEvent.submit(screen.getByRole('form'));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Przekaż administratora'));
 expect(screen.getByLabelText('Obecne hasło do usunięcia konta')).toHaveValue('');expect(screen.getByText('Anuluj usunięcie')).toBeEnabled();
});
