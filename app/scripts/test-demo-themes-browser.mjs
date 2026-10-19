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
async function palette(value){await tools(true);await evaluate(`document.querySelector('.slm-demo-tools input[value=${value}]').click()`);await tools(false);await topScroll();}
async function badgeGeometry(){return evaluate(`(()=>{const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;return [...document.querySelectorAll('[data-game]')].filter(el=>el.checkVisibility()).map(el=>{const b=el.querySelector('.slm-event-privacy'),card=b.closest('article'),br=b.getBoundingClientRect(),cr=card.getBoundingClientRect();return {inside:br.left>=cr.left&&br.right<=cr.right&&br.top>=cr.top&&br.bottom<=cr.bottom,one:el.querySelectorAll('.slm-event-privacy').length===1,old:!!el.querySelector('.slm-event-label strong'),icon:!!b.querySelector('ion-icon'),overlap:[...card.querySelectorAll('.slm-card-name,.slm-location,.slm-match-date,.slm-compact-count')].some(e=>overlap(br,e.getBoundingClientRect())),height:cr.height};});})()`);}
async function accessibleContrast(){return evaluate(`(()=>{const rgb=c=>c.match(/[0-9.]+/g).slice(0,3).map(Number),l=c=>rgb(c).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0),contrast=(a,b)=>(Math.max(l(a),l(b))+.05)/(Math.min(l(a),l(b))+.05),root=getComputedStyle(document.documentElement),resolve=v=>{const el=document.createElement('span');el.style.color=v;document.body.append(el);const c=getComputedStyle(el).color;el.remove();return c;};return {text:contrast(resolve('var(--ion-text-color)'),resolve('var(--ion-background-color)')),muted:contrast(resolve('var(--slm-text-secondary)'),resolve('var(--slm-panel)')),primary:contrast(resolve('var(--ion-color-primary-contrast)'),resolve('var(--ion-color-primary)')),buttonTop:contrast(resolve('var(--ion-color-primary-contrast)'),resolve('var(--slm-button-top)')),accent:contrast(resolve('var(--slm-gold)'),resolve('var(--slm-panel)')),palette:document.documentElement.dataset.theme};})()`);}
try {
 await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');await cmd('Log.enable');await viewport();await cmd('Emulation.setLocaleOverride',{locale:'en-US'});await cmd('Emulation.setTimezoneOverride',{timezoneId:'America/New_York'});
 const loaded=new Promise(resolve=>{onLoad=resolve;});await cmd('Page.navigate',{url:base});await loaded;await evaluate("window.$demo=selector=>[...document.querySelectorAll(selector)].find(el=>el.checkVisibility())");
 for(let i=0;i<100;i++){if(await evaluate("!!$demo('.slm-card-link')"))break;await pause();}await fs.mkdir(output,{recursive:true});
 const results=[];
 for(const family of ['espana','fcb','lime','deimos']){
  await palette(family);
  for(const mode of ['dark','light','auto']){
   await theme(mode);await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await pause();
   assert.equal(await evaluate('document.documentElement.dataset.theme'),family);assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"),mode!=='light');
   assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
   const contrast=await accessibleContrast();results.push({family,mode,...contrast});assert(contrast.text>=4.5&&contrast.muted>=4.5&&contrast.primary>=4.5&&contrast.buttonTop>=4.5&&contrast.accent>=4.5,JSON.stringify(contrast));
   const badges=await badgeGeometry();assert(badges.every(b=>b.inside&&b.one&&!b.old&&b.icon&&!b.overlap&&b.height===121),JSON.stringify(badges));
   if(mode!=='auto')await shot(`${family}-${mode}`);
   else{await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await pause();assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"),false);assert.equal(await evaluate('document.documentElement.dataset.theme'),family);}
  }
 }
 console.log('12 combinations and contrast',JSON.stringify(results));
 await palette('espana');await theme('dark');await shot('match-privacy-badges');
 for(const width of [320,390,768]){await viewport(width);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);const badges=await badgeGeometry();assert(badges.every(b=>b.inside&&!b.overlap&&b.height===121),`Badge collision ${width}: ${JSON.stringify(badges)}`);}await viewport();
 // Explicitly render the date/time as Polish even with English browser locale and US timezone.
 await evaluate("$demo('.slm-demo-create').click()");await pause();await select('event-groupId','group-1');await field('event-name','Polski termin · demo');await field('event-date','20.10.2026');await field('event-time','18:00');
 assert.deepEqual(await evaluate("['date','time'].map(n=>{const el=document.getElementById('event-'+n);return {type:el.type,value:el.value};})"),[{type:'text',value:'20.10.2026'},{type:'text',value:'18:00'}]);await screenWidths();await shot('polish-date-time');
 await click('Podgląd meczu');assert((await evaluate("$demo('.slm-hero-card').innerText")).includes('18:00'));await click('Utwórz mecz');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'0');
 await palette('fcb');await click('ZAPISZ SIĘ NA MECZ');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'1');await palette('lime');assert((await evaluate("$demo('.slm-match-cta').textContent")).includes('WYCOFAJ'));await click('Edytuj mecz');assert.equal(await evaluate("document.getElementById('event-date').value"),'20.10.2026');assert.equal(await evaluate("document.getElementById('event-time').value"),'18:00');await palette('deimos');await screenWidths();await click('Anuluj');await tab('Rozliczenie');assert.equal(await evaluate("$demo('.slm-finance-rows').children.length"),1);
 // Group and profile smoke, including unchanged Ultimate and active permission checks.
 await nav('groups');assert.equal(await evaluate("document.querySelectorAll('button.slm-group-card').length"),2);await evaluate("document.querySelector('button.slm-group-card').click()");await pause();await screenWidths();await who('p40');assert.equal(await evaluate("!!$demo('.slm-demo-create')"),false);await nav();assert.equal(await evaluate("!!document.querySelector('[data-game=demo-1] .slm-card-link')"),false);await palette('fcb');assert.equal(await evaluate("!!document.querySelector('[data-game=demo-1] .slm-card-link')"),false);await screenWidths();
 await who('p01');await nav('profile');assert.equal(await evaluate("!!$demo('.slm-ultimate-card')"),true);await click('Ustawienia');await pause();await evaluate("$demo('.slm-identity-settings').scrollIntoView({block:'start'})");await pause();await shot('theme-settings');
 for(const width of [320,390,768]){await viewport(width);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);assert.equal(await evaluate("[...document.querySelectorAll('.slm-identity-settings .slm-appearance label')].every(el=>el.getBoundingClientRect().height>=44)"),true);}await viewport();
 await palette('deimos');await theme('light');await tools(true);await click('Reset danych demo');await tools(false);assert.equal(await evaluate('document.documentElement.dataset.theme'),'deimos');assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"),false);assert.equal(await evaluate("document.querySelectorAll('[data-game]').length"),4);
 const reloaded=new Promise(resolve=>{onLoad=resolve;});await cmd('Page.reload');await reloaded;await pause();assert.equal(await evaluate('document.documentElement.dataset.theme'),'deimos');assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"),false);
 assert.equal(requests.some(url=>url.startsWith('http')&&new URL(url).origin!==new URL(base).origin),false);assert.deepEqual(errors,[]);
 await fs.writeFile(`${output}/contrast.json`,JSON.stringify(results,null,2));console.log('PASS3.17 STANDARD: twelve palette/mode combinations, live Auto, preference persistence/reload/reset, card-internal badges/icons/no collisions/121px, explicit Polish date/time under en-US and New York timezone, form/edit/preview, group/profile/finance/registration smoke, permissions unchanged, 320/390/768, no external requests/CSP errors.');
} finally {await cmd('Emulation.setLocaleOverride',{locale:''});await cmd('Emulation.setTimezoneOverride',{timezoneId:''});ws.close();}
