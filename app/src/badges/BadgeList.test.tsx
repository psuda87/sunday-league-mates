import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BadgeList from './BadgeList';
import { demoBadgeStates } from './demoBadges';

describe('BadgeList', () => {
  it('pokazuje zdobyte, a niezdobyte chowa pod „Pokaż pozostałe”', () => {
    render(<BadgeList states={[{ code: 'SLM-MAT-001', earnedAt: '2026-10-12T18:00:00Z' }, { code: 'SLM-MAT-050', current: 34 }]} />);
    expect(screen.getByText('1/20')).toBeInTheDocument();
    expect(screen.getByText('Debiutant')).toBeVisible();
    expect(screen.getByText(/12\.10\.2026/)).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Pokaż pozostałe (19)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Weteran')).not.toBeVisible();
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Ukryj pozostałe' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Weteran')).toBeVisible();
    expect(screen.getByText('34/50 meczów')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Postęp: Weteran' })).toHaveAttribute('aria-valuenow', '34');
  });
  it('kliknięcie zdobytej odznaki otwiera pełnoekranowy widok i da się go zamknąć', () => {
    render(<BadgeList states={[{ code: 'SLM-MAT-001', earnedAt: '2026-10-12T18:00:00Z' }, { code: 'SLM-MAT-050', current: 34 }]} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż odznakę: Debiutant' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Odznaka')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Debiutant' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('niezdobyta odznaka nie otwiera widoku', () => {
    render(<BadgeList states={[{ code: 'SLM-MAT-050', current: 34 }]} />);
    fireEvent.click(screen.getByRole('button', { name: /Pokaż pozostałe/ }));
    fireEvent.click(screen.getByText('Weteran'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('bez odznak: zachęta dla własnego profilu, neutralny tekst dla cudzego', () => {
    const { unmount } = render(<BadgeList states={[]} own />);
    expect(screen.getByText(/Zagraj pierwszy mecz/)).toBeInTheDocument();
    unmount();
    render(<BadgeList states={[]} />);
    expect(screen.getByText('Brak zdobytych odznak.')).toBeInTheDocument();
  });
  it('odznaki jednorazowe nie mają paska postępu', () => {
    render(<BadgeList states={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Pokaż pozostałe/ }));
    const row = screen.getByText('Feniks').closest('li')!;
    expect(within(row).queryByRole('progressbar')).toBeNull();
    expect(within(row).getByText('Jeszcze niezdobyta')).toBeInTheDocument();
  });
  it('demo wylicza Debiutanta z rozegranych meczów i nie przekracza progów', () => {
    const states = demoBadgeStates(6, { goals: 2, assists: 1 }, 'p01');
    expect(states.find(s => s.code === 'SLM-MAT-001')?.earnedAt).toBeTruthy();
    expect(states.find(s => s.code === 'SLM-MAT-010')).toEqual({ code: 'SLM-MAT-010', current: 6 });
    expect(demoBadgeStates(0, { goals: 0, assists: 0 }, 'p20').some(s => s.earnedAt)).toBe(false);
  });
});
