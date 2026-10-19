import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EventForm from './EventForm';
import DemoBottomNav from './DemoBottomNav';
import { initialWorld, reduceWorld } from './data';
afterEach(cleanup);
it('keeps three real tabs and exposes create as a separate administrator action',()=>{
 const onCreate=vi.fn(),onSelect=vi.fn();const {rerender}=render(<DemoBottomNav active="events" onSelect={onSelect} canCreate={false} onCreate={onCreate}/>);
 expect(screen.getAllByRole('button').map(el=>el.textContent)).toEqual(['Mecze','Grupy','Profil']);expect(screen.queryByLabelText('Utwórz mecz')).toBeNull();
 rerender(<DemoBottomNav active="events" onSelect={onSelect} canCreate onCreate={onCreate}/>);
 const create=screen.getByRole('button',{name:'Utwórz mecz'});expect(create.hasAttribute('aria-current')).toBe(false);fireEvent.click(create);expect(onCreate).toHaveBeenCalledOnce();expect(onSelect).not.toHaveBeenCalled();
});
it('does not reveal fields or save actions to an ordinary demo user',()=>{
 render(<EventForm world={reduceWorld(initialWorld(),{type:'user',id:'p04'})} onBack={()=>{}} onSave={vi.fn()}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('Brak uprawnień');expect(screen.queryByLabelText('Data')).toBeNull();
});
it('keeps preview separate from save and preserves input on return or cancellation',()=>{
 const world=initialWorld(),save=vi.fn(),back=vi.fn();
 render(<EventForm world={world} onBack={back} onSave={save}/>);
 fireEvent.change(screen.getByLabelText('Grupa organizująca'),{target:{value:'group-1'}});
 fireEvent.change(screen.getByLabelText('Nazwa meczu · opcjonalnie'),{target:{value:'Nowe granie'}});
 fireEvent.click(screen.getByRole('button',{name:'Podgląd meczu'}));expect(save).not.toHaveBeenCalled();expect(screen.getByText('Nowe granie')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Wróć do edycji'}));expect(screen.getByLabelText('Nazwa meczu · opcjonalnie')).toHaveValue('Nowe granie');
 fireEvent.click(screen.getByRole('button',{name:'Anuluj'}));expect(back).toHaveBeenCalledOnce();expect(save).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Podgląd meczu'}));fireEvent.click(screen.getByRole('button',{name:'Utwórz mecz'}));fireEvent.click(screen.getByRole('button',{name:'Utwórz mecz'}));expect(save).toHaveBeenCalledOnce();
});
it('lists only eligible groups, requires choice for multiple, and defaults private',()=>{
 const world=initialWorld();render(<EventForm world={world} onBack={()=>{}} onSave={vi.fn()}/>);
 expect(screen.getByLabelText('Grupa organizująca')).toHaveValue('');
 expect([...screen.getByLabelText('Grupa organizująca').querySelectorAll('option')].map(el=>el.value)).toEqual(['','group-1','group-2']);
 expect(screen.getByLabelText('Widoczność meczu')).toHaveValue('private');
 fireEvent.click(screen.getByRole('button',{name:'Podgląd meczu'}));expect(screen.getByRole('alert')).toHaveTextContent('Wybierz grupę');
});
it('auto-selects a single group and removes an already-started form when permission is revoked',()=>{
 let world=reduceWorld(initialWorld(),{type:'user',id:'p39'});const save=vi.fn();
 const {rerender}=render(<EventForm world={world} onBack={()=>{}} onSave={save}/>);expect(screen.getByLabelText('Grupa organizująca')).toHaveValue('group-4');
 fireEvent.click(screen.getByRole('button',{name:'Podgląd meczu'}));expect(screen.getByRole('button',{name:'Utwórz mecz'})).toBeTruthy();
 world=reduceWorld(world,{type:'group_leave',groupId:'group-4'});rerender(<EventForm world={world} onBack={()=>{}} onSave={save}/>);
 expect(screen.queryByRole('button',{name:'Utwórz mecz'})).toBeNull();expect(screen.getByRole('alert')).toHaveTextContent('Brak uprawnień');expect(save).not.toHaveBeenCalled();
});
it('guards ownership even for a group administrator who did not create the match',()=>{
 const world=reduceWorld(initialWorld(),{type:'user',id:'p01'});
 render(<EventForm world={world} game={world.games[1]} onBack={()=>{}} onSave={vi.fn()}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('edycja należy do twórcy');expect(screen.queryByLabelText('Data')).toBeNull();
});
it('rechecks the selected group at confirmation even if another group still permits creating events',()=>{
 let world=reduceWorld(initialWorld(),{type:'user',id:'p03'});const save=vi.fn();
 const {rerender}=render(<EventForm world={world} onBack={()=>{}} onSave={save}/>);
 fireEvent.change(screen.getByLabelText('Grupa organizująca'),{target:{value:'group-1'}});fireEvent.click(screen.getByRole('button',{name:'Podgląd meczu'}));
 world=reduceWorld(world,{type:'user',id:'p01'});world=reduceWorld(world,{type:'group_permission',groupId:'group-1',targetId:'p03',allow:false});world=reduceWorld(world,{type:'user',id:'p03'});
 rerender(<EventForm world={world} onBack={()=>{}} onSave={save}/>);fireEvent.click(screen.getByRole('button',{name:'Utwórz mecz'}));expect(save).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('Uprawnienia do zapisu zostały cofnięte');
});
