import { fireEvent,render,screen,cleanup } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { GroupConsent,GroupRefresh } from './GroupControls';

afterEach(cleanup);
it('exposes a labelled controlled switch and disables changes while saving',()=>{
 const change=vi.fn();const {rerender}=render(<GroupConsent checked={false} busy={false} onChange={change}/>);
 const toggle=screen.getByRole('switch',{name:'Udostępniaj imię i nazwisko'});
 expect(toggle.getAttribute('aria-checked')).toBe('false');fireEvent.click(toggle);expect(change).toHaveBeenCalledWith(true);
 expect(toggle.getAttribute('aria-checked')).toBe('false'); // Only server read-back changes it.
 rerender(<GroupConsent checked busy onChange={change}/>);
 expect(toggle.getAttribute('aria-checked')).toBe('true');expect(toggle).toHaveProperty('disabled',true);
 fireEvent.click(toggle);expect(change).toHaveBeenCalledTimes(1);
 expect(toggle.getAttribute('aria-describedby')).toBeTruthy();
});
it('keeps the refresh name and button while loading and prevents further clicks',()=>{
 const refresh=vi.fn(async()=>{});const {rerender}=render(<GroupRefresh loading={false} disabled={false} onRefresh={refresh}/>);
 const button=screen.getByRole('button',{name:'Odśwież grupy'});fireEvent.click(button);expect(refresh).toHaveBeenCalledTimes(1);
 rerender(<GroupRefresh loading disabled={false} onRefresh={refresh}/>);
 expect(screen.getByRole('button',{name:'Odśwież grupy'})).toBe(button);expect(button.getAttribute('aria-busy')).toBe('true');
 expect(screen.getByRole('status').textContent).toBe('Odświeżanie grup…');fireEvent.click(button);expect(refresh).toHaveBeenCalledTimes(1);
});
