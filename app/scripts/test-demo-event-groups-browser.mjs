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
async function field(id,value){await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause();}
async function nav(value='events'){await evaluate(`document.querySelector('[data-tab=${value}]').click()`);await pause();}
async function who(id){await tools(true);await select('demo-user',id);await tools(false);await topScroll();}
async function topScroll(){await evaluate("document.querySelector('ion-content').scrollToTop(0)");await pause();}
async function theme(value){await tools(true);await evaluate(`document.querySelector('.slm-demo-tools input[value=${value}]').click()`);await tools(false);await topScroll();}
async function open(id){await evaluate(`document.querySelector('[data-game=${id}] .slm-card-link').click()`);await pause();}
async function back(){await evaluate("$demo('ion-button.slm-compact-back').click()");await pause();}
async function editVisibility(value){await click('Edytuj mecz');await select('event-visibility',value);await click('Podgląd meczu');await click('Zapisz zmiany');}
async function screenWidths(){for(const width of [320,390,768]){await viewport(width);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,`Overflow ${width}`);assert.equal(await evaluate("[...document.querySelectorAll('.slm-event-form input,.slm-event-form select,.slm-event-form button,.slm-own-event button')].filter(el=>el.checkVisibility()).every(el=>el.getBoundingClientRect().height>=44)"),true);const plus=await evaluate("(()=>{const el=$demo('.slm-demo-create');if(!el)return null;const r=el.getBoundingClientRect(),nav=document.querySelector('.slm-demo-nav').getBoundingClientRect();return {width:r.width,height:r.height,protrude:nav.top-r.top,center:r.left+r.width/2};})()");if(plus)assert.deepEqual(plus,{width:56,height:56,protrude:20,center:width/2});}await viewport();}
try {
 await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');await cmd('Log.enable');await viewport();
 const loaded=new Promise(resolve=>{onLoad=resolve;});await cmd('Page.navigate',{url:base});await loaded;
 await evaluate("window.$demo=selector=>[...document.querySelectorAll(selector)].find(el=>el.checkVisibility())");
 for(let i=0;i<100;i++){if(await evaluate("!!$demo('.slm-card-link')"))break;await pause();}await fs.mkdir(output,{recursive:true});
 await theme('dark');assert.equal(await evaluate("!!$demo('.slm-demo-create')"),true);assert.equal(await evaluate("!!document.getElementById('demo-event-role')"),false);await screenWidths();await shot('match-list');await viewport(320);await shot('bottom-nav-320');await viewport();
 // Private member view; a short smoke of retained teams/profile/back/finance.
 await open('demo-1');await screenWidths();await shot('private-match');await tab('Składy');assert.equal(await evaluate("$demo('.slm-football-pitch').querySelectorAll('[data-entry]').length"),12);
 await evaluate("$demo('.slm-pitch-player.slm-demo-person').click()");await pause();assert.equal(await evaluate("!!$demo('.slm-ultimate-card')"),true);await back();assert.equal(await evaluate("$demo('[role=tab][aria-selected=true]').textContent"),'Składy');
 await tab('Rozliczenie');await click('Administrator demo');assert.equal(await evaluate("$demo('.slm-finance-rows').children.length"),12);await tab('Uczestnicy');
 await click('Edytuj mecz');await select('event-visibility','public');assert.equal(await evaluate("!!document.getElementById('event-groupId')"),false);await screenWidths();await shot('visibility-edit');await click('Podgląd meczu');await click('Zapisz zmiany');
 await who('p40');assert.equal(await evaluate("!!$demo('.slm-demo-create')"),false);await click('ZAPISZ SIĘ NA MECZ');await click('Dodaj gościa');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'14');await screenWidths();await shot('public-match');
 await tab('Rozliczenie');assert.equal(await evaluate("!!$demo('.slm-finance-role')"),false);assert.equal(await evaluate("$demo('.slm-finance-rows').children.length"),2);await nav('groups');assert.equal(await evaluate("document.querySelectorAll('button.slm-group-card').length"),0);
 // Reclose: saved outsider retains own data, never the full roster or group.
 await nav();await open('demo-1');await who('p01');await editVisibility('private');await who('p40');assert.equal(await evaluate("!!$demo('.slm-own-event')"),true);assert.equal(await evaluate("!!$demo('[role=tablist]')"),false);assert.equal(await evaluate("!!$demo('.slm-football-pitch')"),false);assert.equal(await evaluate("$demo('.slm-finance-rows').children.length"),2);await screenWidths();
 await evaluate("$demo('.slm-finance-rows .slm-demo-person').click()");await pause();assert.equal(await evaluate("!!$demo('.slm-ultimate-card')"),true);await back();assert.equal(await evaluate("!!$demo('.slm-own-event')"),true);
 await who('p38');assert.equal(await evaluate("!!$demo('.slm-own-event')"),false);assert.equal(await evaluate("!!$demo('.slm-demo-roster')"),false);assert.equal(await evaluate("!!$demo('.slm-finance')"),false);await nav();assert.equal(await evaluate("!!document.querySelector('[data-game=demo-1] .slm-card-link')"),false);assert.equal(await evaluate("document.querySelector('[data-game=demo-1]').textContent.includes('14/15')"),false);await screenWidths();await shot('outsider-locked');
 // Normal member: no plus, direct create route denied.
 await who('p04');assert.equal(await evaluate("!!$demo('.slm-demo-create')"),false);await evaluate("location.hash='match-create'");await pause();assert.equal(await evaluate("!!$demo('.slm-event-form input')"),false);assert((await evaluate("$demo('[role=alert]').textContent")).includes('Brak uprawnień'));await nav();
 // Organizer (not group admin) chooses one of two permitted groups and creates private.
 await who('p03');await evaluate("$demo('.slm-demo-create').click()");await pause();assert.deepEqual(await evaluate("[...document.querySelectorAll('#event-groupId option')].map(el=>el.value)"),['','group-1','group-3']);await select('event-groupId','group-1');await field('event-name','Mecz organizatora · demo');assert.equal(await evaluate("document.getElementById('event-visibility').value"),'private');await screenWidths();await shot('create-group-select');await click('Podgląd meczu');await click('Utwórz mecz');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'0');assert.equal(await evaluate("!!$demo('.slm-demo-edit-event')"),true);await click('ZAPISZ SIĘ NA MECZ');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'1');
 // Group administrator is not the creator of this event.
 await who('p01');assert.equal(await evaluate("!!$demo('.slm-demo-edit-event')"),false);await nav();assert((await evaluate("$demo('.slm-match-list').textContent")).includes('Mecz organizatora'));
 // Existing group UI smoke and reset of all event additions.
 await nav('groups');assert.equal(await evaluate("document.querySelectorAll('button.slm-group-card').length"),2);await evaluate("document.querySelector('button.slm-group-card').click()");await pause();assert.equal(await evaluate("!!$demo('.slm-group-person')"),true);
 await tools(true);await click('Reset danych demo');await tools(false);assert.equal(await evaluate("!!$demo('.slm-demo-create')"),true);assert.equal(await evaluate("document.querySelectorAll('[data-game]').length"),4);assert.equal(await evaluate("document.querySelector('main').textContent.includes('Mecz organizatora')"),false);
 // Existing reserve claim remains a change of the saved outsider's own entry.
 await who('p40');await open('demo-2');await click('DOŁĄCZ DO REZERWY');await who('p02');await editVisibility('private');await click('WYCOFAJ ZAPIS');await who('p40');assert.equal(await evaluate("!!$demo('.slm-own-event')"),true);await click('Zajmij wolne miejsce z własnej rezerwy');assert.equal(await evaluate("$demo('.slm-own-event').textContent.includes('Ty · Zapisany')"),true);assert.equal(await evaluate("[...document.querySelectorAll('.slm-own-event button')].some(el=>el.textContent.includes('Zajmij'))"),false);
 await tools(true);await click('Reset danych demo');await tools(false);
 // An already-open player card is rechecked immediately on user change.
 await open('demo-1');await evaluate("$demo('.slm-demo-roster .slm-demo-person').click()");await pause();assert.equal(await evaluate("!!$demo('.slm-ultimate-card')"),true);await who('p40');assert.equal(await evaluate("!!$demo('.slm-ultimate-card')"),false);assert((await evaluate("document.querySelector('main').innerText")).includes('Brak dostępu do tego profilu'));
 await tools(true);await click('Reset danych demo');await tools(false);
 await theme('light');await screenWidths();await open('demo-1');await screenWidths();assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"),false);await back();
 await theme('auto');await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await pause();assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"),true);await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await pause();assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"),false);
 assert.equal(requests.some(url=>url.startsWith('http')&&new URL(url).origin!==new URL(base).origin),false);assert.deepEqual(errors,[]);
 console.log('PASS3.16 STANDARD Chromium: group permissions/selector, organizer create, private outsider list/direct create denial, public join+guest, no automatic membership, reclose retained own-only data/profile return, creator-only edit, group/teams/finance smoke, reset, Dark/Light/Auto, 320/390/768 and unchanged plus56px/20px, no external requests/CSP errors. Model tests cover revoke-at-commit and all unauthorized actions. No full old-module regression.');
} finally {ws.close();}
