interface Turnstile {render(target:string,options:Record<string,unknown>):void}
declare global {interface Window {turnstile?:Turnstile}}
const config=JSON.parse(import.meta.env.VITE_SLM_AUTH_PUBLIC_CONFIG),params=new URLSearchParams(location.hash.slice(1)),id=params.get('request_id')??'',origin=params.get('parent_origin')??'';history.replaceState(null,'',location.pathname);
const status=document.getElementById('status')!;
if(!config.enabled||!config.parentOrigins.includes(origin)||!/^[a-f0-9-]{36}$/i.test(id)||window.parent===window){status.textContent='Potwierdzanie nie jest skonfigurowane. Wróć do aplikacji.';}
else{
 const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onerror=()=>{status.textContent='Nie można załadować potwierdzenia. Spróbuj ponownie.';};
 script.onload=()=>window.turnstile?.render('#challenge',{sitekey:config.siteKey,action:'slm_signup',cData:id,callback:(token:string)=>window.parent.postMessage({type:'slm-signup-proof',request_id:id,token},origin),'expired-callback':()=>{status.textContent='Potwierdzenie wygasło. Ponów rejestrację.';},'error-callback':()=>{status.textContent='Nie potwierdzono rejestracji. Spróbuj ponownie.';}});document.head.append(script);
}
export {};
