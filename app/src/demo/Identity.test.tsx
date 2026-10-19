import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AvatarPicker, IdentityEditor } from './Identity';
import DemoProfile from './Profile';
import AppearanceSettings from '../ui/AppearanceSettings';
import { initialWorld } from './data';
import { demoPortraits, readDemoPortrait, validDemoPortrait } from './portraits';
it('validates identity and cancels without committing a draft',()=>{
 const player=initialWorld().players[0],dispatch=vi.fn(),onClose=vi.fn(),onNumber=vi.fn();
 render(<IdentityEditor player={player} dispatch={dispatch} onClose={onClose} onNumber={onNumber}/>);
 fireEvent.change(screen.getByLabelText('Imię'),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'Zapisz dane demo'}));expect(screen.getByRole('alert')).toBeTruthy();expect(dispatch).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Imię'),{target:{value:'Mateusz'}});fireEvent.change(screen.getByLabelText('Nazwisko / nazwa wyświetlana'),{target:{value:'Próbny'}});
 fireEvent.click(screen.getByRole('button',{name:'Anuluj'}));expect(dispatch).not.toHaveBeenCalled();expect(onClose).toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Zapisz dane demo'}));expect(dispatch).toHaveBeenCalledWith({type:'identity',playerId:'p01',name:'Mateusz Próbny'});
 fireEvent.click(screen.getByRole('button',{name:'Zmień numer koszulki · 10'}));expect(onNumber).toHaveBeenCalled();
});
it('previews a fictional portrait without changing shared state until confirmation',()=>{
 const dispatch=vi.fn(),onClose=vi.fn();render(<AvatarPicker player={initialWorld().players[0]} dispatch={dispatch} onClose={onClose}/>);
 fireEvent.click(screen.getByRole('button',{name:'Portret demonstracyjny 4'}));expect(dispatch).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Portret demonstracyjny 4'})).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:'Anuluj'}));expect(dispatch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Zatwierdź zdjęcie'}));expect(dispatch).toHaveBeenCalledWith({type:'portrait',playerId:'p01',portrait:demoPortraits[3]});
});
it('uses the existing card once for My Profile and exposes no own editors on another identity',()=>{
 const world=initialWorld(),dispatch=vi.fn();const {rerender}=render(<DemoProfile world={world} id="p01" personal dispatch={dispatch}/>);
 expect(screen.getByRole('heading',{name:'Mój profil'})).toBeTruthy();expect(document.querySelectorAll('.slm-ultimate-card')).toHaveLength(1);expect(document.querySelectorAll('.slm-ultimate-stats > div')).toHaveLength(4);
 fireEvent.click(screen.getByRole('button',{name:'Ustawienia'}));expect(screen.getAllByText('Niedostępne w demo')).toHaveLength(2);
 rerender(<DemoProfile world={world} id="p02" personal dispatch={dispatch}/>);expect(screen.queryByRole('button',{name:'Edytuj profil'})).toBeNull();expect(screen.queryByRole('button',{name:/Zmień numer/})).toBeNull();
});
it('does not admit remote/SVG pictures and rejects oversized local files before reading',async()=>{
 expect(validDemoPortrait({src:'https://example.invalid/a.png'})).toBe(false);expect(validDemoPortrait({src:'data:image/svg+xml;base64,AAAA'})).toBe(false);
 await expect(readDemoPortrait({size:2097153} as File)).rejects.toThrow('2 MB');
 await expect(readDemoPortrait({size:10,type:'image/svg+xml',arrayBuffer:async()=>new TextEncoder().encode('<svg/>').buffer} as File)).rejects.toThrow('PNG, JPEG lub WebP');
});
it('gives separately mounted appearance panels independent radio group names',()=>{
 render(<><AppearanceSettings/><AppearanceSettings/></>);const radios=screen.getAllByRole('radio') as HTMLInputElement[];
 expect(new Set(radios.map(input=>input.name)).size).toBe(2);expect(radios.filter(input=>input.checked)).toHaveLength(2);
});
