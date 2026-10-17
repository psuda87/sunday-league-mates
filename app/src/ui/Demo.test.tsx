import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Demo from './Demo';
import DemoMatchDetails from './DemoMatchDetails';
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });
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
it('opens comparison from the whole card and both full views without selecting a final variant', () => {
  render(<Demo />);
  const nav = screen.getByRole('navigation', { name: 'Główna nawigacja' });
  expect(nav.querySelectorAll('button')).toHaveLength(3);
  const card = screen.getByRole('button', { name: /Otwórz szczegóły meczu:/ });
  expect(card.querySelector('button, ion-button, a')).toBeNull();
  expect(screen.queryByText('Szczegóły meczu')).toBeNull();
  fireEvent.click(card);
  expect(screen.getByRole('heading', { name: 'Porównaj szczegóły meczu' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Wariant A' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Wariant B' })).toBeTruthy();
  fireEvent.click(screen.getByText('Otwórz B w pełnym widoku'));
  expect(screen.getByRole('heading', { name: 'Szczegóły meczu · B' })).toBeTruthy();
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  fireEvent.click(screen.getByRole('tab', { name: 'Rozliczenie' }));
  expect(within(screen.getByRole('tabpanel')).getByText(/Nie pokazujemy fikcyjnych należności/)).toBeTruthy();
  fireEvent.click(screen.getByText('Porównaj A i B'));
  fireEvent.click(screen.getByText('Otwórz A w pełnym widoku'));
  expect(screen.getByRole('heading', { name: 'Szczegóły meczu · A' })).toBeTruthy();
  for (const name of ['Informacje', 'Uczestnicy', 'Składy', 'Rozliczenie']) expect(screen.getByRole('region', { name })).toBeTruthy();
  fireEvent.click(screen.getByText('← Wróć do meczów'));
  expect(screen.getByRole('heading', { name: 'Następny mecz' })).toBeTruthy();
});
it('supports tab keyboard navigation and keeps only one panel visible', () => {
  render(<DemoMatchDetails variant="b" count={12} />);
  const info = screen.getByRole('tab', { name: 'Informacje' });
  fireEvent.keyDown(info, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Uczestnicy' })).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveTextContent('12 / 15');
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(screen.getByRole('tab', { name: 'Rozliczenie' })).toHaveFocus();
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(info).toHaveFocus();
  fireEvent.keyDown(info, { key: 'ArrowLeft' });
  expect(screen.getByRole('tab', { name: 'Rozliczenie' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Home' });
  expect(info).toHaveFocus();
});
it('opens a full variant directly from its URL fragment', () => {
  window.history.replaceState(null, '', '/#details-b');
  render(<Demo />);
  expect(screen.getByRole('heading', { name: 'Szczegóły meczu · B' })).toBeTruthy();
});
