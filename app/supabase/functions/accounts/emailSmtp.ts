import {emailValue} from './emailFlows.ts';
import type {EmailTransport} from './emailFlows.ts';
export interface SmtpConfiguration {host:string;port:number;from:string;callbackUrl:string;local:boolean;address?:string;user:string;password:string}
// Invalid/missing configuration disables email, never crashes unrelated legacy Auth.
export function smtpConfiguration(get:(name:string)=>string|undefined,backendUrl:string):SmtpConfiguration|undefined {
 if(get('SLM_ACCOUNT_EMAIL_ENABLED')!=='true')return undefined;
 try{
  const local=get('SLM_EMAIL_LOCAL_TEST')==='true'&&['http://kong:8000','http://127.0.0.1:60321','http://127.0.0.1:62321'].includes(backendUrl);
  const host=get('SMTP_HOST')??'',port=Number(get('SMTP_PORT')??'465'),from=emailValue(get('SMTP_FROM')??''),callbackUrl=get('SLM_EMAIL_CALLBACK_URL')??'',user=get('SMTP_USER')??'',password=get('SMTP_PASSWORD')??'',address=get('SMTP_LOCAL_ADDRESS');
  const url=new URL(callbackUrl);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/email-callback.html'||!(url.protocol==='https:'||local&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))return undefined;
  if(!host||/[\s/:]/.test(host)||!Number.isInteger(port)||port<1||port>65535)return undefined;
  if(local){
   if(!['supabase_inbucket_slm-account-mail','supabase_inbucket_slm-online-readiness','inbucket','mailpit'].includes(host)||port!==1025)return undefined;
   if(address&&!/^172\.(1[6-9]|2[0-9]|3[01])\.(25[0-5]|2[0-4]\d|1?\d?\d)\.(25[0-5]|2[0-4]\d|1?\d?\d)$/.test(address))return undefined;
  }else if(![465,2525,2587].includes(port)||!user.trim()||!password.trim()||/[\r\n]/.test(user+password)||address||url.hostname.endsWith('.invalid')||url.hostname==='localhost'||!host.includes('.')||/^[0-9.]+$/.test(host)||host.endsWith('.invalid'))return undefined;
  return {host,port,from,callbackUrl,local,address,user,password};
 }catch{return undefined;}
}
// Server-only lazy import; inactive workers/client bundles never load SMTP.
export function smtpEmail(get:(name:string)=>string|undefined,backendUrl:string,defer:(task:Promise<void>)=>void):EmailTransport|undefined {
 const config=smtpConfiguration(get,backendUrl);if(!config)return undefined;
 const {host,port,from,callbackUrl,local,address,user,password}=config;
 return {callbackUrl,defer,async send(to,subject,text){
  const recipient=emailValue(to);if(local&&!recipient.endsWith('.test'))throw Error('Synthetic local recipient required');
  const {default:nodemailer}=await import('nodemailer');
  const transport=nodemailer.createTransport({host:address??host,port,secure:!local&&port===465,requireTLS:!local,ignoreTLS:local,
   auth:local?undefined:{user,pass:password},tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},disableFileAccess:true,disableUrlAccess:true,
   connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false});
  try{const info=await transport.sendMail({from:{name:'Sunday League Mates',address:from},to:{address:recipient,name:''},subject,text});if(!info.accepted?.length)throw Error('Delivery not accepted');}finally{transport.close();}
 }};
}
