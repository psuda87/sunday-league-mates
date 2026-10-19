import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import AppearanceSettings from './AppearanceSettings';
import { appearanceKey, initializeTheme, palettes, paletteKey, readAppearance, readPalette, setAppearance, setPalette } from './theme';
let stop=()=>{};
beforeEach(()=>{localStorage.clear();vi.stubGlobal('matchMedia',()=>Object.assign(new EventTarget(),{matches:false}));});
afterEach(()=>{stop();cleanup();localStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('keeps all twelve selections independent and persists both preferences',()=>{
 stop=initializeTheme({palettes:true});
 for(const palette of palettes)for(const mode of ['light','dark','auto'] as const){setPalette(palette);setAppearance(mode);expect(document.documentElement.dataset.theme).toBe(palette);expect(readPalette()).toBe(palette);expect(readAppearance()).toBe(mode);expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(mode==='dark');}
});
it('restores choices before UI mount and follows system changes only in auto',()=>{
 localStorage.setItem(paletteKey,'deimos');localStorage.setItem(appearanceKey,'auto');
 const media=Object.assign(new EventTarget(),{matches:true});vi.stubGlobal('matchMedia',()=>media);stop=initializeTheme({palettes:true});
 expect(document.documentElement.dataset.theme).toBe('deimos');expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
 media.matches=false;media.dispatchEvent(new Event('change'));expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);
 setAppearance('dark');media.dispatchEvent(new Event('change'));expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);expect(readPalette()).toBe('deimos');
});
it('ignores invalid stored palettes and keeps production opted out of demo palettes',()=>{
 localStorage.setItem(paletteKey,'<invalid>');expect(readPalette()).toBe('espana');localStorage.setItem(paletteKey,'deimos');stop=initializeTheme();setPalette('fcb');expect(document.documentElement.dataset.theme).toBe('espana');
});
it('offers swatches and brightness separately, synchronizing settings instances and storage events',()=>{
 stop=initializeTheme({palettes:true});render(<><AppearanceSettings enablePalettes/><AppearanceSettings enablePalettes/></>);
 fireEvent.click(screen.getAllByLabelText('Classic Lime')[0]);expect(screen.getAllByLabelText('Classic Lime').every(el=>(el as HTMLInputElement).checked)).toBe(true);
 fireEvent.click(screen.getAllByLabelText('Ciemny')[0]);expect(readPalette()).toBe('lime');
 act(()=>{localStorage.setItem(paletteKey,'fcb');window.dispatchEvent(new StorageEvent('storage',{key:paletteKey}));});expect(document.documentElement.dataset.theme).toBe('fcb');expect(screen.getAllByLabelText('FCB').every(el=>(el as HTMLInputElement).checked)).toBe(true);expect(readAppearance()).toBe('dark');
});
it('keeps immediate palette choice in memory when browser storage is blocked',()=>{
 stop=initializeTheme({palettes:true});vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked');});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
 render(<AppearanceSettings enablePalettes/>);fireEvent.click(screen.getByLabelText('Deimos-Code'));expect(readPalette()).toBe('deimos');expect(document.documentElement.dataset.theme).toBe('deimos');expect(screen.getByLabelText('Deimos-Code')).toBeChecked();act(()=>setAppearance('dark'));cleanup();render(<AppearanceSettings enablePalettes/>);expect(screen.getByLabelText('Ciemny')).toBeChecked();
});
