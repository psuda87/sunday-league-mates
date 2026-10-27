import {canonicalIp,proxySignature} from '../supabase/functions/_shared/proxyProof.ts';
export interface GatewayEnvironment {SLM_GATEWAY_ENABLED?:string;SLM_PROXY_SECRET?:string;ACCOUNTS_URL?:string;ALLOWED_ORIGINS?:string}
type EdgeRequest=Request&{cf?:unknown};
export async function gateway(request:EdgeRequest,env:GatewayEnvironment,send:typeof fetch=fetch):Promise<Response>{
 const origin=request.headers.get('origin'),allowed=(env.ALLOWED_ORIGINS??'').split(',');
 const headers:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 if(origin&&allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
 const reject=(status:number,code:string)=>new Response(JSON.stringify({code,error:'Nie można teraz wykonać operacji.'}),{status,headers:{...headers,'Content-Type':'application/json'}});
 if(env.SLM_GATEWAY_ENABLED!=='true'||!env.SLM_PROXY_SECRET||!/^[a-f0-9]{64}$/.test(env.SLM_PROXY_SECRET))return reject(503,'gateway_unconfigured');
 if(origin&&!allowed.includes(origin))return reject(403,'origin_denied');
 const url=new URL(request.url);if(url.pathname!=='/accounts'||[...url.searchParams.keys()].some(k=>k!=='photo')||url.search&&url.search!=='?photo=upload')return reject(404,'not_found');
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST'||!request.headers.get('content-type')?.startsWith('application/json'))return reject(405,'invalid_method');
 const ip=canonicalIp(request.headers.get('cf-connecting-ip')??'');
 // cf is runtime metadata, not a client HTTP header. Never trust XFF/X-Real-IP.
 if(!request.cf||!ip)return reject(403,'untrusted_ingress');
 let target:URL;try{target=new URL(env.ACCOUNTS_URL??'');}catch{return reject(503,'gateway_unconfigured');}
 if(!/^https:\/\/[a-z]{20}\.supabase\.co\/functions\/v1\/accounts$/.test(target.href))return reject(503,'gateway_unconfigured');
 if(Number(request.headers.get('content-length')??0)>210000)return reject(413,'body_too_large');
 const reader=request.body?.getReader();if(!reader)return reject(400,'invalid_body');let size=0;const chunks:Uint8Array[]=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>210000){await reader.cancel();return reject(413,'body_too_large');}chunks.push(value);}
 const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
 let body:Record<string,unknown>;try{const value=JSON.parse(new TextDecoder().decode(raw));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();body=value;}catch{return reject(400,'invalid_body');}
 const timestamp=String(Date.now()),signature=await proxySignature(env.SLM_PROXY_SECRET,ip,timestamp,body,request.headers.get('authorization')??'');
 const outgoing=new Headers({'Content-Type':'application/json','x-slm-client-ip':ip,'x-slm-proxy-time':timestamp,'x-slm-proxy-signature':signature});
 for(const key of ['authorization','origin','apikey']){const value=request.headers.get(key);if(value)outgoing.set(key,value);}
 target.search=url.search;
 try{const r=await send(target,{method:'POST',headers:outgoing,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(25000)});return new Response(r.body,{status:r.status,headers:{...headers,'Content-Type':'application/json'}});}catch{return reject(503,'upstream_unavailable');}
}
export default {fetch:(request:EdgeRequest,env:GatewayEnvironment)=>gateway(request,env)};
