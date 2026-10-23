import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Profile from './Profile';
import BottomNav from '../ui/BottomNav';
import EventPrivacy from '../ui/EventPrivacy';
import FinanceSummary from './FinanceSummary';
import { dateEntry, dateToIso, displayDate, timeEntry } from '../ui/dateEntry';
import { requireMatchDetail } from './matchResponse';

test('nie wyświetla szczegółów innego meczu niż żądany', () => {
  expect(() => requireMatchDetail({ event:{ id:'another-event' } }, 'selected-event')).toThrow();
  const detail = { event:{ id:'selected-event' } };
  expect(requireMatchDetail(detail, 'selected-event')).toBe(detail);
});

test('karta korzysta z publicznej nazwy i nie udaje statystyk ani zdjęcia', () => {
  render(<Profile profile={{ user_id:'test-user', login:'Pseudonim', display_name:'Jan Testowy', phone:'', full_name:'', display_as:'nickname' }} appearance={<p>Motyw</p>} accountActions={<button>Wyloguj</button>}><p>Edycja konta</p></Profile>);
  expect(screen.getByRole('heading', { name:'Jan Testowy' })).toBeInTheDocument();
  expect(screen.getByLabelText('Brak zdjęcia: Jan Testowy')).toBeInTheDocument();
  expect(screen.getAllByText('—')).toHaveLength(4);
  expect(screen.queryByText('Pseudonim')).not.toBeInTheDocument();
  expect(screen.queryByText('0')).not.toBeInTheDocument();
  expect(document.querySelector('[data-portrait="initials"]')).toBeInTheDocument();
});

test('plus jest wyłącznie akcją uprawnionego organizatora', () => {
  const create = vi.fn(), select = vi.fn();
  const { rerender } = render(<BottomNav active="events" onSelect={select} onCreate={create} />);
  expect(screen.queryByRole('button', { name:'Utwórz mecz' })).not.toBeInTheDocument();
  rerender(<BottomNav active="groups" onSelect={select} onCreate={create} canCreate />);
  fireEvent.click(screen.getByRole('button', { name:'Utwórz mecz' }));
  expect(create).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name:'Profil' }));
  expect(select).toHaveBeenCalledWith('profile');
});

test('etykieta prywatności pokazuje tylko widoczność', () => {
  const { rerender } = render(<EventPrivacy visibility="private" />);
  expect(screen.getByText('Prywatne')).toBeInTheDocument();
  rerender(<EventPrivacy visibility="public" />);
  expect(screen.getByText('Publiczne')).toBeInTheDocument();
});

test('finanse pokazują kwoty przekazane przez serwer', () => {
  render(<FinanceSummary balanceCents={-12345} outstandingCents={12345} />);
  expect(screen.getAllByText(/123,45/)).toHaveLength(2);
});

test('polski zapis daty zachowuje kontrakt ISO, odrzuca nieistniejący dzień', () => {
  expect(dateEntry('23102026')).toBe('23.10.2026');
  expect(timeEntry('1905')).toBe('19:05');
  expect(displayDate('2026-10-23')).toBe('23.10.2026');
  expect(dateToIso('23.10.2026')).toBe('2026-10-23');
  expect(() => dateToIso('31.02.2026')).toThrow();
  expect(() => dateToIso('2026-10-23')).toThrow();
});
