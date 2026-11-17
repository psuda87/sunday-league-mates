// Fikcyjne odznaki wyłącznie dla demo: progi z tych samych liczb co statystyki pod kartą,
// kilka stałych przykładów, żeby było widać zdobyte i postęp. Nie przenosić do produkcji.
import type { BadgeState } from './BadgeList';

export function demoBadgeStates(played: number, totals: { goals: number; assists: number }, playerId: string): BadgeState[] {
  const seed = [...playerId].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const day = (offset: number) => new Date(Date.UTC(2026, 9, 1 + ((seed + offset) % 28), 18)).toISOString();
  const states: BadgeState[] = [
    { code: 'SLM-MAT-001', ...(played >= 1 ? { earnedAt: day(0) } : { current: played }) },
    { code: 'SLM-MAT-010', ...(played >= 10 ? { earnedAt: day(3) } : { current: played }) },
    { code: 'SLM-MAT-050', current: played },
    { code: 'SLM-MAT-100', current: played },
    { code: 'SLM-GOL-100', current: totals.goals },
    { code: 'SLM-AST-100', current: totals.assists },
    { code: 'SLM-STR-010', current: Math.min(played, 4 + (seed % 5)) },
    { code: 'SLM-MON-003', current: 1 + (seed % 2) },
    { code: 'SLM-MON-006', current: 1 + (seed % 2) },
    { code: 'SLM-MON-012', current: 1 + (seed % 2) },
    { code: 'SLM-YRS-2027', current: 0 },
    { code: 'SLM-WIN-005', current: seed % 4 },
    { code: 'SLM-ATT-020', current: Math.min(19, played + 2) },
    { code: 'SLM-REL-020', current: Math.min(19, played) },
    { code: 'SLM-GST-010', current: seed % 4 },
  ];
  if (played >= 1) {
    states.push({ code: 'SLM-LST-005', earnedAt: day(9) }, { code: 'SLM-BEN-010', current: 3 + (seed % 6) });
    if (seed % 2 === 0) states.push({ code: 'SLM-COM-001', earnedAt: day(14) });
  }
  return states;
}
