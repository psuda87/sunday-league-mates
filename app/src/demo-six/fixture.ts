import { reduceWorld } from '../demo/data';
import type { World } from '../demo/data';

export const participantNames = ['suda', 'adam p.', 'sebastian s.', 'ariel', 'marek', 'michał', 'tomek B', 'Mateusz', 'dawid', 'kuba', 'krystian', 'kolega krystiana'] as const;
export const matchId = 'demo-six-match';

// Fictional identities only. No account IDs, contacts, database or storage writes.
export function createMatchDemo(): World {
  const players = participantNames.slice(0, 11).map((name, index) => ({
    id: `demo-six-player-${index + 1}`, name, jerseyNumber: index + 1,
    demoTotals: {goals: 0, assists: 0, mvp: 0},
  }));
  const world: World = {
    players, userId: players[0].id, financeRole: 'player', nextGameId: 1, notice: '',
    groupState: {
      groups: [{id: 'demo-six-group', name: 'Ekipa testowa · demo', description: 'Wyłącznie fikcyjny mecz 6 na 6.', adminId: players[0].id}],
      members: players.map(player => ({groupId: 'demo-six-group', playerId: player.id, joinedAt: '2026-11-05T12:00:00Z', organizer: false})),
      requests: [], nextId: 1, clock: 1,
    },
    games: [{
      id: matchId, groupId: 'demo-six-group', createdBy: players[0].id, visibility: 'private',
      name: 'Sparing 6 na 6 · demo', startsAt: '2026-11-12T18:00:00Z', status: 'upcoming',
      capacity: 12, costCents: 0, location: 'Boisko testowe · fikcyjna lokalizacja',
      entries: participantNames.map((name, index) => ({
        id: `demo-six-entry-${index + 1}`, playerId: players[index]?.id ?? null,
        ...(index === 11 ? {guestName: name, inviterId: players[10].id} : {}),
        status: 'registered', attendance: null, paidCents: 0,
      })),
    }],
  };
  // Reuse the historical alternating split and guest-safe swap reducer unchanged.
  return reduceWorld(world, {type: 'lineup_reset', gameId: matchId});
}
