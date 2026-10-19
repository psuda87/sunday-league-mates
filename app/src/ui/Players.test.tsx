import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Players from './Players';
const players = [{ key:'private-id', name:'Łukasz Wrona', phone:'+48000000000', email:'private@example.invalid', role:'admin' }, { key:'another-id', name:'Adrian Maj' }];
describe('Players privacy and navigation', () => {
  it('sorts Polish names, searches with diacritics and keeps the query on return', async () => {
    render(<Players players={players} demo />);
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('Adrian');
    fireEvent.change(screen.getByRole('searchbox'), { target:{ value:'lukasz' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name:/Łukasz Wrona/ }));
    expect(screen.getByRole('heading', { name:'Łukasz Wrona' })).toBeTruthy();
    expect(screen.getByRole('heading', { name:'Statystyki' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/private-id|000000000|private@example|admin/);
    fireEvent.click(screen.getByLabelText('Wróć do zawodników'));
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('lukasz');
    await waitFor(() => expect(document.activeElement?.textContent).toContain('Łukasz'));
  });
  it('distinguishes empty data, no results and unavailable backend', () => {
    const { rerender } = render(<Players players={[]} />);
    expect(screen.getByText('Lista jest pusta')).toBeTruthy();
    rerender(<Players players={players} />);
    fireEvent.change(screen.getByRole('searchbox'), { target:{value:'zzzz'} });
    expect(screen.getByText('Brak wyników')).toBeTruthy();
    fireEvent.click(screen.getByText('Wyczyść wyszukiwanie'));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    rerender(<Players players={[]} unavailable />);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByText('Katalog grupy w przygotowaniu')).toBeTruthy();
  });
});
