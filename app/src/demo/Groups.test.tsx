import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Groups from './GroupsScreen';
import { initialWorld, reduceWorld } from './data';
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
it('shows derived counts and invitations, without exposing an all-player catalog',()=>{
 render(<Groups world={initialWorld()} dispatch={vi.fn()} onPlayer={vi.fn()}/>);
 expect(screen.getByRole('button',{name:/Czwartkowe granie/})).toHaveTextContent('25 członków');expect(screen.getByRole('button',{name:/Niedzielne granie/})).toHaveTextContent('35 członków');expect(screen.getByRole('button',{name:'Przyjmij zaproszenie'})).toBeTruthy();expect(screen.queryByText('Nikodem Lipa')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Utwórz grupę'}));fireEvent.click(screen.getByRole('button',{name:'Utwórz grupę'}));expect(screen.getByRole('alert')).toHaveTextContent('Podaj nazwę');
});
it('guards direct group routes and opens the existing profile only for fellow members',()=>{
 window.history.replaceState(null,'','/#group/group-1');const dispatch=vi.fn(),onPlayer=vi.fn(),outsider=reduceWorld(initialWorld(),{type:'user',id:'p40'});
 const {rerender}=render(<Groups world={outsider} dispatch={dispatch} onPlayer={onPlayer}/>);expect(screen.getByText('Brak dostępu do członków')).toBeTruthy();expect(screen.queryByText('Kamil Zieliński')).toBeNull();expect(screen.queryByRole('button',{name:'Zarządzaj grupą'})).toBeNull();
 rerender(<Groups world={initialWorld()} dispatch={dispatch} onPlayer={onPlayer}/>);fireEvent.click(screen.getByRole('button',{name:'Pokaż wszystkich (25)'}));fireEvent.click(screen.getByRole('button',{name:/Kamil Zieliński/}));expect(onPlayer).toHaveBeenCalledWith('p02','group-1');
});
it('keeps member proposal UI distinct from group administration and hides telephone results',()=>{
 window.history.replaceState(null,'','/#group/group-1');const world=reduceWorld(initialWorld(),{type:'user',id:'p02'});
 const dispatch=vi.fn();render(<Groups world={world} dispatch={dispatch} onPlayer={vi.fn()}/>);expect(screen.queryByRole('button',{name:'Zarządzaj grupą'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Zaproponuj zaproszenie'}));
 fireEvent.change(screen.getByLabelText('Sposób wyszukania'),{target:{value:'phone'}});fireEvent.change(screen.getByLabelText('Dokładny numer · wyłącznie fikcyjne dane'),{target:{value:'000000036'}});fireEvent.click(screen.getByRole('button',{name:'Zaproponuj prywatne zaproszenie'}));expect(dispatch).toHaveBeenCalledWith({type:'group_phone',groupId:'group-1',phone:'000000036'});expect(screen.queryByText('Nikodem Lipa')).toBeNull();expect(screen.queryByText('+48000000036')).toBeNull();
});
