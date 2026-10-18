import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Demo from './Demo';
import DemoMatchDetails from './DemoMatchDetails';
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });
const openTools = () => { fireEvent.click(screen.getByText('Narzędzia demo')); screen.getByText('Narzędzia demo').closest('details')!.open = true; };
it('keeps tools collapsed and allows local capacity testing without login', () => {
  render(<Demo />);
  expect(screen.getByText('Narzędzia demo').closest('details')!.open).toBe(false);
  // jsdom does not model native closed-details layout; Chromium verifies actual visibility.
  openTools();
  const slider = screen.getByRole('slider');
  for (const [value, label] of [[0, 'Do minimum brakuje 10'], [10, 'Minimum osiągnięte'], [15, 'Komplet miejsc']] as const) {
    fireEvent.change(slider, { target: { value: String(value) } });
    expect(document.querySelector('.slm-compact-count strong')).toHaveTextContent(`${value}/15`);
    expect(document.querySelector('.slm-compact-count')).toHaveTextContent(label);
  }
  expect(screen.queryByText('Zaloguj się')).toBeNull();
  expect(screen.queryByText('Zarządzaj kontami')).toBeNull();
});
it('opens chosen B directly from the whole card, defaults to Participants and returns', () => {
  render(<Demo />);
  expect(screen.getByRole('img', { name: 'Sunday League Mates' }).getAttribute('src')).toBe('/assets/branding/slm-logo-primary-transparent.png');
  expect(screen.getByRole('img', { name: 'Sunday League Mates' }).closest('ion-content')).not.toBeNull();
  expect(document.querySelector('ion-header')).toBeNull();
  const nav = screen.getByRole('navigation', { name: 'Główna nawigacja' });
  expect(nav.querySelectorAll('button')).toHaveLength(3);
  const card = screen.getAllByRole('button', { name: /Otwórz szczegóły meczu:/ })[0];
  expect(card.querySelector('button, ion-button, a')).toBeNull(); fireEvent.click(card);
  expect(screen.getByRole('heading', { name: 'Szczegóły meczu' })).toBeTruthy();
  expect(screen.queryByText('Porównaj szczegóły meczu')).toBeNull();
  expect(screen.getByRole('tab', { name: 'Uczestnicy' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  fireEvent.click(screen.getByRole('tab', { name: 'Rozliczenie' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Nie pokazujemy fikcyjnych należności');
  fireEvent.click(screen.getByText('← Wróć do meczów'));
  expect(screen.getByRole('heading', { name: 'Mecze' })).toBeTruthy();
});
it('supports tab keyboard navigation and one visible panel', () => {
  render(<DemoMatchDetails variant="b" count={12} />);
  const people = screen.getByRole('tab', { name: 'Uczestnicy' });
  expect(people).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveTextContent('12 / 15');
  fireEvent.keyDown(people, { key: 'End' }); expect(screen.getByRole('tab', { name: 'Rozliczenie' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' }); expect(screen.getByRole('tab', { name: 'Informacje' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' }); expect(screen.getByRole('tab', { name: 'Rozliczenie' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Home' }); expect(screen.getByRole('tab', { name: 'Informacje' })).toHaveFocus();
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
});
it('supports a direct details URL with Participants selected', () => {
  window.history.replaceState(null, '', '/#details'); render(<Demo />);
  expect(screen.getByRole('heading', { name: 'Szczegóły meczu' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Uczestnicy' })).toHaveAttribute('aria-selected', 'true');
});
it('opens the selected fictional match with matching date, capacity and roster totals', () => {
  render(<Demo />);
  fireEvent.click(screen.getAllByRole('button', { name: /Otwórz szczegóły meczu:/ })[1]);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8');
  const panel = screen.getByRole('tabpanel');
  expect(panel.querySelectorAll('.slm-roster-group')[0].querySelectorAll('li')).toHaveLength(6);
  expect(panel.querySelectorAll('.slm-roster-group')[1].querySelectorAll('li')).toHaveLength(2);
  expect(panel.querySelectorAll('.slm-roster-group')[2].querySelectorAll('li')).toHaveLength(2);
  fireEvent.click(screen.getByRole('tab', { name: 'Informacje' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('29 października 2026');
  fireEvent.click(screen.getByRole('tab', { name: 'Składy' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Planowane');
  expect(screen.getByRole('tabpanel').querySelectorAll('.slm-team-side ion-icon')).toHaveLength(10);
});
it('filters fictional fixtures without inventing membership or changing the chosen card', () => {
  render(<Demo />);
  expect(screen.getAllByRole('button', { name: /Otwórz szczegóły meczu:/ })).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Moje' }));
  expect(screen.getAllByRole('button', { name: /Otwórz szczegóły meczu:/ })).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
  expect(screen.getAllByRole('button', { name: /Otwórz szczegóły meczu:/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: /Otwórz szczegóły meczu:/ }));
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '15');
  fireEvent.click(screen.getByRole('tab', { name: 'Informacje' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('8 października 2026');
  fireEvent.click(screen.getByText('← Wróć do meczów'));
  expect(screen.getByRole('button', { name: 'Historia' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Nadchodzące' }));
  expect(screen.getAllByRole('button', { name: /Otwórz szczegóły meczu:/ })).toHaveLength(4);
  expect(screen.queryByRole('heading', { name: 'Następny mecz' })).toBeNull();
});
