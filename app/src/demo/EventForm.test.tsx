import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EventForm from './EventForm';
import DemoBottomNav from './DemoBottomNav';
import { initialWorld, reduceWorld } from './data';
afterEach(cleanup);
it('keeps three real tabs and exposes create as a separate administrator action',()=>{
 const onCreate=vi.fn(),onSelect=vi.fn();const {rerender}=render(<DemoBottomNav active="events" onSelect={onSelect} canCreate={false} onCreate={onCreate}/>);
 expect(screen.getAllByRole('button').map(el=>el.textContent)).toEqual(['Mecze','Zawodnicy','Profil']);expect(screen.queryByLabelText('Utwórz mecz')).toBeNull();
 rerender(<DemoBottomNav active="events" onSelect={onSelect} canCreate onCreate={onCreate}/>);
 const create=screen.getByRole('button',{name:'Utwórz mecz'});expect(create.hasAttribute('aria-current')).toBe(false);fireEvent.click(create);expect(onCreate).toHaveBeenCalledOnce();expect(onSelect).not.toHaveBeenCalled();
});
it('does not reveal fields or save actions to an ordinary demo user',()=>{
 render(<EventForm world={initialWorld()} onBack={()=>{}} onSave={vi.fn()}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('tylko dla administratora');expect(screen.queryByLabelText('Data')).toBeNull();
});
it('keeps preview separate from save and preserves input on return or cancellation',()=>{
 const world=reduceWorld(initialWorld(),{type:'event_role',role:'admin'}),save=vi.fn(),back=vi.fn();
 render(<EventForm world={world} onBack={back} onSave={save}/>);
 fireEvent.change(screen.getByLabelText('Nazwa meczu · opcjonalnie'),{target:{value:'Nowe granie'}});
 fireEvent.click(screen.getByRole('button',{name:'Podgląd meczu'}));expect(save).not.toHaveBeenCalled();expect(screen.getByText('Nowe granie')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Wróć do edycji'}));expect(screen.getByLabelText('Nazwa meczu · opcjonalnie')).toHaveValue('Nowe granie');
 fireEvent.click(screen.getByRole('button',{name:'Anuluj'}));expect(back).toHaveBeenCalledOnce();expect(save).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Podgląd meczu'}));fireEvent.click(screen.getByRole('button',{name:'Utwórz mecz'}));fireEvent.click(screen.getByRole('button',{name:'Utwórz mecz'}));expect(save).toHaveBeenCalledOnce();
});
