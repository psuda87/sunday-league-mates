import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LockedEvent, OwnEvent } from './EventAccessView';
import { initialWorld, reduceWorld } from './data';
import { DemoPanels } from './Panels';
import DemoTeams from './Teams';
import DemoFinance from './Finance';
afterEach(cleanup);
it('renders a genuinely limited private list item and standalone guards without participants, count or financial details',()=>{
 const world=reduceWorld(initialWorld(),{type:'user',id:'p40'}),game=world.games[0];
 render(<><LockedEvent world={world} game={game}/><DemoPanels world={world} game={game} dispatch={vi.fn()} onPlayer={vi.fn()}/><DemoTeams world={world} game={game} dispatch={vi.fn()} onPlayer={vi.fn()}/><DemoFinance world={world} game={game} dispatch={vi.fn()} onPlayer={vi.fn()}/></>);
 expect(screen.getByText('El Clásico · demo')).toBeTruthy();expect(screen.queryByText('Kamil Zieliński')).toBeNull();expect(screen.queryByRole('progressbar')).toBeNull();expect(screen.queryByRole('tab')).toBeNull();expect(document.querySelector('.slm-finance-tiles,.slm-football-pitch,.slm-compact-count')).toBeNull();expect(screen.queryByRole('button',{name:/Otwórz szczegóły/})).toBeNull();
});
it('retained outsiders see their own organizational/financial view without foreign profile links or admin control',()=>{
 let world=initialWorld();world.games[0].entries.push({id:'own-entry',playerId:'p40',status:'registered',attendance:null,paidCents:0});world=reduceWorld(world,{type:'user',id:'p40'});world=reduceWorld(world,{type:'finance_role',role:'admin'});
 render(<OwnEvent world={world} game={world.games[0]} dispatch={vi.fn()} onBack={vi.fn()} onPlayer={vi.fn()}/>);
 expect(screen.getByRole('status')).toHaveTextContent('Zachowujesz swój udział');expect(screen.getByRole('button',{name:'Wycofaj własny zapis'})).toBeTruthy();expect(screen.queryByText('Kamil Zieliński')).toBeNull();expect(screen.queryByRole('button',{name:'Administrator demo'})).toBeNull();expect(screen.queryByRole('tab')).toBeNull();expect(document.querySelector('.slm-demo-person')).toBeTruthy();
});
