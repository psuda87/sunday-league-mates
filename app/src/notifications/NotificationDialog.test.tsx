import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NotificationDialog from './NotificationDialog';

const item = { id: 'n1', title: 'Przypomnienie o płatności', body: 'Zaległa wpłata 20,00 zł za mecz „Test”.', created_at: '2026-11-22T10:00:00Z', read_at: null };

describe('NotificationDialog', () => {
  it('pokazuje pełną treść, Archiwizuj i Zamknij działają', () => {
    const onArchive = vi.fn(), onClose = vi.fn();
    render(<NotificationDialog item={item} busy={false} error={false} onArchive={onArchive} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: item.title })).toBeInTheDocument();
    expect(screen.getByText(item.body)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Archiwizuj' }));
    expect(onArchive).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('Escape zamyka, błąd archiwizacji jest ogłaszany, a w trakcie przycisk jest zablokowany', () => {
    const onClose = vi.fn();
    const { rerender } = render(<NotificationDialog item={item} busy={false} error onArchive={() => {}} onClose={onClose} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się zarchiwizować');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<NotificationDialog item={item} busy error={false} onArchive={() => {}} onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Archiwizuję…' })).toBeDisabled();
  });
});
