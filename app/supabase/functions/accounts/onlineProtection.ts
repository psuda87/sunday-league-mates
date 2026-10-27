import {canonicalIp,hex,hmacKey,proxyMessage,sha256} from '../_shared/proxyProof.ts';
export class OnlineAuthError extends Error {constructor(public status:number,public code:string,message='Nie można teraz potwierdzić operacji. Spróbuj ponownie.'){super(message);}}
export interface OnlineProtection {proxySecret:string;turnstileSecret:string;hostnames:string[];fetcher?:typeof fetch}
export function onlineConfiguration(get:(key:string)=>string|undefined):OnlineProtection|undefined {
 const proxySecret=get('SLM_PROXY_SECRET')??'',turnstileSecret=get('TURNSTILE_SECRET_KEY')??'',hostnames=(get('TURNSTILE_HOSTNAMES')??'').split(',').map(x=>x.trim());
 if(!/^[a-f0-9]{64}$/.test(proxySecret)||!turnstileSecret||/[\r\n]/.test(proxySecret+turnstileSecret)||hostnames.some(h=>!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(h)||/\.(invalid|example|test)$/.test(h)))return undefined;
 // Public Cloudflare test secrets must never activate an online deployment.
 if(turnstileSecret.startsWith('1x000000')||turnstileSecret.startsWith('2x000000')||turnstileSecret.startsWith('3x000000'))return undefined;
 return {proxySecret,turnstileSecret,hostnames};
}
export function onlineGuard(config:OnlineProtection|undefined){return {
 async ingress(request:Request,body:Record<string,unknown>){
  if(!config)throw new OnlineAuthError(503,'online_unconfigured');
  const raw=request.headers.get('x-slm-client-ip')??'',ip=canonicalIp(raw),timestamp=request.headers.get('x-slm-proxy-time')??'',signature=request.headers.get('x-slm-proxy-signature')??'';
  if(!ip||!/^[0-9]{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>30000||!/^[a-f0-9]{64}$/.test(signature))throw new OnlineAuthError(403,'untrusted_ingress');
  const ok=await crypto.subtle.verify('HMAC',await hmacKey(config.proxySecret),Uint8Array.from(signature.match(/../g)!,s=>parseInt(s,16)),new TextEncoder().encode(await proxyMessage(ip,timestamp,body,request.headers.get('authorization')??'')));
  if(!ok)throw new OnlineAuthError(403,'untrusted_ingress');
  const parts=ip.split('::'),left=parts[0].split(':').filter(Boolean),right=(parts[1]??'').split(':').filter(Boolean);
  const network=ip.includes(':')?[...left,...Array(Math.max(0,8-left.length-right.length)).fill('0'),...right].slice(0,4).map(x=>parseInt(x,16).toString(16)).join(':')+'/64':ip;
  // Daily keyed pseudonym: not raw IP or a reversible unsalted IP hash.
  const subject=hex(await crypto.subtle.sign('HMAC',await hmacKey(config.proxySecret),new TextEncoder().encode('rate:'+new Date().toISOString().slice(0,10)+':'+network)));
  return {subject};
 },
 async challenge(body:Record<string,unknown>){
  if(!config)throw new OnlineAuthError(503,'online_unconfigured');
  const token=body.challenge_token,id=body.request_id;
  if(typeof token!=='string'||token.length<1||token.length>2048||typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new OnlineAuthError(403,'challenge_required');
  const hash=await sha256(id+':'+token),key=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-8'+hash.slice(17,20)+'-'+hash.slice(20,32);
  let response:Response;
  try{response=await (config.fetcher??fetch)('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:config.turnstileSecret,response:token,idempotency_key:key}),signal:AbortSignal.timeout(8000)});}catch{throw new OnlineAuthError(503,'challenge_unavailable');}
  if(!response.ok)throw new OnlineAuthError(503,'challenge_unavailable');
  const result=await response.json().catch(()=>null);
  if(result?.success!==true||result.action!=='slm_signup'||result.cdata!==id||!config.hostnames.includes(result.hostname)||!Number.isFinite(Date.parse(result.challenge_ts))||Math.abs(Date.now()-Date.parse(result.challenge_ts))>300000)throw new OnlineAuthError(403,'challenge_invalid');
 }
};}
