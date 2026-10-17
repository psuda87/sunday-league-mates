import fs from 'node:fs/promises';
const output = process.env.SLM_UI_ARTIFACTS || '/tmp/slm-ui-preview';
const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, {once:true}));
let seq=0; const pending=new Map(); const backend=[];
ws.addEventListener('message', e => { const m=JSON.parse(e.data); if(m.id) {const p=pending.get(m.id); pending.delete(m.id); m.error?p.reject(m.error):p.resolve(m.result);} if(m.method==='Network.requestWillBeSent' && m.params.request.url.includes('/functions/v1/')) backend.push(m.params.request.url); });
function cmd(method,params={}) { return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));}); }
async function evaluate(expression) { const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
await cmd('Page.enable');await cmd('Network.enable');
await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await cmd('Page.navigate',{url:'http://localhost:5174/ui-demo'});
for(let i=0;i<100;i++){if(await evaluate("!!document.querySelector('[role=progressbar]')"))break;await new Promise(r=>setTimeout(r,100));}
if(!await evaluate("!!document.querySelector('[role=progressbar]')"))throw Error('Demo did not render');
await fs.mkdir(output,{recursive:true});
for(const mode of ['dark','light']){
 await evaluate(`document.querySelector('input[value=${mode}]').click()`);
 await new Promise(r=>setTimeout(r,200));
 const shot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(`${output}/espana-${mode}.png`,Buffer.from(shot.data,'base64'));
}
for(const width of [320,390,768]){await cmd('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});const actual=await evaluate('document.documentElement.scrollWidth');if(actual>width)throw Error(`overflow ${actual}>${width}`);console.log(`Mobile layout ${width}px: OK`);}
const progress=await evaluate("document.querySelector('[role=progressbar]').getAttribute('aria-valuenow')");if(progress!=='12')throw Error('Wrong capacity');
await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
await evaluate("document.querySelector('input[value=auto]').click()");
if(!await evaluate("document.documentElement.classList.contains('ion-palette-dark')"))throw Error('System dark not followed');
await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await new Promise(r=>setTimeout(r,150));
if(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"))throw Error('System light not followed live');
if(backend.length)throw Error('Demo called backend');
console.log('Live system theme, manual theme, accessible capacity, zero backend requests: OK');
console.log(`Screenshots ${output}/espana-{dark,light}.png`);ws.close();
