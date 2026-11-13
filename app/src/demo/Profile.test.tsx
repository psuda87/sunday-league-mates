import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import DemoProfile from './Profile';
import { initialWorld } from './data';
it('validates a demo number before dispatch and hides editing when the simulated owner changes',()=>{
 const world=initialWorld(),dispatch=vi.fn(),onBack=vi.fn();
 const {rerender}=render(<DemoProfile world={world} id="p01" personal onBack={onBack} dispatch={dispatch}/>);
 expect(screen.getByRole('region',{name:'Cztery podstawowe statystyki demonstracyjne'})).toBeTruthy();
 expect(screen.queryByText('Historia demo z poprzedniego etapu')).toBeNull();
 expect(screen.queryByRole('button',{name:'Zmień numer koszulki, obecnie 10'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Edytuj profil'}));
 fireEvent.click(screen.getByRole('button',{name:'Zmień numer koszulki · 10'}));
 const input=screen.getByLabelText('Twój numer koszulki · demo (0–99)');
 for(const value of ['100','-1','1.5','','abc']){
  fireEvent.change(input,{target:{value}});fireEvent.click(screen.getByRole('button',{name:'Zapisz numer'}));
  expect(screen.getByRole('alert')).toHaveTextContent('0 do 99');expect(dispatch).not.toHaveBeenCalled();
 }
 fireEvent.change(input,{target:{value:'0'}});fireEvent.click(screen.getByRole('button',{name:'Zapisz numer'}));
 expect(dispatch).toHaveBeenLastCalledWith({type:'jersey',playerId:'p01',number:0});
 expect(screen.queryByRole('button',{name:'Zmień numer koszulki, obecnie 10'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Edytuj profil'}));
 fireEvent.click(screen.getByRole('button',{name:'Zmień numer koszulki · 10'}));
 rerender(<DemoProfile world={{...world,userId:'p02'}} id="p01" personal onBack={onBack} dispatch={dispatch}/>);
 expect(screen.queryByRole('form')).toBeNull();expect(screen.queryByRole('button',{name:/Zmień numer/})).toBeNull();
 expect(screen.getByLabelText('Numer koszulki 10')).toHaveTextContent('10');
});
