import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import GuestForm from './GuestForm';

afterEach(cleanup);
function setup(onSave=vi.fn().mockResolvedValue(true),hasPlace=true){
 render(<GuestForm disabled={false} hasPlace={hasPlace} onSave={onSave}/>);
 fireEvent.change(screen.getByLabelText('Imię lub pseudonim gościa'),{target:{value:' Gość testowy '}});
 return onSave;
}
it.each(['000000111','+48 000 000 111','0048 000 000 111'])('normalizes %s and resets only after confirmed success',async phone=>{
 const save=setup();fireEvent.change(screen.getByLabelText('Telefon gościa · opcjonalnie'),{target:{value:phone}});
 fireEvent.submit(screen.getByRole('form',{name:'Dodawanie gościa'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith({guest_name:'Gość testowy',guest_phone:'+48000000111',list:'registered'}));
 await waitFor(()=>expect(screen.getByLabelText('Imię lub pseudonim gościa')).toHaveValue(''));
});
it.each(['00000011','0000001111','+12025550111','abc','0'.repeat(33)])('rejects invalid/new foreign input %s without API call',async phone=>{
 const save=setup();fireEvent.change(screen.getByLabelText('Telefon gościa · opcjonalnie'),{target:{value:phone}});
 fireEvent.submit(screen.getByRole('form',{name:'Dodawanie gościa'}));
 expect(save).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('9 cyfr');
 expect(screen.getByLabelText('Telefon gościa · opcjonalnie')).toHaveAttribute('maxlength','32');
});
it('keeps the entire draft after an unconfirmed/network write and allows retry',async()=>{
 const save=setup(vi.fn().mockRejectedValueOnce(Error('private detail')).mockResolvedValue(true));
 fireEvent.change(screen.getByLabelText('Telefon gościa · opcjonalnie'),{target:{value:'000000111'}});
 fireEvent.submit(screen.getByRole('form',{name:'Dodawanie gościa'}));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('pozostawiono'));
 expect(screen.getByLabelText('Imię lub pseudonim gościa')).toHaveValue(' Gość testowy ');
 expect(screen.getByLabelText('Telefon gościa · opcjonalnie')).toHaveValue('000000111');
 expect(screen.getByRole('alert')).not.toHaveTextContent('private detail');
 fireEvent.submit(screen.getByRole('form',{name:'Dodawanie gościa'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));
});
it('coalesces duplicate submissions and allows an optional phone on the reserve',async()=>{
 let resolve!:(ok:boolean)=>void;
 const save=setup(vi.fn(()=>new Promise<boolean>(r=>{resolve=r;})),false);
 fireEvent.submit(screen.getByRole('form',{name:'Dodawanie gościa'}));expect(save).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Lista'),{target:{value:'reserve'}});
 fireEvent.submit(screen.getByRole('form',{name:'Dodawanie gościa'}));fireEvent.submit(screen.getByRole('form',{name:'Dodawanie gościa'}));
 expect(save).toHaveBeenCalledOnce();expect(save).toHaveBeenCalledWith({guest_name:'Gość testowy',guest_phone:'',list:'reserve'});
 resolve(false);await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Nie potwierdzono'));
});
it('prevents saving when the server access/busy gate disables the form',()=>{
 const save=vi.fn();render(<GuestForm disabled hasPlace onSave={save}/>);
 fireEvent.submit(screen.getByRole('form',{name:'Dodawanie gościa'}));expect(save).not.toHaveBeenCalled();
 expect(screen.getByLabelText('Telefon gościa · opcjonalnie')).toBeDisabled();
});
