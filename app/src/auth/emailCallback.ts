export type EmailCallback={kind:'proof';intent:'verify'|'recovery';tokenHash:string}|{kind:'invalid'};

// Fragment-only templates keep email proofs out of HTTP/access/referrer logs.
// Raw implicit-flow JWTs and arbitrary next/redirect URLs are never accepted.
export function consumeEmailCallback(location:Pick<Location,'pathname'|'search'|'hash'>,history:Pick<History,'replaceState'>):EmailCallback|null{
  const {pathname,search,hash}=location;
  const query=new URLSearchParams(search),fragment=new URLSearchParams(hash.slice(1));
  const sensitive=['token_hash','token','code','access_token','refresh_token','error','error_code','error_description'];
  const candidate=pathname==='/auth/callback'||sensitive.some(k=>query.has(k)||fragment.has(k));
  if(!candidate)return null;
  // Scrub BEFORE any asynchronous operation or rendering, also for invalid links.
  history.replaceState(null,'','/');
  const keys=[...fragment.keys()];
  if(pathname!=='/auth/callback'||search||keys.length!==2||new Set(keys).size!==2||keys.some(k=>!['type','token_hash'].includes(k)))return {kind:'invalid'};
  const type=fragment.get('type'),tokenHash=fragment.get('token_hash')??'';
  if(!['signup','recovery'].includes(type??'')||!/^[A-Za-z0-9_-]{40,128}$/.test(tokenHash))return {kind:'invalid'};
  return {kind:'proof',intent:type==='signup'?'verify':'recovery',tokenHash};
}

export interface LegalDocuments {terms:string;privacy:string}
export function legalDocuments(terms:unknown,privacy:unknown):LegalDocuments|undefined{
  const valid=(value:unknown)=>{try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{return false;}};
  return valid(terms)&&valid(privacy)?{terms:String(terms),privacy:String(privacy)}:undefined;
}
