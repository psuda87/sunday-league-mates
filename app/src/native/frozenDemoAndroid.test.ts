import {act,renderHook} from '@testing-library/react';
import {vi} from 'vitest';
import {App} from '@capacitor/app';
import {useFrozenBack,minimizeFrozenDemo} from './frozenDemoAndroid';
vi.mock('@capacitor/app',()=>({App:{minimizeApp:vi.fn().mockResolvedValue(undefined)}}));
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=> 'android'}}));
function press(){
 const handlers:{priority:number;handler:(next:()=>void)=>void}[]=[];
 document.dispatchEvent(new CustomEvent('ionBackButton',{detail:{register:(priority:number,handler:(next:()=>void)=>void)=>handlers.push({priority,handler})}}));
 handlers.sort((a,b)=>b.priority-a.priority);
 const next=()=>handlers.shift()?.handler(next);next();
}
test('ukryta ramka nie przechwytuje Wstecz, a nieobsłużona akcja przechodzi do rodzica',()=>{
 const scope=document.createElement('section'),child=document.createElement('h2');scope.append(child);
 const root=vi.fn(()=>true),nested=vi.fn(()=>false);
 const hook=renderHook(()=>{useFrozenBack(root,()=>scope,10);useFrozenBack(nested,()=>child,30);});
 act(press);expect(nested).toHaveBeenCalledOnce();expect(root).toHaveBeenCalledOnce();
 scope.hidden=true;act(press);expect(root).toHaveBeenCalledOnce();
 hook.unmount();scope.hidden=false;act(press);expect(nested).toHaveBeenCalledOnce();
});
test('główny ekran Androida minimalizuje bez wylogowania i kończenia procesu',()=>{
 minimizeFrozenDemo();expect(App.minimizeApp).toHaveBeenCalledOnce();
});
