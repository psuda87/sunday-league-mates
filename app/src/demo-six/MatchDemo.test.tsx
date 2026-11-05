import { useReducer } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import DemoTeams from '../demo/Teams';
import { personName, reduceWorld, registered, teamEntries } from '../demo/data';
import { createMatchDemo, matchId, participantNames } from './fixture';

it('isolates all twelve names and automatically splits six against six with no charges or real identities', () => {
  const world = createMatchDemo(), game = world.games[0], teams = teamEntries(game);
  expect(world.games).toHaveLength(1);
  expect(registered(game).map(entry => personName(world, entry))).toEqual(participantNames);
  expect(teams.a).toHaveLength(6); expect(teams.b).toHaveLength(6);
  expect(teams.unassigned).toHaveLength(0);
  expect(new Set([...teams.a, ...teams.b].map(entry => entry.id)).size).toBe(12);
  expect(game.costCents).toBe(0);
  expect(world.players.every(player => player.id.startsWith('demo-six-'))).toBe(true);
  expect(game.entries[11]).toMatchObject({playerId: null, guestName: 'kolega krystiana', inviterId: world.players[10].id});
});

it('reuses the original UI and reducer to swap a member with a guest, then restore a fresh 6v6', () => {
  function Harness() {
    const [world, dispatch] = useReducer(reduceWorld, undefined, createMatchDemo);
    return <DemoTeams world={world} game={world.games[0]} dispatch={dispatch} onPlayer={() => undefined}/>;
  }
  render(<Harness/>);
  const a = screen.getByRole('region', {name: 'Drużyna A, 6 osób'});
  const b = screen.getByRole('region', {name: 'Drużyna B, 6 osób'});
  fireEvent.click(screen.getByRole('button', {name: 'Zamień zawodników'}));
  fireEvent.click(within(a).getByRole('button', {name: 'Wybierz do zamiany: suda'}));
  fireEvent.click(within(b).getByRole('button', {name: 'Wybierz do zamiany: kolega krystiana'}));
  expect(within(a).getByRole('button', {name: 'Wybierz do zamiany: kolega krystiana'})).toBeTruthy();
  expect(within(b).getByRole('button', {name: 'Wybierz do zamiany: suda'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: 'Reset podziału'}));
  expect(within(a).getByRole('button', {name: 'Wybierz do zamiany: suda'})).toBeTruthy();
  expect(within(b).getByRole('button', {name: 'Wybierz do zamiany: kolega krystiana'})).toBeTruthy();
});

it('rejects a swap within one team and does not mutate another browser instance', () => {
  const first = createMatchDemo(), second = createMatchDemo();
  const game = first.games[0], original = structuredClone(game.lineup), a = game.lineup!.a;
  expect(reduceWorld(first, {type: 'lineup_swap', gameId: matchId, a: a[0], b: a[1]})).toBe(first);
  const changed = reduceWorld(first, {type: 'lineup_swap', gameId: matchId, a: a[0], b: game.lineup!.b[5]});
  expect(changed.games[0].lineup).not.toEqual(original);
  expect(first.games[0].lineup).toEqual(original);
  expect(second.games[0].lineup).toEqual(original);
  expect(createMatchDemo().games[0].lineup).toEqual(original);
});
