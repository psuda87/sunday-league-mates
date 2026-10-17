import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Demo from './Demo';
afterEach(cleanup);
it('simulates capacity without login, administrator or real registration', () => {
  render(<Demo />);
  const slider = screen.getByRole('slider');
  for (const [value, label] of [[0, 'Do minimum brakuje 10'], [10, 'Minimum osiągnięte'], [15, 'Komplet miejsc']] as const) {
    fireEvent.change(slider, { target: { value: String(value) } });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(String(value));
    expect(screen.getByText(label, { exact: false })).toBeTruthy();
  }
  expect(screen.queryByText('Zaloguj się')).toBeNull();
  expect(screen.queryByText('Zarządzaj kontami')).toBeNull();
});

it('opens event details and returns, with teams scoped to the event', () => {
  render(<Demo />);
  const nav = screen.getByRole('navigation', { name: 'Główna nawigacja' });
  expect(nav.querySelectorAll('button')).toHaveLength(3);
  expect(nav.textContent).not.toContain('Składy');
  fireEvent.click(screen.getByText('Szczegóły meczu'));
  expect(screen.getByRole('heading', { name: 'Szczegóły meczu' })).toBeTruthy();
  for (const name of ['Informacje', 'Uczestnicy', 'Składy', 'Rozliczenie']) expect(screen.getByRole('region', { name })).toBeTruthy();
  expect(screen.getByText('Podgląd planowany')).toBeTruthy();
  expect(screen.getByText(/Nie pokazujemy fikcyjnych należności/)).toBeTruthy();
  fireEvent.click(screen.getByText('← Wróć do meczów'));
  expect(screen.getByRole('heading', { name: 'Następny mecz' })).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Sekcje meczu' })).toBeNull();
});
