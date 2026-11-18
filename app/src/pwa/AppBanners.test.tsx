import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import AppBanners from './AppBanners';
import type {SessionManager} from '../auth/sessionManager';
afterEach(()=>{cleanup();try{localStorage.clear();}catch{/* brak */}});
const manager={call:vi.fn(),subscribe:()=>()=>{},getSnapshot:()=>({phase:'ready',session:null})} as unknown as SessionManager;
it('pokazuje baner instalacji po zdarzeniu beforeinstallprompt i uruchamia instalację',async()=>{
 render(<AppBanners manager={manager} signedIn={false}/>);
 const prompt=vi.fn(async()=>undefined);
 const event=Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt,userChoice:Promise.resolve({outcome:'accepted'})});
 act(()=>{window.dispatchEvent(event);});
 fireEvent.click(await screen.findByRole('button',{name:'Zainstaluj'}));
 await waitFor(()=>expect(prompt).toHaveBeenCalledOnce());
 await waitFor(()=>expect(screen.queryByRole('region',{name:'Instalacja aplikacji'})).toBeNull());
});
it('„Później” ukrywa baner i zapamiętuje wybór',async()=>{
 render(<AppBanners manager={manager} signedIn={false}/>);
 const event=Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt:vi.fn(),userChoice:Promise.resolve({outcome:'dismissed'})});
 act(()=>{window.dispatchEvent(event);});
 fireEvent.click(await screen.findByRole('button',{name:'Później'}));
 expect(screen.queryByRole('region',{name:'Instalacja aplikacji'})).toBeNull();
 expect(Number(localStorage.getItem('slm-banner-install'))).toBeGreaterThan(0);
});
