// Actual production bundle + SessionManager + NEW isolated real backend.
import fs from 'node:fs/promises';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
const setup=JSON.parse(readFileSync(0,'utf8'));assert.match(setup.proxy,/^http:\/\/127\.0\.0\.1:\d+$/);
const root=path.resolve('app/.cache/discovery-browser'),out=process.env.GITHUB_ACTIONS==='true'?path.join(process.env.RUNNER_TEMP,'slm-discovery-evidence'):path.resolve('docs/ui/public-discovery-stage2b'),app=path.resolve('app');
await fs.mkdir(root,{recursive:true});await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(root,'index.html'),'<html lang="pl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await fs.writeFile(path.join(root,'main.tsx'),`
import React,{useState,useSyncExternalStore} from 'react';import {createRoot} from 'react-dom/client';
import {IonApp,IonPage,IonContent,setupIonicReact} from '@ionic/react';
import '@ionic/react/css/core.css';import '@ionic/react/css/normalize.css';import '@ionic/react/css/structure.css';import '@ionic/react/css/typography.css';import '@ionic/react/css/palettes/dark.class.css';
import '../../src/theme/variables.css';import '../../src/pages/Accounts.css';
import PremiumEvents from '../../src/events/PremiumEvents';import {usePremiumEvents} from '../../src/events/usePremiumEvents';import {SessionManager} from '../../src/auth/sessionManager';import {AccountError} from '../../src/auth/api';
setupIonicReact();const setup=await (await fetch('/fixture')).json();
async function request(action,values={},session){const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({...values,action})});const data=await r.json();if(!r.ok)throw new AccountError('Local failure',data.code??'network_error');return data;}
const managers=await Promise.all(setup.users.map(async u=>{let token=u.refresh;const m=new SessionManager({read:async()=>token,write:async v=>{token=v;},clear:async()=>{token=null;}},request);await m.refresh();return m;}));
window.fixture={managers};
export function Client({index}){const manager=managers[index],data=usePremiumEvents(manager,setup.users[index].id);window.fixture.data=data;return <PremiumEvents manager={manager} userId={setup.users[index].id} data={data} onGroups={()=>{}}/>;}
export function App(){const [index,setIndex]=useState(0),auth=useSyncExternalStore(managers[index].subscribe,managers[index].getSnapshot);return <IonApp><IonPage className="slm-demo"><IonContent><main className="slm-accounts"><button onClick={()=>setIndex(i=>1-i)}>Zmień konto testowe</button>{auth.phase==='ready'?<Client key={index} index={index}/>:<section><p>Sesja zamknięta</p><button onClick={()=>managers[index].refresh()}>Sprawdź sesję</button></section>}</main></IonContent></IonPage></IonApp>;}
createRoot(document.getElementById('root')).render(<App/>);
`);
const dist=path.join(root,'dist');await build({configFile:false,root,publicDir:path.join(app,'public'),plugins:[react()],logLevel:'error',build:{outDir:dist,emptyOutDir:true,target:'esnext'}});
const traffic=[];let delayNext=false,oldBackend=false,failNext=false;
const server=createServer((req,res)=>{void(async()=>{
 res.setHeader('Cache-Control','no-store');
 if(req.url==='/fixture'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(setup));return;}
 if(req.url==='/api'){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks),data=JSON.parse(body);
  traffic.push({action:data.action,scope:data.scope,query:data.query,offset:data.offset,time:Date.now()});
  if(data.action==='matches_list'&&failNext){failNext=false;res.statusCode=503;res.end('{"code":"service_unavailable"}');return;}
  const response=await fetch(setup.proxy+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},body});
  const payload=await response.json();
  if(data.action==='matches_list'&&oldBackend)delete payload.public_discovery_version;
  if(data.action==='matches_list'&&delayNext){delayNext=false;await new Promise(r=>setTimeout(r,1000));}
  res.statusCode=response.status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(payload));return;
 }
 const name=new URL(req.url,'http://127.0.0.1').pathname,file=path.resolve(dist,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(dist+path.sep)){res.statusCode=403;res.end();return;}
 try{const data=await fs.readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]??'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}
 })().catch(()=>{if(!res.writableEnded){res.statusCode=503;res.end('{"code":"network_error"}');}});});
await new Promise(r=>server.listen(5199,'127.0.0.1',r));
const profile=await fs.mkdtemp(path.join(tmpdir(),'slm-discovery-'));
const executable=process.env.SLM_CHROME_PATH??(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium');assert(existsSync(executable));
const chrome=spawn(executable,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-extensions','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
let ws,passed=0;const sleep=ms=>new Promise(r=>setTimeout(r,ms));const check=(ok,label)=>{assert(ok,label);passed++;console.log('PASS discovery browser: '+label);};
try{
 let pages;for(let i=0;i<100;i++){try{const port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();break;}catch{await sleep(100);}}
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let seq=0;const tasks=new Map(),errors=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.id){const t=tasks.get(m.id);tasks.delete(m.id);m.error?t.reject(Error(m.error.message)):t.resolve(m.result);}});
 const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;tasks.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,'Browser expression failed');return r.result.value;};
 const wait=async expression=>{for(let i=0;i<200;i++){if(await ev(expression))return;await sleep(100);}throw Error('Browser timeout: '+expression);};
 const click=label=>ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable');b.click();})()`);
 const select=scope=>ev(`(()=>{const e=document.querySelector('select[aria-label="Aktywna grupa"]');const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(e,${JSON.stringify(scope)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const query=value=>ev(`(()=>{const e=document.querySelector('input[type="search"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const ready="window.fixture?.data&&!window.fixture.data.loading";
 await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cmd('Page.navigate',{url:'http://127.0.0.1:5199/'});await wait(ready);
 check(await ev('window.fixture.data.discoveryEnabled'),'real version1 enables discovery');
 await select('public');await wait(ready);const start=Date.now();await query(setup.special);await wait(ready+'&&window.fixture.data.search==='+JSON.stringify(setup.special)+'&&window.fixture.data.events.length===1');
 check(traffic.some(t=>t.query===setup.special&&t.time-start>=250),'debounced Polish/special query reaches real matches_list');
 check(!await ev(`window.fixture.data.events.some(e=>e.id===${JSON.stringify(setup.privateId)})`),'private sentinel absent from public search');
 await query(setup.bulk);await wait(ready+'&&window.fixture.data.events.length===100');await click('Następna strona');await wait(ready+'&&window.fixture.data.offset===100');check(await ev('window.fixture.data.events.length===5&&!window.fixture.data.hasMore'),'server pagination100+5');
 delayNext=true;await query(setup.bulk);await sleep(400);await select('groups');await wait(ready);await sleep(1100);check(await ev("window.fixture.data.activeGroup==='groups'&&window.fixture.data.search===''&&window.fixture.data.offset===0"),'scope change rejects delayed real response and clears query/page');
 await click('Zmień konto testowe');await wait(ready+'&&window.fixture.data.groups.length===0');await select('groups');await wait(ready);check(await ev('window.fixture.data.events.length===0'),'user without groups has empty groups scope');
 await select('public');await wait(ready);await query('no-match-sentinel');await wait(ready+"&&window.fixture.data.search==='no-match-sentinel'");check(await ev('window.fixture.data.events.length===0'),'real search empty state');
 failNext=true;await ev('window.fixture.data.refresh()');await wait("document.body.innerText.includes('Sesja zamknięta')");check(!await ev('!!document.querySelector("input[type=search]")'),'network failure hides protected feed through SessionManager');await click('Sprawdź sesję');await wait(ready);await select('public');await wait(ready);check(true,'session retry restores real backend feed');
 oldBackend=true;await ev('window.fixture.data.refresh()');await wait('!!window.fixture.data.error');check(await ev('window.fixture.data.events.length===0'),'old-backend marker removal fails closed (injected compatibility response)');oldBackend=false;await click('Spróbuj ponownie');await wait(ready+'&&!window.fixture.data.error');
 await query('Łódź');await wait(ready+"&&window.fixture.data.search==='Łódź'");
 for(const dark of [false,true]){await ev(`document.documentElement.classList.toggle('ion-palette-dark',${dark})`);await sleep(150);check(!await ev('document.documentElement.scrollWidth>innerWidth'),'390px '+(dark?'Dark':'Light')+' retains layout');await fs.writeFile(path.join(out,dark?'public-dark.png':'public-light.png'),Buffer.from((await cmd('Page.captureScreenshot',{format:'png'})).data,'base64'));}
 await ev('window.fixture.managers[1].logout()');await wait("document.body.innerText.includes('Sesja zamknięta')");check(!await ev('!!document.querySelector("input[type=search]")'),'logout unmounts search and results');
 check(errors.length===0,'no uncaught browser exceptions');console.log('DISCOVERY_UI_RESULT '+passed+' PASS');
}finally{ws?.close();chrome.kill();await new Promise(r=>server.close(r));}
