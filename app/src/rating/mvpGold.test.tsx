import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoldTag, MvpGoldProvider, REFLEX_DIRECTIONS, applyRandomReflex, useMvpGold, useMvpGoldHolders } from './mvpGold';

function Probe({ id }: { id: string }) { return <span data-testid={id}>{useMvpGold(id) ? 'gold' : 'plain'}</span>; }
function Count() { return <span data-testid="count">{useMvpGoldHolders().size}</span>; }

describe('MVP Gold context', () => {
  it('nobody has gold by default (no backend source yet)', () => {
    render(<><Probe id="a" /><Count /></>);
    expect(screen.getByTestId('a')).toHaveTextContent('plain');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
  it('marks only the listed holders', () => {
    render(<MvpGoldProvider holders={['a']}><Probe id="a" /><Probe id="b" /></MvpGoldProvider>);
    expect(screen.getByTestId('a')).toHaveTextContent('gold');
    expect(screen.getByTestId('b')).toHaveTextContent('plain');
  });
  it('ignores the preview user unless the preview flag is set at build time', () => {
    render(<MvpGoldProvider previewUserId="a"><Probe id="a" /></MvpGoldProvider>);
    expect(screen.getByTestId('a')).toHaveTextContent('plain');
  });
  it('tag shows just the word MVP', () => {
    render(<GoldTag />);
    expect(screen.getByRole('img', { name: 'MVP Gold' })).toHaveTextContent(/^MVP$/);
  });
  it('has four diagonal reflex directions and never repeats the previous one', () => {
    expect(new Set(REFLEX_DIRECTIONS.map(d => d.slice(0, 4).join())).size).toBe(4);
    const el = document.createElement('div');
    const first = applyRandomReflex(el, () => 0);
    expect(first).toBe(0);
    expect(el.style.getPropertyValue('--slm-gold-x0')).toBe('-130%');
    expect(applyRandomReflex(el, () => 0)).toBe(1);
    expect(el.style.getPropertyValue('--slm-gold-angle')).toBe('45deg');
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(applyRandomReflex(el));
    expect(seen.size).toBe(4);
  });
});
