import {afterEach,expect,it,vi} from 'vitest';
import {installFocusVisibility} from './focusVisibility';
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();});
it('scrolls the focused Ionic field inside the resized viewport without adding padding',async()=>{
 const content=document.createElement('ion-content'),field=document.createElement('input'),scroll=document.createElement('div');
 content.append(field);document.body.append(content);
 content.getScrollElement=async()=>scroll;
 vi.spyOn(scroll,'getBoundingClientRect').mockReturnValue({top:0,bottom:400} as DOMRect);
 vi.spyOn(field,'getBoundingClientRect').mockReturnValue({top:600,bottom:650} as DOMRect);
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>{fn(0);return 1;});
 const stop=installFocusVisibility(true);field.focus();await Promise.resolve();
 expect(scroll.scrollTop).toBe(266);expect(scroll.style.paddingBottom).toBe('');stop();
});
it('never scrolls a file picker or changes its value on viewport resize',()=>{
 const field=document.createElement('input');field.type='file';document.body.append(field);
 const stop=installFocusVisibility(true);field.focus();window.dispatchEvent(new Event('resize'));
 expect(field.value).toBe('');stop();
});
