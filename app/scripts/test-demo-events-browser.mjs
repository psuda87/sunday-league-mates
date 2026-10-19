import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.SLM_UI_URL || 'http://127.0.0.1:5175/';
const output = process.env.SLM_UI_ARTIFACTS || '/tmp/slm-ui-preview';
const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0, onLoad;
const pending = new Map(), requests = [], errors = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Page.loadEventFired') onLoad?.();
  if (message.id) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(message.error) : task.resolve(message.result); }
  if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
  if (message.method === 'Log.entryAdded' && message.params.entry.source === 'security' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
});
const cmd = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
async function evaluate(expression) {
  const result = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const pause = () => new Promise(resolve => setTimeout(resolve, 120));
async function press(key, code, number) {
  const text = key === 'Enter' ? '\r' : key === ' ' ? ' ' : undefined;
  await cmd('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: number, nativeVirtualKeyCode: number, text, unmodifiedText: text });
  await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: number }); await pause();
}
async function viewport(width = 390, height = 844) { await cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }); }
async function shot(name) { await pause(); const image = await cmd('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(`${output}/${name}.png`, Buffer.from(image.data, 'base64')); }
async function tools(open){await evaluate(`document.querySelector('.slm-demo-tools').open=${open}`);await pause();}
async function click(text){await evaluate(`(() => {const el=[...document.querySelectorAll('button,ion-button')].find(el=>el.checkVisibility()&&el.textContent.trim().startsWith(${JSON.stringify(text)}));if(!el)throw Error('Missing visible action: '+${JSON.stringify(text)});el.click();})()`);await pause();}
async function select(id,value){await evaluate(`(() => {const el=document.getElementById('${id}');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await pause();}
async function tab(label){await evaluate(`$demo('[role=tablist]').querySelectorAll('[role=tab]').forEach(el=>{if(el.textContent===${JSON.stringify(label)})el.click();})`);await pause();}
async function widths(){for(const width of [320,390,768]){await viewport(width);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,`Overflow ${width}`);const row=await evaluate("[...document.querySelectorAll('[role=tab]')].filter(el=>el.checkVisibility()).map(el=>Math.round(el.getBoundingClientRect().top))");if(row.length)assert.equal(new Set(row).size,1);const hit=await evaluate("[...document.querySelectorAll('.slm-demo-person,.slm-player-list button')].filter(el=>el.checkVisibility()).every(el=>el.getBoundingClientRect().height>=44)");assert(hit);const card=await evaluate("(() => {const el=$demo('.slm-ultimate-card');if(!el)return null;const r=el.getBoundingClientRect(),p=$demo('.slm-ultimate-portrait'),n=$demo('.slm-ultimate-nameplate h2 strong');return {left:r.left,right:r.right,ratio:r.width/r.height,portrait:p.getBoundingClientRect().width/p.getBoundingClientRect().height,clipped:n.scrollWidth>n.clientWidth};})()");if(card){const stats=await evaluate("(() => {const fields=[...$demo('.slm-ultimate-stats').children],footer=document.querySelector('ion-footer').getBoundingClientRect();return {tops:fields.map(el=>Math.round(el.getBoundingClientRect().top)),bottom:fields.at(-1).getBoundingClientRect().bottom,footer:footer.top,stars:$demo('.slm-ultimate-stars').getAttribute('aria-hidden')};})()");assert.equal(new Set(stats.tops).size,1);if(!await evaluate("!!$demo('.slm-number-form')"))assert(stats.bottom<=stats.footer);assert.equal(stats.stars,'true');assert(card.left>=0&&card.right<=width);assert(Math.abs(card.ratio-340/502)<.002);assert(Math.abs(card.portrait-.75)<.002);assert.equal(card.clipped,false);}const finance=await evaluate("(() => {const section=$demo('.slm-finance');if(!section||!section.querySelector('.slm-finance-tiles'))return null;const tiles=[...section.querySelectorAll('.slm-finance-tiles > div')],controls=[...section.querySelectorAll('button,input,summary')].filter(el=>el.checkVisibility());return {tileTops:tiles.map(el=>Math.round(el.getBoundingClientRect().top)),controls:controls.every(el=>el.getBoundingClientRect().height>=44),amounts:[...section.querySelectorAll('dd')].every(el=>el.scrollWidth<=el.clientWidth)};})()");if(finance){assert.equal(new Set(finance.tileTops).size,2);assert(finance.controls,`Finance controls hit targets ${width}`);assert(finance.amounts,`Finance amounts overflow ${width}`);}
const pitch=await evaluate("(() => {const field=$demo('.slm-football-pitch');if(!field)return null;const markers=[...field.querySelectorAll('.slm-pitch-player')].map(el=>el.getBoundingClientRect()),halves=[...field.querySelectorAll('.slm-team-half')].map(el=>el.getBoundingClientRect().height);return {vertical:field.getBoundingClientRect().height>field.getBoundingClientRect().width,touch:markers.every(r=>r.width>=44&&r.height>=44),overlap:markers.some((a,i)=>markers.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)),halves};})()");if(pitch){assert(pitch.vertical,`Pitch must stay vertical ${width}`);assert(pitch.touch,`Pitch touch target ${width}`);assert.equal(pitch.overlap,false,`Pitch markers overlap ${width}`);assert(Math.abs(pitch.halves[0]-pitch.halves[1])<1);}
const cta=await evaluate("(() => {const b=$demo('.slm-match-cta');if(!b)return null;return {hit:b.getBoundingClientRect().height,visual:b.shadowRoot.querySelector('button').getBoundingClientRect().height,font:getComputedStyle(b).fontSize};})()");if(cta){assert.equal(cta.hit,44);assert.equal(cta.visual,34);assert.equal(cta.font,'12.48px');}}await viewport();}
async function back(){await evaluate("$demo('ion-button.slm-compact-back').shadowRoot.querySelector('button').focus()");await press('Enter','Enter',13);await pause();}
async function scenario(value){await tools(true);await select('demo-scenario',value);await tools(false);await evaluate("document.querySelector('ion-content').scrollToTop(0)");}
async function profile(name){await evaluate(`(() => {const b=[...document.querySelectorAll('.slm-demo-person,.slm-player-list button')].find(el=>el.checkVisibility()&&el.textContent.includes(${JSON.stringify(name)}));if(!b)throw Error('Missing player link');b.focus();})()`);await press('Enter','Enter',13);await pause();}
async function panel(){return evaluate("$demo('[role=tabpanel]').textContent");}
async function input(id,value){await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause();}
async function nav(label){await evaluate(`[...document.querySelectorAll('.slm-bottom-nav button')].find(el=>el.textContent.trim()===${JSON.stringify(label)}).click()`);await pause();}
try {
 await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');await cmd('Log.enable');await viewport();
 const loaded=new Promise(resolve=>{onLoad=resolve;});await cmd('Page.navigate',{url:base});await loaded;
 await evaluate("window.$demo=selector=>[...document.querySelectorAll(selector)].find(el=>el.checkVisibility())");
 for(let i=0;i<100;i++){if(await evaluate("!!$demo('.slm-card-link')"))break;await pause();}
 await fs.mkdir(output,{recursive:true});
 assert.equal(await evaluate("!!$demo('[aria-label=\"Utwórz mecz\"]')"),false);
 await shot('bottom-nav-user');
 await evaluate("location.hash='match-create'");await pause();assert((await evaluate("$demo('.slm-event-form').textContent")).includes('tylko dla administratora'));
 assert.equal(await evaluate("!!$demo('#event-name')"),false);await back();
 await tools(true);await select('demo-event-role','admin');await tools(false);
 for(const mode of ['dark','light']){
  await tools(true);await evaluate(`document.querySelector('input[value=${mode}]').click()`);await tools(false);await viewport();
  await shot(`bottom-nav-admin-${mode}`);
  for(const width of [320,390,768]){await viewport(width);const geometry=await evaluate("(()=>{const nav=document.querySelector('.slm-demo-nav'),b=$demo('.slm-demo-create'),r=b.getBoundingClientRect(),n=nav.getBoundingClientRect();return {w:r.width,h:r.height,protrude:n.top-r.top,center:r.left+r.width/2,overflow:document.documentElement.scrollWidth>innerWidth,touch:[...nav.querySelectorAll('button')].every(el=>el.getBoundingClientRect().height>=44)};})()");assert.equal(geometry.w,56);assert.equal(geometry.h,56);assert.equal(geometry.protrude,20);assert.equal(geometry.center,width/2);assert.equal(geometry.overflow,false);assert(geometry.touch);assert.equal(await evaluate("[...document.querySelectorAll('.slm-demo-nav button:not(.slm-demo-create)')].map(el=>el.textContent).join(',')"),'Mecze,Grupy,Profil');assert.equal(await evaluate("document.querySelector('ion-footer').getBoundingClientRect().height"),105);if(width===320&&mode==='dark')await shot('bottom-nav-320');}
 }
 await viewport();await tools(true);await evaluate("document.querySelector('input[value=dark]').click()");await tools(false);
 await click('Historia');await evaluate("$demo('.slm-demo-create').click()");await pause();await widths();await shot('create-match');
 assert.equal(await evaluate("document.getElementById('event-durationMinutes').value"),'90');
 await input('event-location','');await click('Podgląd meczu');assert((await evaluate("$demo('[role=alert]').textContent")).includes('Podaj miejsce'));
 await input('event-location','Boisko demo · Chorzów');await input('event-name','Mecz testowy 3.14');await input('event-cost','12,345');await click('Podgląd meczu');assert((await evaluate("$demo('[role=alert]').textContent")).includes('Koszt'));
 await input('event-cost','270,01');await input('event-capacity','9');await click('Podgląd meczu');assert((await evaluate("$demo('[role=alert]').textContent")).includes('Limit'));
 await input('event-capacity','15');await input('event-date','2020-01-01');await click('Podgląd meczu');assert((await evaluate("$demo('[role=alert]').textContent")).includes('przyszłą'));
 const date=await evaluate("new Date(Date.now()+86400000*2).toISOString().slice(0,10)");await input('event-date',date);
 await click('Podgląd meczu');await widths();await shot('create-preview');for(const width of [320,768]){await viewport(width);await shot(`preview-${width}`);}await viewport();assert.equal(await evaluate("document.querySelectorAll('.slm-matches-screen .slm-card-link').length"),6,'Preview does not create');
 await click('Wróć do edycji');assert.equal(await evaluate("document.getElementById('event-name').value"),'Mecz testowy 3.14');await click('Podgląd meczu');await click('Utwórz mecz');
 assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'0');assert((await evaluate("$demo('.slm-hero-card').textContent")).includes('Mecz testowy 3.14'));
 await click('ZAPISZ SIĘ NA MECZ');await click('Dodaj gościa');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'2');
 await click('Edytuj mecz');await shot('edit-match');await input('event-minimum','1');await input('event-capacity','1');await click('Podgląd meczu');assert((await evaluate("$demo('[role=alert]').textContent")).includes('zapisanych (2)'));
 await input('event-capacity','3');await input('event-minimum','2');await input('event-name','Zmieniony mecz demo');await input('event-durationMinutes','75');await click('Podgląd meczu');await click('Zapisz zmiany');
 assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuemax')"),'3');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'2');assert((await panel()).includes('Gość Alex Nowak'));
 assert((await evaluate("$demo('.slm-capacity').textContent")).includes('Minimum 2'));
 await click('Edytuj mecz');await input('event-name','NIE ZAPISUJ');await click('Anuluj');assert((await evaluate("$demo('.slm-hero-card').textContent")).includes('Zmieniony mecz demo'));
 await tab('Informacje');assert((await panel()).includes('75 minut'));assert((await panel()).includes('Boisko demo · Chorzów'));
 await tab('Rozliczenie');assert((await panel()).includes('270,01'));await widths();
 await nav('Mecze');assert.equal(await evaluate("[...document.querySelectorAll('.slm-match-filters button')].find(el=>el.textContent==='Nadchodzące')?.getAttribute('aria-pressed')"),'true');assert.equal(await evaluate("document.querySelectorAll('.slm-card-link').length"),5);assert((await evaluate("$demo('.slm-matches-screen').textContent")).includes('Zmieniony mecz demo'));
 await tools(true);await select('demo-event-role','player');await tools(false);assert.equal(await evaluate("!!$demo('.slm-demo-create')"),false);
 await nav('Mecze');await evaluate("$demo('.slm-card-link').click()");await pause();assert.equal(await evaluate("!!$demo('.slm-demo-edit-event')"),false);
 await tools(true);await select('demo-event-role','admin');await tools(false);await click('Edytuj mecz');await tools(true);await select('demo-event-role','player');await tools(false);assert.equal(await evaluate("!!$demo('#event-name')"),false);
 await tools(true);await click('Reset danych demo');await tools(false);assert.equal(await evaluate("document.querySelectorAll('.slm-card-link').length"),4);assert.equal(await evaluate("!!$demo('.slm-demo-create')"),false);
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(requests.filter(url=>!url.startsWith(base)&&!url.startsWith('data:')).length,0,'No external requests');
 console.log('Premium3.14 Chromium OK: role guards, notch geometry, 320/390/768, validation, preview/no mutation, create, join/guest, edit/cancel/limits, minimum, cost, three tabs, reset, CSP/isolation.');
} finally { ws.close(); }
