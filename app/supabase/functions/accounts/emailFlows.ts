// Scoped proof of an OPTIONAL alias. Never an Auth session, password or primary email.
export interface EmailTransport {callbackUrl:string;send:(to:string,subject:string,text:string)=>Promise<void>;defer:(task:Promise<void>)=>void}
export class EmailFlowError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
type Body=Record<string,unknown>;
export interface EmailDependencies {
 rpc:(name:string,body:Body)=>Promise<unknown>;
 lookup:(email:string)=>Promise<{user_id:string}[]>;
 rate:(key:string,limit:number,seconds?:number)=>Promise<void>;
 updatePassword:(user:string,password:string)=>Promise<void>;
}
export const emailValue=(value:unknown)=>{
 const invalid=()=>new EmailFlowError(400,'invalid_email','Wpisz poprawny adres e-mail.');
 if(typeof value!=='string'||value.length>254)throw invalid();
 const email=value.trim().toLowerCase(),parts=email.split('@');
 // One bare address only: no display-name/list parsing or SMTP header injection.
 const local=/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
 const domain=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
 if(parts.length!==2||parts[0].length>64||!local.test(parts[0])||!domain.test(parts[1]))throw invalid();
 return email;
};
export const emailHash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function emailFlows(transport:EmailTransport|undefined,deps:EmailDependencies){
 function ready(){if(!transport)throw new EmailFlowError(503,'mail_unconfigured','ObsÅ‚uga e-maila nie jest skonfigurowana.');return transport;}
 async function issue(user:string,session:string|null,kind:'verify'|'recovery',email:string,request:string,signup?:{request:string;hash:string}){
  const config=ready();if(!uuid(request))throw new EmailFlowError(400,'invalid_request','NieprawidÅ‚owe Å¼Ä…danie.');
  const token=randomToken(),hash=await emailHash(token);
  const result=await deps.rpc('slm_email_issue',{p_user:user,p_session:session,p_kind:kind,p_email:email,p_request:request,p_hash:hash,p_signup:signup?.request??null,p_signup_hash:signup?.hash??null}) as {id?:string;status:string};
  if(result.status!=='created')return {email_status:result.status};
  const link=new URL(config.callbackUrl);link.hash=new URLSearchParams({kind,id:result.id!,token}).toString();
  const send=(async()=>{let ok=false;try{await config.send(email,kind==='verify'?'SLM â€” potwierdÅº adres e-mail':'SLM â€” zmiana zapomnianego hasÅ‚a',
   (kind==='verify'?'PotwierdÅº adres wyÅ‚Ä…cznie dla swojego konta SLM.':'JeÅ›li prosiÅ‚eÅ› o zmianÄ™ hasÅ‚a swojego konta SLM, otwÃ³rz link. Telefon nie jest dowodem toÅ¼samoÅ›ci.')+'\n\n'+link.href+'\n\nJeÅ¼eli nie prosiÅ‚eÅ› o tÄ™ operacjÄ™, zignoruj wiadomoÅ›Ä‡. Link jest jednorazowy i wygasa.');ok=true;}catch{/* Never log SMTP errors/addresses/tokens. Delivery state is private. */}
   await deps.rpc('slm_email_delivered',{p_id:result.id,p_hash:hash,p_ok:ok}).catch(()=>undefined);
  })();config.defer(send);
  return {email_status:'pending'};
 }
 function tokenBody(body:Body,extra:string[]=[]){
  if(Object.keys(body).some(k=>!['action','id','token',...extra].includes(k))||!uuid(body.id)||typeof body.token!=='string'||!/^[0-9a-f]{64}$/.test(body.token))throw new EmailFlowError(400,'link_invalid','Link jest nieprawidÅ‚owy albo wygasÅ‚.');
  return {id:body.id as string,token:body.token as string};
 }
 return {
  available:!!transport,issue,
  async confirm(body:Body){ready();const t=tokenBody(body);await deps.rate('email-link-global',120);await deps.rpc('slm_email_confirm',{p_id:t.id,p_hash:await emailHash(t.token)});return {email_verified:true};},
  async recover(body:Body){
   // Same public acknowledgement for absent, disabled, unconfigured and known users.
   const start=Date.now();let email:string;try{email=emailValue(body.email);}catch{return {accepted:true};}
   await deps.rate('recovery-address:'+email,3,600);await deps.rate('recovery-global',40);
   if(transport){const rows=await deps.lookup(email);if(rows.length===1)await issue(rows[0].user_id,null,'recovery',email,crypto.randomUUID()).catch(()=>undefined);}
   await new Promise(resolve=>setTimeout(resolve,Math.max(0,500-(Date.now()-start))));return {accepted:true};
  },
  async complete(body:Body){
   ready();const t=tokenBody(body,['new_password']);const password=body.new_password;
   if(typeof password!=='string'||password.length<8||new TextEncoder().encode(password).length>72)throw new EmailFlowError(400,'invalid_password','HasÅ‚o: minimum 8 znakÃ³w, maksimum 72 bajty UTF-8.');
   await deps.rate('recovery-complete:'+t.id,8);const hash=await emailHash(t.token),lease=crypto.randomUUID();
   const user=await deps.rpc('slm_email_recovery_begin',{p_id:t.id,p_hash:hash,p_lease:lease}) as string;
   try{await deps.updatePassword(user,password);}catch(error){
    // Unknown outcome keeps a lease > maximum Edge runtime. Never overlap password writes.
    if(error instanceof EmailFlowError&&error.status===400)await deps.rpc('slm_email_recovery_release',{p_id:t.id,p_hash:hash,p_lease:lease}).catch(()=>undefined);
    throw error;
   }
   await deps.rpc('slm_email_recovery_finish',{p_id:t.id,p_hash:hash,p_lease:lease});return {password_reset:true};
  }
 };
}
