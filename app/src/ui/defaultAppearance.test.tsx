import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AppearanceSettings from './AppearanceSettings';
import { appearanceKey, initializeTheme, readAppearance, readPalette } from './theme';
let stop=()=>{};
// A light system preference proves the default does not depend on the device setting.
beforeEach(()=>{localStorage.clear();vi.stubGlobal('matchMedia',()=>Object.assign(new EventTarget(),{matches:false}));});
afterEach(()=>{stop();cleanup();localStorage.clear();vi.unstubAllGlobals();});

it('starts new users on España dark',()=>{
 stop=initializeTheme({palettes:true});
 expect(readAppearance()).toBe('dark');
 expect(readPalette()).toBe('espana');
 expect(document.documentElement.dataset.theme).toBe('espana');
 expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
 render(<AppearanceSettings enablePalettes/>);
 expect(screen.getByRole('radio',{name:'Ciemny'})).toBeChecked();
});

it('keeps an explicit earlier choice, including automatic mode',()=>{
 localStorage.setItem(appearanceKey,'auto');
 expect(readAppearance()).toBe('auto');
 localStorage.setItem(appearanceKey,'light');
 stop=initializeTheme({palettes:true});
 expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);
});
