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
