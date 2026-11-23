import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MemberStats from './MemberStats';

const rating = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock('../rating/RatingProvider', () => ({ usePlayerRating: () => rating.value }));

describe('MemberStats', () => {
  it('pokazuje MVP, gole i asysty zawodnika', () => {
    rating.value = { stats: { played: 7, goals: 5, assists: 2, mvp: 1 } };
    render(<MemberStats id="u1" />);
    expect(screen.getByLabelText('MVP 1, gole 5, asysty 2')).toBeTruthy();
  });
  it('bez statystyk nic nie renderuje', () => {
    rating.value = undefined;
    const { container } = render(<MemberStats id="u1" />);
    expect(container.firstChild).toBeNull();
  });
});
