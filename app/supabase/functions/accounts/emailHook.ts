import {emailRedirect} from './emailFlows.ts';
import type {EmailEnvironment} from './emailFlows.ts';
import {mailAddress} from './smtp.ts';
import type {Mail} from './smtp.ts';
import {readAccountBody} from './profilePhotos.ts';

type Row=Record<string,unknown>;
export interface EmailHookEnvironment extends EmailEnvironment {emailHookSecret?:string}
export interface HookDependencies {
 aliases:(user:string)=>Promise<boolean>;
 send:(mail:Mail)=>Promise<void>;
 now?:()=>number;
}
async function signature(request:Request,body:string,secret:string,now:number){
 const id=request.headers.get('webhook-id')??'',ts=request.headers.get('webhook-timestamp')??'',signatures=request.headers.get('webhook-signature')??'';
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||!/^\d{10,11}$/.test(ts)||Math.abs(now/1000-Number(ts))>300)return false;
 // Supabase Auth uses Standard Webhooks (v1,whsec_BASE64), including timestamp/id.
 const encoded=secret.replace(/^v1,whsec_/,'').replace(/^whsec_/,'');
 let bytes:Uint8Array<ArrayBuffer>;
 try{bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));}catch{return false;}
 if(bytes.length<32)return false;
 const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const data=new TextEncoder().encode(id+'.'+ts+'.'+body);
 for(const candidate of signatures.split(' ').slice(0,10)){
  if(!candidate.startsWith('v1,'))continue;
  try{if(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(candidate.slice(3)),c=>c.charCodeAt(0)),data))return true;}catch{/* invalid signature */}
 }
 return false;
}
export async function sendEmailHook(request:Request,env:EmailHookEnvironment,deps:HookDependencies):Promise<Response>{
 const reply=(status:number,message?:string)=>new Response(JSON.stringify(message?{error:{http_code:status,message}}:{}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(request.method!=='POST'||request.headers.has('origin'))return reply(403,'SLM_EMAIL_HOOK_FORBIDDEN');
 if(!env.emailSignupEnabled||!env.emailHookSecret)return reply(503,'SLM_EMAIL_UNCONFIGURED');
 try{
  const raw=await readAccountBody(request,32768);
  if(!await signature(request,raw,env.emailHookSecret,(deps.now??Date.now)()))return reply(403,'SLM_EMAIL_HOOK_FORBIDDEN');
  const event=JSON.parse(raw) as {user?:Row;email_data?:Row};
  const user=event.user,email=event.email_data;
  const type=email?.email_action_type;
  if(!user||!email||!['signup','recovery'].includes(String(type))||typeof user.id!=='string'||
   !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)||!mailAddress(user.email)||
   user.email.toLowerCase().endsWith('@slm.invalid')||await deps.aliases(user.id))return reply(403,'SLM_EMAIL_ACTION_DISABLED');
  const hash=email.token_hash;
  if(typeof hash!=='string'||!/^[A-Za-z0-9_-]{40,128}$/.test(hash))return reply(400,'SLM_EMAIL_PROOF_INVALID');
  const url=emailRedirect(env)+'#type='+type+'&token_hash='+hash;
  // Never use user-controlled redirect_to/site_url or email-change target fields.
  await deps.send({to:user.email,subject:type==='signup'?'SLM — potwierdź adres e-mail':'SLM — ustaw nowe hasło',
   text:(type==='signup'?'Potwierdź adres e-mail w Sunday League Mates:':'Ustaw nowe hasło w Sunday League Mates:')+'\n\n'+url+
    '\n\nJeśli nie prosisz o tę operację, zignoruj wiadomość. Nie przekazuj nikomu tego linku.',
   id:request.headers.get('webhook-id')!});
  return reply(200);
 }catch{return reply(503,'SLM_EMAIL_DELIVERY_UNCONFIRMED');}
}
