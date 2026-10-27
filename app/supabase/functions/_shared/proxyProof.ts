// Shared by the future gateway and Edge; no service keys, passwords or IP storage.
export const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes)).map(n=>n.toString(16).padStart(2,'0')).join('');
export const sha256=async(value:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
export async function hmacKey(secret:string){return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export function canonicalIp(value:string):string|null {
 if(value.length>45)return null;
 if(/^\d{1,3}(\.\d{1,3}){3}$/.test(value)){const parts=value.split('.');return parts.every(p=>Number(p)<=255&&String(Number(p))===p)?value:null;}
 if(!/^[a-f0-9:]+$/i.test(value)||!value.includes(':'))return null;
 try{return new URL('http://['+value+']/').hostname.slice(1,-1).toLowerCase();}catch{return null;}
}
export async function proxyMessage(ip:string,timestamp:string,body:Record<string,unknown>,authorization=''){return 'slm-proxy-v1\n'+timestamp+'\n'+ip+'\nPOST\n/accounts\n'+await sha256(authorization)+'\n'+await sha256(JSON.stringify(body));}
export async function proxySignature(secret:string,ip:string,timestamp:string,body:Record<string,unknown>,authorization=''){return hex(await crypto.subtle.sign('HMAC',await hmacKey(secret),new TextEncoder().encode(await proxyMessage(ip,timestamp,body,authorization))));}
