import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import DemoFinance from './Finance';
import { initialWorld, reduceWorld } from './data';
it('projects only own obligations and invited guests, with no foreign status or editing controls',()=>{
 const world=reduceWorld(initialWorld(),{type:'user',id:'p02'}),dispatch=vi.fn(),onPlayer=vi.fn();
 render(<DemoFinance world={world} game={world.games[0]} dispatch={dispatch} onPlayer={onPlayer}/>);
 expect(document.querySelectorAll('.slm-finance-rows > li')).toHaveLength(3);
 expect(screen.queryByRole('button',{name:'Marek Lis'})).toBeNull();expect(screen.queryByText('Zmień wpłatę · demo')).toBeNull();
 expect(screen.getByRole('progressbar',{name:'Postęp własnych wpłat'})).toHaveAttribute('aria-valuenow','47');
 fireEvent.click(screen.getByRole('button',{name:'Daniel Rzeka'}));expect(onPlayer).toHaveBeenCalledWith('p19');
 expect(screen.queryByRole('button',{name:'Gość Kamila · demo'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Administrator demo'}));expect(dispatch).toHaveBeenCalledWith({type:'finance_role',role:'admin'});
});
it('validates partial payment input in demo admin and hides it again when role changes',()=>{
 let world=reduceWorld(initialWorld(),{type:'finance_role',role:'admin'});const dispatch=vi.fn(),onPlayer=vi.fn();
 const {rerender}=render(<DemoFinance world={world} game={world.games[0]} dispatch={dispatch} onPlayer={onPlayer}/>);
 const row=document.querySelector('.slm-finance-rows > li')!;row.querySelector('details')!.open=true;
 fireEvent.click(within(row as HTMLElement).getByRole('button',{name:'Wprowadź kwotę'}));
 const field=screen.getByLabelText('Kwota zaksięgowana w demo (zł)');
 fireEvent.change(field,{target:{value:'1,234'}});fireEvent.click(screen.getByRole('button',{name:'Zapisz kwotę demo'}));
 expect(screen.getByRole('alert')).toHaveTextContent('2 cyfry');expect(dispatch).not.toHaveBeenCalled();
 fireEvent.change(field,{target:{value:'11,25'}});fireEvent.click(screen.getByRole('button',{name:'Zapisz kwotę demo'}));
 expect(dispatch).toHaveBeenCalledWith({type:'payment_set',gameId:'demo-1',entryId:'g0-e0',cents:1125});
 world=reduceWorld(world,{type:'finance_role',role:'player'});rerender(<DemoFinance world={world} game={world.games[0]} dispatch={dispatch} onPlayer={onPlayer}/>);
 expect(screen.queryByRole('form')).toBeNull();expect(document.querySelectorAll('.slm-finance-rows > li')).toHaveLength(0);
});
