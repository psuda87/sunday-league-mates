import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RatingStars, { ARC_OFFSETS } from './RatingStars';

describe('RatingStars', () => {
  it('renders five unlabeled stars with 3.5 filled for the default 7/10', () => {
    const { container } = render(<RatingStars rating={7} />);
    expect(screen.getByRole('img', { name: 'Ocena 7,0 na 10' })).toBeTruthy();
    expect(container.querySelectorAll('g[data-fill]')).toHaveLength(5);
    expect([...container.querySelectorAll('g[data-fill]')].map(g => g.getAttribute('data-fill'))).toEqual(['1', '1', '1', '0.5', '0']);
    expect(container.textContent).toBe('');
  });
  it('uses an inverted arc: the middle star is lowest', () => {
    expect(ARC_OFFSETS[2]).toBe(Math.max(...ARC_OFFSETS));
    expect(ARC_OFFSETS[0]).toBe(ARC_OFFSETS[4]);
  });
  it('shows half precision for ratings between steps', () => {
    const { container } = render(<RatingStars rating={8.5} />);
    expect([...container.querySelectorAll('g[data-fill]')].map(g => g.getAttribute('data-fill'))).toEqual(['1', '1', '1', '1', '0.5']);
  });
});
