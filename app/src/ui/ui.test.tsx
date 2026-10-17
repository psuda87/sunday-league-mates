import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { capacityState } from './capacity';
import MatchCapacityProgress from './MatchCapacityProgress';
import { resolveDark, setAppearance, readAppearance, initializeTheme } from './theme';
import AppearanceSettings from './AppearanceSettings';
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
describe('España appearance', () => {
  it('manual choice overrides system', () => { expect(resolveDark('auto', true)).toBe(true); expect(resolveDark('light', true)).toBe(false); expect(resolveDark('dark', false)).toBe(true); });
  it('follows live system changes only in automatic mode', () => {
    const media = new EventTarget() as EventTarget & { matches: boolean }; media.matches = false;
    const query = vi.fn(() => media);
    vi.stubGlobal('matchMedia', query);
    const stop = initializeTheme();
    media.matches = true; media.dispatchEvent(new Event('change'));
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    setAppearance('light'); media.dispatchEvent(new Event('change'));
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);
    setAppearance('auto'); expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    expect(query).toHaveBeenCalledTimes(1); // Apply the same retained subscription, not a fresh query.
    stop();
  });
  it('persists and immediately applies selection', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    render(<AppearanceSettings />); fireEvent.click(screen.getByLabelText('Ciemny'));
    expect(readAppearance()).toBe('dark'); expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    setAppearance('light'); expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);
  });
});
describe('capacity', () => {
  it.each([[0,15,0,'Do minimum brakuje 10'],[10,15,1000/15,'Minimum osiągnięte'],[15,15,100,'Komplet miejsc'],[20,15,100,'Komplet miejsc'],[0,0,0,'Limit niedostępny']])('renders %s/%s', (count, capacity, percent, label) => {
    const s = capacityState(Number(count), Number(capacity)); expect(s.percent).toBeCloseTo(Number(percent)); expect(s.label).toBe(label);
  });
  it('provides accessible value and minimum', () => { render(<MatchCapacityProgress count={12} capacity={15} />); expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('12'); expect(screen.getByText('Minimum 10')).toBeTruthy(); });
});
