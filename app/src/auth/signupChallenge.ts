import {AccountError} from './api';
export function createSignupChallenge(challengeUrl:string){
 const url=new URL(challengeUrl);if(url.protocol!=='https:'||url.pathname!=='/signup-challenge.html'||url.search||url.hash||url.username||url.password)throw Error('Invalid signup challenge URL');
 return (id:string)=>new Promise<string>((resolve,reject)=>{
  const dialog=document.createElement('dialog'),frame=document.createElement('iframe'),cancel=document.createElement('button');
  frame.title='Potwierdź rejestrację';frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.style.width='min(360px,75vw)';frame.style.height='240px';frame.style.border='0';cancel.type='button';cancel.textContent='Anuluj';
  const target=new URL(url);target.hash=new URLSearchParams({request_id:id,parent_origin:location.origin}).toString();frame.src=target.href;
  let settled=false;const finish=(token?:string)=>{if(settled)return;settled=true;clearTimeout(timer);window.removeEventListener('message',message);dialog.remove();if(token)resolve(token);else reject(new AccountError('Nie potwierdzono rejestracji. Spróbuj ponownie.','challenge_cancelled'));};
  const message=(event:MessageEvent)=>{if(event.origin!==url.origin||event.source!==frame.contentWindow||event.data?.request_id!==id||event.data?.type!=='slm-signup-proof')return;const token=event.data.token;if(typeof token==='string'&&token.length>0&&token.length<=2048)finish(token);};
  const timer=setTimeout(()=>finish(),300000);window.addEventListener('message',message);cancel.onclick=()=>finish();dialog.addEventListener('cancel',()=>finish());dialog.append(frame,cancel);document.body.append(dialog);try{dialog.showModal();}catch{finish();}
 });
}
