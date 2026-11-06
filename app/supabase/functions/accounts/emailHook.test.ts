import {afterEach,describe,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {sendEmailHook} from './emailHook';
import {createHandler} from './handler';
import type {Mail} from './smtp';
const now=1793786400000;
const secret=btoa('fixture-key-with-at-least-32-bytes!');
const env={emailSignupEnabled:true,emailRedirectUrl:'https://slm.example.invalid/auth/callback',origins:['https://slm.example.invalid'],emailHookSecret:'v1,whsec_'+secret};
const user={id:'d00d0000-0000-4000-8000-000000000001',email:'fixture@example.invalid'};
const event=(type='signup')=>({user,email_data:{email_action_type:type,token_hash:'a'.repeat(64),redirect_to:'https://evil.invalid',site_url:'https://evil.invalid'}});
afterEach(()=>vi.unstubAllGlobals());
async function signed(body:unknown=event(),timestamp=Math.floor(now/1000)){
 vi.stubGlobal('crypto',webcrypto);
 const raw=JSON.stringify(body),id='msg_fixture01';
 const key=await webcrypto.subtle.importKey('raw',Uint8Array.from(atob(secret),c=>c.charCodeAt(0)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=btoa(String.fromCharCode(...new Uint8Array(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+'.'+timestamp+'.'+raw)))));
 return new Request('https://example.invalid/accounts?hook=email',{method:'POST',headers:{'webhook-id':id,'webhook-timestamp':String(timestamp),'webhook-signature':'v1,'+sig},body:raw});
}
function dependencies(){return {aliases:vi.fn<(user:string,signal:AbortSignal)=>Promise<boolean>>(async()=>false),send:vi.fn<(mail:Mail,signal:AbortSignal)=>Promise<void>>(async()=>{}),now:()=>now};}
describe('podpisany Send Email hook, bez prawdziwych wiadomości',()=>{
 it.each(['signup','recovery'])('wysyła %s wyłącznie na stały callback z fragmentem dowodu',async type=>{
  const d=dependencies(),r=await sendEmailHook(await signed(event(type)),env,d);expect(r.status).toBe(200);expect(await r.json()).toEqual({});
  expect(d.send).toHaveBeenCalledWith(expect.objectContaining({to:user.email,text:expect.stringContaining(env.emailRedirectUrl+'#type='+type+'&token_hash=')}),expect.any(AbortSignal));
  expect(d.send.mock.calls[0][0].text).not.toContain('evil.invalid');expect(r.headers.get('Cache-Control')).toBe('no-store');
 });
 it.each(['email_change','magiclink','invite','reauthentication','password_changed_notification'])('zachowuje blokadę nieuzgodnionej wysyłki %s',async type=>{
  const d=dependencies();expect((await sendEmailHook(await signed(event(type)),env,d)).status).toBe(403);expect(d.send).not.toHaveBeenCalled();
 });
 it('odrzuca legacy zarówno po domenie technicznej, jak i rzeczywistym aliasie',async()=>{
  for(const legacy of ['domain','alias']){
   const d=dependencies(),body=event('recovery');
   if(legacy==='domain')body.user={...user,email:'technical@slm.invalid'};else d.aliases.mockResolvedValueOnce(true);
   expect((await sendEmailHook(await signed(body),env,d)).status).toBe(403);expect(d.send).not.toHaveBeenCalled();
  }
 });
 it('weryfikuje podpis PRZED dostępem do aliasów/SMTP i odrzuca zmodyfikowany payload',async()=>{
  const original=await signed(),headers=new Headers(original.headers),d=dependencies();headers.set('webhook-signature','v1,wrong');
  for(const req of [new Request(original.url,{method:'POST',headers,body:await original.clone().text()}),new Request(original.url,{method:'POST',headers:original.headers,body:JSON.stringify(event('recovery'))})]){
   expect((await sendEmailHook(req,env,d)).status).toBe(403);
  }
  expect(d.aliases).not.toHaveBeenCalled();expect(d.send).not.toHaveBeenCalled();
 });
 it.each([-301,301])('odrzuca podpis poza oknem czasu %s',async offset=>{
  const d=dependencies();expect((await sendEmailHook(await signed(event(),Math.floor(now/1000)+offset),env,d)).status).toBe(403);expect(d.send).not.toHaveBeenCalled();
 });
 it('odrzuca źródło przeglądarkowe i niezainicjalizowany sekret',async()=>{
  const original=await signed(),headers=new Headers(original.headers),d=dependencies();headers.set('Origin','https://slm.example.invalid');
  expect((await sendEmailHook(new Request(original.url,{method:'POST',headers,body:await original.text()}),env,d)).status).toBe(403);
  expect((await sendEmailHook(await signed(),{...env,emailHookSecret:undefined},d)).status).toBe(503);expect(d.send).not.toHaveBeenCalled();
 });
 it('nie potwierdza wysłania po awarii SMTP i nie odsyła odpowiedzi dostawcy',async()=>{
  const d=dependencies();d.send.mockRejectedValueOnce(new Error('private smtp diagnostics'));
  const r=await sendEmailHook(await signed(),env,d);expect(r.status).toBe(503);expect(await r.text()).not.toContain('private');
 });
 it('wspólny deadline odrzuca oczekujący odczyt i nie rozpoczyna SMTP',async()=>{
  const request=await signed(),controller=new AbortController(),timeout=vi.spyOn(AbortSignal,'timeout').mockReturnValue(controller.signal);
  const d=dependencies();d.aliases.mockImplementationOnce(()=>new Promise(()=>{}));
  try{
   const flight=sendEmailHook(request,env,d);
   await vi.waitFor(()=>expect(d.aliases).toHaveBeenCalled());controller.abort();
   expect((await flight).status).toBe(503);expect(d.send).not.toHaveBeenCalled();
   expect(d.aliases.mock.calls[0][1].aborted).toBe(true);
   expect(timeout).toHaveBeenCalledWith(4000);
  }finally{timeout.mockRestore();}
 });
 it('anulowanie żądania dociera do tego samego sygnału SMTP i nie potwierdza wysyłki',async()=>{
  const original=await signed(),controller=new AbortController();
  const request=new Request(original,{signal:controller.signal}),d=dependencies();d.send.mockImplementationOnce(()=>new Promise(()=>{}));
  const flight=sendEmailHook(request,env,d);
  await vi.waitFor(()=>expect(d.send).toHaveBeenCalled());controller.abort();
  expect((await flight).status).toBe(503);expect(d.send.mock.calls[0][1]).toBe(d.aliases.mock.calls[0][1]);
  expect(d.send.mock.calls[0][1].aborted).toBe(true);
 });
 it('dispatcher accounts nie uznaje nagłówków webhook za autoryzację innych akcji',async()=>{
  const request=await signed(),headers=new Headers(request.headers);
  const handler=createHandler({...env,url:'https://example.invalid',service:'',anon:''});
  // A forged hook gets no DB/SMTP operation, including with an arbitrary action field.
  vi.stubGlobal('fetch',vi.fn());headers.set('webhook-signature','v1,invalid');
  const r=await handler(new Request(request.url,{method:'POST',headers,body:JSON.stringify({action:'create_account',role:'admin'})}));
  expect(r.status).toBe(403);expect(fetch).not.toHaveBeenCalled();
 });
});
