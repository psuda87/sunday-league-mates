import fs from 'node:fs/promises';
const output = process.env.SLM_UI_ARTIFACTS || '/tmp/slm-ui-preview';
const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, {once:true}));
let resolveLoad;
let seq=0; const pending=new Map(); const backend=[]; const requests=[]; const securityErrors=[];
ws.addEventListener('message', e => { const m=JSON.parse(e.data); if(m.method==='Page.loadEventFired')resolveLoad?.(); if(m.id) {const p=pending.get(m.id); pending.delete(m.id); m.error?p.reject(m.error):p.resolve(m.result);} if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url); if(m.method==='Log.entryAdded' && m.params.entry.source==='security' && m.params.entry.level==='error')securityErrors.push(m.params.entry.text); if(m.method==='Network.requestWillBeSent' && m.params.request.url.includes('/functions/v1/')) backend.push(m.params.request.url); });
function cmd(method,params={}) { return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));}); }
async function evaluate(expression) { const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
await cmd('Log.enable');await cmd('Page.enable');await cmd('Page.bringToFront');await cmd('Network.enable');
await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
const loaded = new Promise(resolve => { resolveLoad = resolve; });
await cmd('Page.navigate',{url:process.env.SLM_UI_URL || 'http://localhost:5174/ui-demo'});
await loaded;
for(let i=0;i<100;i++){if(await evaluate("!!document.querySelector('[role=progressbar]')"))break;await new Promise(r=>setTimeout(r,100));}
if(!await evaluate("!!document.querySelector('[role=progressbar]')"))throw Error('Demo did not render');
await evaluate("Promise.all([...document.images].map(image => image.decode()))");
if(!await evaluate("document.querySelector('.slm-stadium').naturalWidth > 0"))throw Error('Match image failed to load');
await fs.mkdir(output,{recursive:true});
for(const mode of ['dark','light']){
 await evaluate(`document.querySelector('input[value=${mode}]').click()`);
 await new Promise(r=>setTimeout(r,200));
 const shot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(`${output}/espana-${mode}.png`,Buffer.from(shot.data,'base64'));
 await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:1280,deviceScaleFactor:1,mobile:true});
 await new Promise(r=>setTimeout(r,100));
 const full=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(`${output}/espana-${mode}-full.png`,Buffer.from(full.data,'base64'));
 await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate("[...document.querySelectorAll('ion-button')].find(button => button.textContent === 'Szczegóły meczu').click()");
 await new Promise(r=>setTimeout(r,100));
 if(!await evaluate("!!document.querySelector('nav[aria-label=\"Sekcje meczu\"]')"))throw Error('Missing event sections');
 if(await evaluate("document.querySelectorAll('nav[aria-label=\"Główna nawigacja\"] button').length")!==3)throw Error('Main nav must contain 3 items');
 for(const width of [320,390,768]) {
  await cmd('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
  const overflow=await evaluate("document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('.slm-match-sections')].some(el=>el.scrollWidth>el.clientWidth)");
  if(overflow)throw Error('Event detail overflow');
 }
 await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:1280,deviceScaleFactor:1,mobile:true});
 await evaluate("document.querySelector('.slm-match-sections').scrollIntoView({block:'start'})");
 await new Promise(r=>setTimeout(r,100));
 const detailShot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(`${output}/details-${mode}.png`,Buffer.from(detailShot.data,'base64'));
 await evaluate("[...document.querySelectorAll('ion-button')].find(button => button.textContent.includes('Wróć do meczów')).click()");
 await new Promise(r=>setTimeout(r,100));
 if(await evaluate("!!document.querySelector('.slm-match-sections')"))throw Error('Back action did not leave details');
 await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
}
for(const width of [320,390,768]){await cmd('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});const actual=await evaluate('document.documentElement.scrollWidth');if(actual>width)throw Error(`overflow ${actual}>${width}`);console.log(`Mobile layout ${width}px: OK`);}
for (const value of [0,10,15,12]) {
 await evaluate(`(() => { const slider=document.querySelector('#demo-count'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(slider,'${value}'); slider.dispatchEvent(new Event('input',{bubbles:true})); slider.dispatchEvent(new Event('change',{bubbles:true})); })()`);
 await new Promise(r=>setTimeout(r,50));
 const actual=await evaluate("document.querySelector('[role=progressbar]').getAttribute('aria-valuenow')");
 if(actual!==String(value))throw Error('Capacity slider did not update');
}
console.log('Demo capacity slider 0/10/15: OK');
console.log('Three main tabs, match details/back, detail layout 320/390/768: OK');
const progress=await evaluate("document.querySelector('[role=progressbar]').getAttribute('aria-valuenow')");if(progress!=='12')throw Error('Wrong capacity');
await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
await evaluate("document.querySelector('input[value=auto]').click()");
if(!await evaluate("document.documentElement.classList.contains('ion-palette-dark')"))throw Error('System dark not followed');
await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
// Flush a real compositor frame after CDP media emulation (headless may remain idle).
await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
await cmd('Page.captureScreenshot',{format:'png'});
for(let i=0;i<30;i++){if(!await evaluate("document.documentElement.classList.contains('ion-palette-dark')"))break;await new Promise(r=>setTimeout(r,100));}
if(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"))throw Error('System light not followed live');
if(backend.length)throw Error('Demo called backend');
const origin=new URL(process.env.SLM_UI_URL || 'http://localhost:5174/ui-demo').origin;
if(requests.some(url=>url.startsWith('http') && new URL(url).origin!==origin))throw Error('Demo made external requests');
if(securityErrors.length)throw Error('CSP violation: '+securityErrors.join('; '));
console.log('Live system theme, manual theme, accessible capacity, zero backend requests: OK');
console.log(`Screenshots ${output}/espana-{dark,light}.png`);ws.close();
