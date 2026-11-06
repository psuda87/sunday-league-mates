import {describe,expect,it,vi} from 'vitest';
import {consumeEmailCallback,legalDocuments} from './emailCallback';
const hash='a'.repeat(64);
function read(pathname='/auth/callback',search='',fragment='#type=signup&token_hash='+hash){
 const history={replaceState:vi.fn()};
 const result=consumeEmailCallback({pathname,search,hash:fragment},history);
 return {result,history};
}
describe('jednorazowy dowód e-mail i czyszczenie adresu',()=>{
 it('czyta również żywy window.location, którego ścieżka zmienia się podczas czyszczenia',()=>{
  window.history.replaceState(null,'','/auth/callback#type=recovery&token_hash='+hash);
  expect(consumeEmailCallback(window.location,window.history)).toEqual({kind:'proof',intent:'recovery',tokenHash:hash});
  expect(window.location.pathname).toBe('/');expect(window.location.hash).toBe('');
 });
 it.each(['signup','recovery'])('odczytuje tylko fragment %s, bez ujawnienia dowodu w URL',type=>{
  const {result,history}=read('/auth/callback','','#type='+type+'&token_hash='+hash);
  expect(result).toEqual({kind:'proof',intent:type==='signup'?'verify':'recovery',tokenHash:hash});
  expect(history.replaceState).toHaveBeenCalledExactlyOnceWith(null,'','/');
 });
 it.each([
  ['/auth/callback','?token_hash='+hash+'&type=signup',''],
  ['/auth/callback','','#type=magiclink&token_hash='+hash],
  ['/auth/callback','','#type=recovery&token_hash='+hash+'&next=https://evil.invalid'],
  ['/auth/callback','','#type=recovery&type=signup&token_hash='+hash],
  ['/auth/callback','','#access_token=never-accept&refresh_token=never-accept&type=recovery'],
  ['/auth/callback','','#error=access_denied&error_code=otp_expired'],
  ['/auth/callback','','#type=signup&token_hash=short'],
  ['/auth/callback','',''],
  ['/other','','#type=signup&token_hash='+hash],
 ])('odrzuca i czyści nieprawidłowy adres: %s %s %s',(path,query,fragment)=>{
  const {result,history}=read(path,query,fragment);expect(result).toEqual({kind:'invalid'});expect(history.replaceState).toHaveBeenCalledOnce();
 });
 it('nie zmienia zwykłego adresu aplikacji ani bezpiecznej nawigacji',()=>{
  const {result,history}=read('/','','#account/login');expect(result).toBeNull();expect(history.replaceState).not.toHaveBeenCalled();
 });
 it('udostępnia wyłącznie zatwierdzane publiczne dokumenty HTTPS',()=>{
  expect(legalDocuments('https://legal.example.invalid/terms','https://legal.example.invalid/privacy')).toBeDefined();
  for(const bad of ['',undefined,'javascript:alert(1)','http://example.invalid','https://localhost/terms','https://u:p@example.invalid'])expect(legalDocuments(bad,'https://example.invalid/privacy')).toBeUndefined();
 });
});
