import type {EmailTransport} from './emailFlows.ts';
// Server only; lazy import keeps SMTP out of inactive workers and all client bundles.
export function smtpEmail(get:(name:string)=>string|undefined,backendUrl:string,defer:(task:Promise<void>)=>void):EmailTransport|undefined {
 if(get('SLM_ACCOUNT_EMAIL_ENABLED')!=='true')return undefined;
 const local=get('SLM_EMAIL_LOCAL_TEST')==='true'&&['http://kong:8000','http://127.0.0.1:60321'].includes(backendUrl);
 const host=get('SMTP_HOST')??'',port=Number(get('SMTP_PORT')??'465'),from=get('SMTP_FROM')??'',callbackUrl=get('SLM_EMAIL_CALLBACK_URL')??'';
 const url=new URL(callbackUrl);
 if(url.username||url.password||url.search||url.hash||!url.pathname.endsWith('/email-callback.html')||!(url.protocol==='https:'||local&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw Error('Invalid email callback configuration');
 if(!host||!from||/[\r\n]/.test(from)||!Number.isInteger(port)||port<1||port>65535||!local&&[25,587].includes(port))throw Error('Invalid SMTP configuration');
 if(local&&!['supabase_inbucket_slm-account-mail','supabase_mailpit_slm-account-mail','inbucket','mailpit'].includes(host))throw Error('Only isolated local test mail server allowed');
 // Edge Runtime's Node DNS adapter cannot resolve Docker's underscored service name.
 // Explicit IP is permitted ONLY for the isolated local Mailpit, never remote SMTP.
 const localAddress=get('SMTP_LOCAL_ADDRESS');
 if(localAddress&&(!local||!/^172\.(1[6-9]|2[0-9]|3[01])\.([0-9]{1,3})\.([0-9]{1,3})$/.test(localAddress)))throw Error('Invalid local SMTP address');
 return {callbackUrl,defer,async send(to,subject,text){
  if(local&&!to.endsWith('.test'))throw Error('Only synthetic test recipients allowed');
  const {default:nodemailer}=await import('nodemailer');
  const transport=nodemailer.createTransport({host:localAddress??host,port,secure:!local&&port===465,requireTLS:!local,ignoreTLS:local,
   auth:local?undefined:{user:get('SMTP_USER')??'',pass:get('SMTP_PASSWORD')??''},tls:{rejectUnauthorized:true},
   connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false});
  try{const info=await transport.sendMail({from,to:{address:to,name:''},subject,text});if(!info.accepted?.length)throw Error('Delivery not accepted');}finally{transport.close();}
 }};
}
