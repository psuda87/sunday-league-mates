// Minimal implicit-TLS SMTP transport. No plaintext/STARTTLS fallback, dependencies
// or provider API. No command, credential, recipient or server reply is logged.
export interface SmtpConnection {read:(data:Uint8Array)=>Promise<number|null>;write:(data:Uint8Array)=>Promise<number>;close:()=>void}
export interface SmtpSettings {host:string;user:string;password:string;from:string}
export type ConnectSmtp=(options:{hostname:string;port:number})=>Promise<SmtpConnection>;
export interface Mail {to:string;subject:string;text:string;id:string}
export const mailAddress=(s:unknown):s is string=>typeof s==='string'&&s.length<=254&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(s);
export function smtpSettings(s:Partial<SmtpSettings>):s is SmtpSettings{
 return typeof s.host==='string'&&s.host.length<=253&&/^[A-Za-z0-9][A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s.host)&&
  typeof s.user==='string'&&s.user.length>0&&s.user.length<=254&&!/[\r\n\0]/.test(s.user)&&
  typeof s.password==='string'&&s.password.length>0&&s.password.length<=1024&&!/[\r\n\0]/.test(s.password)&&mailAddress(s.from);
}
const base64=(s:string)=>btoa(String.fromCharCode(...new TextEncoder().encode(s)));
export async function sendSmtp(settings:Partial<SmtpSettings>,mail:Mail,connect:ConnectSmtp,deadline:AbortSignal=AbortSignal.timeout(4000)):Promise<void>{
 if(!smtpSettings(settings)||!mailAddress(mail.to)||!mail.id.match(/^[a-zA-Z0-9_-]{1,128}$/))throw Error('mail_unconfigured');
 let conn:SmtpConnection|undefined;
 let buffer='';const encoder=new TextEncoder(),decoder=new TextDecoder();
 async function bounded<T>(operation:()=>Promise<T>):Promise<T>{
  if(deadline.aborted)throw Error('mail_timeout');
  return new Promise<T>((resolve,reject)=>{
   const abort=()=>{try{conn?.close();}catch{/* The socket may already be closed. */}reject(Error('mail_timeout'));};
   deadline.addEventListener('abort',abort,{once:true});
   try{operation().then(resolve,reject).finally(()=>deadline.removeEventListener('abort',abort));}
   catch(error){deadline.removeEventListener('abort',abort);reject(error);}
  });
 }
 try{
  // Deno connectTls verifies the certificate and hostname by default. Only port465.
  if(deadline.aborted)throw Error('mail_timeout');
  const connecting=connect({hostname:settings.host,port:465});
  void connecting.then(c=>{if(deadline.aborted)try{c.close();}catch{/* Already closed. */}},()=>undefined);
  conn=await bounded(()=>connecting);
  async function write(value:string){
   const bytes=encoder.encode(value);let offset=0;
   while(offset<bytes.length){const n=await bounded(()=>conn!.write(bytes.subarray(offset)));if(n<=0)throw Error('mail_transport');offset+=n;}
  }
  async function reply(code:number){
   let total=0;
   while(true){
    while(!buffer.includes('\r\n')){
     const bytes=new Uint8Array(2048),n=await bounded(()=>conn!.read(bytes));if(n===null||n===0)throw Error('mail_transport');
     buffer+=decoder.decode(bytes.subarray(0,n),{stream:true});if(buffer.length>32768)throw Error('mail_transport');
    }
    const end=buffer.indexOf('\r\n'),line=buffer.slice(0,end);buffer=buffer.slice(end+2);total+=line.length;
    if(total>32768||!/^\d{3}[ -]/.test(line)||Number(line.slice(0,3))!==code)throw Error('mail_rejected');
    if(line[3]===' ')return;
   }
  }
  async function command(value:string,code:number){await write(value+'\r\n');await reply(code);}
  await reply(220);
  await command('EHLO slm.invalid',250);
  await command('AUTH PLAIN '+base64('\0'+settings.user+'\0'+settings.password),235);
  await command('MAIL FROM:<'+settings.from+'>',250);
  await command('RCPT TO:<'+mail.to+'>',250);
  await command('DATA',354);
  const domain=settings.from.split('@')[1];
  const body=['From: Sunday League Mates <'+settings.from+'>','To: <'+mail.to+'>',
   'Subject: =?UTF-8?B?'+base64(mail.subject)+'?=','Date: '+new Date().toUTCString(),
   'Message-ID: <'+mail.id+'@'+domain+'>','Auto-Submitted: auto-generated','MIME-Version: 1.0',
   'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',
   base64(mail.text).match(/.{1,76}/g)!.join('\r\n')].join('\r\n');
  await write(body+'\r\n.\r\n');await reply(250); // Accepted by SMTP, not proof of inbox delivery.
  // No QUIT roundtrip after acknowledgement: a failed close must not resend mail.
 }finally{try{conn?.close();}catch{/* No sensitive diagnostics. */}}
}
