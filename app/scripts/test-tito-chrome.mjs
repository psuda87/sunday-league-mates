// Chrome fallback when the installed Cypress native binary cannot start.
// Real Premium/SessionManager, two synthetic clients. NOT SQL/Edge E2E.
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {mkdir,writeFile,mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const app=process.cwd(),root=path.join(app,'.cache/tito-browser'),out=path.join(root,'evidence');
await mkdir(out,{recursive:true});
await writeFile(path.join(root,'index.html'),'<html lang="pl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/tito-browser-fixture.tsx"></script></body></html>');
const server=await createServer({configFile:false,root:app,envDir:false,envPrefix:[],publicDir:path.join(app,'public'),plugins:[react()],server:{host:'127.0.0.1',port:5199,strictPort:true,hmr:false}});
await server.listen();
const profile=await mkdtemp(path.join(tmpdir(),'slm-tito-synthetic-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-background-networking','--disable-component-update','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
let ws;const pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let port;for(let i=0;i<80;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(100);}}
 assert(port,'Chrome debug endpoint unavailable');const pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
 ws=new WebSocket(pages[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let serial=0;const tasks=new Map(),errors=[];
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const t=tasks.get(m.id);tasks.delete(m.id);m.error?t.reject(Error(m.error.message)):t.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;tasks.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw Error('UI timeout '+expression+' '+JSON.stringify(errors));};
 const client=i=>`document.querySelector('[data-client="${i}"]')`;
 const click=(i,label)=>evaluate(`(()=>{const b=[...${client(i)}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Unavailable button');b.click();})()`);
 const choose=(i,n)=>evaluate(`${client(i)}.querySelector('button[aria-label="Wybierz do zamiany: Osoba ${n}"]').click()`);
 const swap=async i=>{await click(i,'Zamień zawodników');await choose(i,0);await choose(i,1);};
 await cmd('Runtime.enable');await cmd('Page.enable');
 await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cmd('Page.navigate',{url:'http://127.0.0.1:5199/.cache/tito-browser/index.html'});
 await wait("document.querySelectorAll('.slm-football-pitch').length===2");
 const tokens=await evaluate(`${client(0)}.querySelectorAll('.slm-pitch-token').length`);assert.equal(tokens,11);
 const token=n=>evaluate(`${client(0)}.querySelector('[data-entry="00000000-0000-4000-8000-${String(n).padStart(12,'0')}"] .slm-pitch-token').textContent`);
 assert.equal(await token(1),'0');assert.equal(await token(2),'99');assert.equal(await token(3),'—');assert.equal(await token(10),'G');
 assert.equal(await evaluate('document.querySelectorAll("[data-withdrawn]").length'),1);
 for(const width of [320,390])for(const dark of [true,false]){
  await cmd('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.documentElement.classList.toggle('ion-palette-dark',${dark})`);await pause(100);
  assert(!await evaluate('document.documentElement.scrollWidth>innerWidth'),'Mobile overflow '+width);
  assert(await evaluate(`[...${client(0)}.querySelectorAll('.slm-pitch-player')].every(e=>e.getBoundingClientRect().width>=44)`),'Tap target size');
  await evaluate(`${client(0)}.querySelector('.slm-football-pitch').scrollIntoView({block:'center'})`);await pause(100);
  await writeFile(path.join(out,`tito-${width}-${dark?'dark':'light'}.png`),Buffer.from((await cmd('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 await swap(1);await swap(0);await click(0,'Zapisz');
 await wait(`${client(0)}.innerText.includes('Skład zapisany i odświeżony.')`);
 await evaluate("window.dispatchEvent(new Event('focus'))");
 await wait(`${client(1)}.innerText.includes('Ktoś zapisał nowszy skład')`);
 assert.equal(await evaluate(`${client(1)}.querySelector('[data-lineup-dirty]').dataset.lineupDirty`),'true');
 await click(1,'Odśwież skład');await click(1,'Zachowaj szkic');
 assert.equal(await evaluate(`${client(1)}.querySelector('[data-lineup-dirty]').dataset.lineupDirty`),'true');
 await click(1,'Odśwież skład');await click(1,'Pobierz aktualny skład');
 await wait(`${client(1)}.querySelector('[data-lineup-dirty]').dataset.lineupDirty==='false'`);
 assert.deepEqual(errors,[]);
 console.log('PASS Chrome: 320/390 Light/Dark, 0/99/dash/G, current withdrawals, two synthetic sessions, conflict keeps draft and explicit refresh resolves. Controlled transport only.');
}finally{ws?.close();chrome.kill();await server.close();}
