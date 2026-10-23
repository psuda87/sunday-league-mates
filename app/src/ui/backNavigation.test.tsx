import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useBackAction, useScreenHistory } from './backNavigation';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
vi.mock('@capacitor/app',()=>({App:{minimizeApp:vi.fn().mockResolvedValue(undefined)}}));

function pressBack() {
  const handlers:{priority:number;handler:()=>void}[]=[];
  document.dispatchEvent(new CustomEvent('ionBackButton',{detail:{register:(priority:number,handler:()=>void)=>handlers.push({priority,handler})}}));
  handlers.sort((a,b)=>b.priority-a.priority)[0]?.handler();
}
test('historia zakładek wraca przewidywalnie i nie wychodzi poza ekran główny',()=>{
  const {result}=renderHook(()=>{const history=useScreenHistory('events' as string);useBackAction(10,true,history.back);return history;});
  act(()=>result.current.navigate('groups'));act(()=>result.current.navigate('profile'));
  act(pressBack);expect(result.current.screen).toBe('groups');
  act(pressBack);expect(result.current.screen).toBe('events');
  act(pressBack);expect(result.current.screen).toBe('events');
  act(()=>result.current.navigate('profile'));act(()=>result.current.reset());act(pressBack);
  expect(result.current.screen).toBe('events');
});

test('Android minimalizuje z ekranu głównego, a podstrona najpierw wraca do aplikacji',()=>{
  const platform=vi.spyOn(Capacitor,'getPlatform').mockReturnValue('android');
  const {result}=renderHook(()=>useScreenHistory('events' as string));
  act(()=>result.current.navigate('groups'));act(()=>result.current.back());
  expect(result.current.screen).toBe('events');expect(App.minimizeApp).not.toHaveBeenCalled();
  act(()=>result.current.back());expect(App.minimizeApp).toHaveBeenCalledOnce();
  expect(result.current.screen).toBe('events');platform.mockRestore();
});
test('modal wygrywa z podstroną, a pojedynczy Wstecz nie uruchamia dwóch akcji',()=>{
  const root=vi.fn(),detail=vi.fn(),modal=vi.fn();
  const hook=renderHook(({enabled})=>{useBackAction(10,true,root);useBackAction(30,enabled,detail);},{initialProps:{enabled:true}});
  const overlay=(event:Event)=>(event as CustomEvent).detail.register(100,modal);
  document.addEventListener('ionBackButton',overlay);act(pressBack);
  expect(modal).toHaveBeenCalledOnce();expect(detail).not.toHaveBeenCalled();expect(root).not.toHaveBeenCalled();
  document.removeEventListener('ionBackButton',overlay);act(pressBack);expect(detail).toHaveBeenCalledOnce();
  hook.rerender({enabled:false});act(pressBack);expect(root).toHaveBeenCalledOnce();
  hook.unmount();act(pressBack);expect(root).toHaveBeenCalledOnce();
});
