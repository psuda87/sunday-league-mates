import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import DemoTeams from './Teams';
import { initialWorld, reduceWorld } from './data';
it('separates normal profile navigation from explicit swap selection and reads live jersey numbers',()=>{
 let world=initialWorld();const dispatch=vi.fn(),onPlayer=vi.fn();
 const {rerender}=render(<DemoTeams world={world} game={world.games[0]} dispatch={dispatch} onPlayer={onPlayer}/>);
 fireEvent.click(screen.getByRole('button',{name:'Otwórz kartę: Kamil Zieliński'}));expect(onPlayer).toHaveBeenCalledWith('p02');onPlayer.mockClear();
 expect(screen.queryByRole('button',{name:/Otwórz kartę: Gość Kamila/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Zamień zawodników'}));
 const a=screen.getByRole('button',{name:'Wybierz do zamiany: Kamil Zieliński'});
 fireEvent.click(a);expect(a).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:'Wybierz do zamiany: Marek Lis'}));
 expect(dispatch).toHaveBeenLastCalledWith({type:'lineup_swap',gameId:'demo-1',a:'g0-e0',b:'g0-e1'});expect(onPlayer).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Zakończ zamiany'}));
 world=reduceWorld(world,{type:'user',id:'p02'});world=reduceWorld(world,{type:'jersey',playerId:'p02',number:0});
 rerender(<DemoTeams world={world} game={world.games[0]} dispatch={dispatch} onPlayer={onPlayer}/>);
 expect(within(screen.getByRole('button',{name:'Otwórz kartę: Kamil Zieliński'})).getByText('0')).toBeTruthy();
});
it('shows an honest empty state and a disabled creation action when fewer than two players exist',()=>{
 const world=initialWorld(),dispatch=vi.fn(),onPlayer=vi.fn();
 const {rerender}=render(<DemoTeams world={world} game={world.games[3]} dispatch={dispatch} onPlayer={onPlayer}/>);
 expect(screen.getByRole('button',{name:'Utwórz przykładowe składy'})).toBeDisabled();
 expect(screen.getByText('Potrzeba co najmniej dwóch uczestników.')).toBeTruthy();
 rerender(<DemoTeams world={world} game={world.games[2]} dispatch={dispatch} onPlayer={onPlayer}/>);
 fireEvent.click(screen.getByRole('button',{name:'Utwórz przykładowe składy'}));expect(dispatch).toHaveBeenCalledWith({type:'lineup_reset',gameId:'demo-3'});
 rerender(<DemoTeams world={world} game={world.games[8]} dispatch={dispatch} onPlayer={onPlayer}/>);
 expect(screen.getByText('Mecz anulowany')).toBeTruthy();expect(screen.queryByRole('button',{name:'Utwórz przykładowe składy'})).toBeNull();
});
