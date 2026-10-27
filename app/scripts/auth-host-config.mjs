// Non-secret build-time config only. No environment-file loading or implicit Cloud URL.
export function authHostConfig(value,{example=false}={}){
 const keys=['enabled','projectRef','apiOrigin','appOrigin','authOrigin','siteKey','parentOrigins'];
 if(!value||typeof value!=='object'||Object.keys(value).some(k=>!keys.includes(k)))throw Error('Invalid auth-host config keys');
 if(value.enabled!==true&&!example)throw Error('Production build requires an explicitly enabled configuration');
 function origin(v){let u;try{u=new URL(v);}catch{throw Error('Invalid origin');}if(u.origin!==v||u.protocol!=='https:'||u.username||u.password||(!example&&(/\.(invalid|test|example)$/.test(u.hostname)||u.hostname==='localhost'||/^[0-9.]+$/.test(u.hostname))))throw Error('Exact public HTTPS origin required');return v;}
 const apiOrigin=origin(value.apiOrigin),appOrigin=origin(value.appOrigin),authOrigin=origin(value.authOrigin);
 if(new Set([apiOrigin,appOrigin,authOrigin]).size!==3)throw Error('Separate API/app/callback origins required');
 if(!example&&(!/^[a-z]{20}$/.test(value.projectRef??'')||!/^[-_a-z0-9]{20,}$/i.test(value.siteKey??'')||/^[123]x0000/.test(value.siteKey)))throw Error('Real project ref and site key required');
 if(!Array.isArray(value.parentOrigins)||value.parentOrigins.length<1||value.parentOrigins.length>10||!value.parentOrigins.includes(appOrigin)||new Set(value.parentOrigins).size!==value.parentOrigins.length)throw Error('Invalid parent allowlist');
 const parentOrigins=value.parentOrigins.map(v=>['https://localhost','capacitor://localhost'].includes(v)?v:origin(v));
 return {enabled:!example&&value.enabled===true,projectRef:value.projectRef??'',apiOrigin,appOrigin,authOrigin,siteKey:example?'':value.siteKey,parentOrigins};
}
export function authHostHeaders(c){
 const common="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
 return `/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Strict-Transport-Security: max-age=31536000\n/email-callback.html\n  X-Frame-Options: DENY\n  Content-Security-Policy: ${common}; connect-src ${c.apiOrigin}; frame-src 'none'; frame-ancestors 'none'\n/signup-challenge.html\n  Content-Security-Policy: default-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${c.parentOrigins.join(' ')}\n`;
}

export function applicationCsp(c){return `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${c.apiOrigin}; frame-src ${c.authOrigin}; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`;}
