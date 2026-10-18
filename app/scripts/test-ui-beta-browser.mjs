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
async function widths(){for(const width of [320,390,768]){await viewport(width);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,`Overflow ${width}`);const row=await evaluate("[...document.querySelectorAll('[role=tab]')].filter(el=>el.checkVisibility()).map(el=>Math.round(el.getBoundingClientRect().top))");if(row.length)assert.equal(new Set(row).size,1);const hit=await evaluate("[...document.querySelectorAll('.slm-demo-person,.slm-player-list button')].filter(el=>el.checkVisibility()).every(el=>el.getBoundingClientRect().height>=44)");assert(hit);const card=await evaluate("(() => {const el=$demo('.slm-ultimate-card');if(!el)return null;const r=el.getBoundingClientRect(),p=$demo('.slm-ultimate-portrait'),n=$demo('.slm-ultimate-nameplate h2 strong');return {left:r.left,right:r.right,ratio:r.width/r.height,portrait:p.getBoundingClientRect().width/p.getBoundingClientRect().height,clipped:n.scrollWidth>n.clientWidth};})()");if(card){const stats=await evaluate("(() => {const fields=[...$demo('.slm-ultimate-stats').children],footer=document.querySelector('ion-footer').getBoundingClientRect();return {tops:fields.map(el=>Math.round(el.getBoundingClientRect().top)),bottom:fields.at(-1).getBoundingClientRect().bottom,footer:footer.top,stars:$demo('.slm-ultimate-stars').getAttribute('aria-hidden')};})()");assert.equal(new Set(stats.tops).size,1);if(!await evaluate("!!$demo('.slm-number-form')"))assert(stats.bottom<=stats.footer);assert.equal(stats.stars,'true');assert(card.left>=0&&card.right<=width);assert(Math.abs(card.ratio-340/502)<.002);assert(Math.abs(card.portrait-.75)<.002);assert.equal(card.clipped,false);}const cta=await evaluate("(() => {const b=$demo('.slm-match-cta');if(!b)return null;return {hit:b.getBoundingClientRect().height,visual:b.shadowRoot.querySelector('button').getBoundingClientRect().height,font:getComputedStyle(b).fontSize};})()");if(cta){assert.equal(cta.hit,44);assert.equal(cta.visual,34);assert.equal(cta.font,'12.48px');}}await viewport();}
async function back(){await evaluate("$demo('ion-button.slm-compact-back').shadowRoot.querySelector('button').focus()");await press('Enter','Enter',13);await pause();}
async function scenario(value){await tools(true);await select('demo-scenario',value);await tools(false);await evaluate("document.querySelector('ion-content').scrollToTop(0)");}
async function profile(name){await evaluate(`(() => {const b=[...document.querySelectorAll('.slm-demo-person,.slm-player-list button')].find(el=>el.checkVisibility()&&el.textContent.includes(${JSON.stringify(name)}));if(!b)throw Error('Missing player link');b.focus();})()`);await press('Enter','Enter',13);await pause();}
async function panel(){return evaluate("$demo('[role=tabpanel]').textContent");}
try {
  await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');await cmd('Log.enable');await viewport();
  const loaded=new Promise(resolve=>{onLoad=resolve;});await cmd('Page.navigate',{url:base});await loaded;
  await evaluate("window.$demo=selector=>[...document.querySelectorAll(selector)].find(el=>el.checkVisibility())");
  for(let i=0;i<100;i++){if(await evaluate("!!$demo('.slm-card-link')"))break;await pause();}
  await evaluate('Promise.all([...document.images].map(image=>image.decode()))');await fs.mkdir(output,{recursive:true});
  for(const mode of ['dark','light']) {
    await tools(true);await evaluate(`document.querySelector('input[value=${mode}]').click()`);await tools(false);await widths();await shot(`home-${mode}`);
    assert.equal(await evaluate("$demo('.slm-crest').naturalWidth"),450);
    assert.equal(await evaluate("document.querySelectorAll('.slm-card-link').length"),4);
    await scenario('free');await widths();assert((await panel()).includes('12 / 15'));
    await shot(`participants-${mode}`);
    await profile('Kamil Zieliński');await widths();assert.equal(await evaluate("$demo('.slm-ultimate-nameplate h2').textContent"),'Kamil Zieliński');await evaluate("$demo('.slm-ultimate-portrait img').decode()");await shot(`player-profile-${mode}`);
    if(mode==='dark')for(const width of [320,768]){await viewport(width);await shot(`player-card-${width}`);}await viewport();
    assert.equal(await evaluate("$demo('.slm-ultimate-portrait').dataset.portrait"),'1-0');
    assert.equal(await evaluate("$demo('.slm-ultimate-number-edit')!==undefined"),false,'Another player is read-only');
    assert.equal(await evaluate("$demo('.slm-ultimate-stars').textContent"),'★★★★★');
    assert.equal(await evaluate("$demo('.slm-ultimate-stats').children.length"),4);
    const fit=await evaluate("(() => {const c=$demo('.slm-ultimate-card').getBoundingClientRect(),s=$demo('.slm-ultimate-stats').getBoundingClientRect(),f=document.querySelector('ion-footer').getBoundingClientRect();return {width:c.width,height:c.height,statsBottom:s.bottom,footerTop:f.top};})()");
    assert.equal(fit.width,300);assert(fit.statsBottom<=fit.footerTop,'All stats above footer');
    await shot(`statistics-${mode}`);
    await evaluate("document.querySelector('ion-content').scrollToTop(0)");await back();assert.equal(await evaluate("$demo('[role=tab][aria-selected=true]').textContent"),'Uczestnicy');
    await tab('Składy');await widths();await evaluate("$demo('.slm-demo-teams').scrollIntoView({block:'start'})");await shot(`teams-${mode}`);await evaluate("document.querySelector('ion-content').scrollToTop(0)");
    await profile('Kamil Zieliński');await back();assert.equal(await evaluate("$demo('[role=tab][aria-selected=true]').textContent"),'Składy');
    await tab('Rozliczenie');await widths();assert((await panel()).includes('270,00'));await evaluate("$demo('.slm-demo-settlement').scrollIntoView({block:'start'})");await shot(`settlement-${mode}`);await evaluate("document.querySelector('ion-content').scrollToTop(0)");
    await tab('Informacje');await widths();await shot(`details-${mode}`);
    await tab('Uczestnicy');await click('ZAPISZ SIĘ NA MECZ');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'13');
    await click('Dodaj gościa · demo');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'14');assert((await panel()).includes('Gość Alex Nowak'));
    await click('WYCOFAJ ZAPIS');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'13');
    await scenario('full');await click('DOŁĄCZ DO REZERWY');assert((await panel()).includes('Alex Nowak'));assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'15');
    await click('OPUŚĆ REZERWĘ');await scenario('reserve');await tools(true);
    await evaluate("(() => {const el=document.getElementById('demo-count');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'14');el.dispatchEvent(new Event('input',{bubbles:true}));})()");await pause();await tools(false);await click('ZAJMIJ WOLNE MIEJSCE');assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'15');
    await scenario('cancelled');assert.equal(await evaluate("$demo('.slm-match-cta').disabled"),true);await tab('Rozliczenie');assert((await panel()).includes('brak należności'));
    await scenario('completed');await tab('Uczestnicy');const before=await panel();await evaluate("$demo('.slm-demo-attendance').click()");assert.notEqual(await panel(),before);
    await profile('Alex Nowak');assert.equal(await evaluate("$demo('.slm-demo-profile-history')!==undefined"),false);await back();
    await scenario('debt');assert.equal(await evaluate("$demo('.slm-match-cta').disabled"),true);
    await tools(true);await evaluate("document.querySelector('.slm-demo-tools').scrollIntoView({block:'start'})");await shot(`demo-tools-${mode}`);await tools(false);await evaluate("document.querySelector('ion-content').scrollToTop(0)");
    await evaluate("document.querySelectorAll('.slm-bottom-nav button')[2].click()");await pause();await profile('Alex Nowak');await back();
    await evaluate("document.querySelectorAll('.slm-bottom-nav button')[0].click()");await pause();await click('Historia');
    await evaluate("[...document.querySelectorAll('.slm-next-match')].find(el=>el.textContent.includes('Jesienny sparing')).querySelector('.slm-card-link').click()");await pause();await tab('Rozliczenie');
    await evaluate("(() => {const row=[...document.querySelectorAll('.slm-demo-finance-list li')].find(el=>el.checkVisibility()&&el.querySelector('.slm-demo-person')?.textContent==='Alex Nowak');row.querySelector('ion-button').click();})()");await pause();await back();
    await click('Nadchodzące');
    await evaluate("document.querySelectorAll('.slm-bottom-nav button')[0].click()");await pause();await evaluate("$demo('.slm-card-link').click()");await pause();assert.equal(await evaluate("$demo('.slm-match-cta').disabled"),false);
    await tools(true);await click('Reset danych demo');await tools(false);assert.equal(await evaluate("$demo('.slm-compact-count strong').textContent"),'12/15');
    await evaluate("document.querySelectorAll('.slm-bottom-nav button')[1].click()");await pause();await widths();
    await evaluate("(() => {const el=document.getElementById('demo-player-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'lukasz');el.dispatchEvent(new Event('input',{bubbles:true}));})()");await pause();assert.equal(await evaluate("document.querySelectorAll('.slm-player-list li').length"),1);
    await profile('Łukasz Wrona');await back();assert.equal(await evaluate("document.getElementById('demo-player-search').value"),'lukasz');
    await evaluate("document.querySelectorAll('.slm-bottom-nav button')[0].click()");await pause();
  }
  await scenario('free');await profile('Kamil Zieliński');await tools(true);await select('demo-user','p02');await tools(false);
  await click('7'); // Editable current number, as the simulated owner.
  const inputNumber=async value=>{await evaluate(`(() => {const el=$demo('.slm-number-form input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause();};
  await inputNumber('100');await click('Zapisz numer');assert((await evaluate("$demo('.slm-number-form [role=alert]').textContent")).includes('0 do 99'));
  await shot('player-number-edit');await widths();
  for(const invalid of ['','-1','2.5','abc']){await inputNumber(invalid);await click('Zapisz numer');assert.equal(await evaluate("$demo('.slm-ultimate-number span').textContent"),'7');}
  await inputNumber('0');await click('Zapisz numer');assert.equal(await evaluate("$demo('.slm-ultimate-number span').textContent"),'0');
  await back();await profile('Kamil Zieliński');assert.equal(await evaluate("$demo('.slm-ultimate-number span').textContent"),'0');
  await click('0');await inputNumber('99');await click('Zapisz numer');assert.equal(await evaluate("$demo('.slm-ultimate-number span').textContent"),'99');
  await tools(true);await select('demo-user','p01');await tools(false);assert.equal(await evaluate("!!$demo('.slm-ultimate-number-edit')"),false);assert.equal(await evaluate("$demo('.slm-ultimate-number').textContent"),'99');
  await back();await tab('Składy');await profile('Kamil Zieliński');assert.equal(await evaluate("$demo('.slm-ultimate-number').textContent"),'99');await back();assert.equal(await evaluate("$demo('[role=tab][aria-selected=true]').textContent"),'Składy');
  await scenario('free');assert.equal(await evaluate("document.querySelectorAll('.slm-demo-remove-guest').length"),0,'Foreign guests have no delete control');
  await tools(true);await select('demo-user','p19');await tools(false);assert.equal(await evaluate("$demo('.slm-match-cta').disabled"),true,'A profiled guest cannot withdraw somebody else invitation');await scenario('joined');await tab('Uczestnicy');assert.equal(await evaluate("document.querySelectorAll('.slm-demo-remove-guest').length"),2);
  await evaluate("$demo('.slm-demo-remove-guest').scrollIntoView({block:'center'})");await evaluate("$demo('.slm-demo-remove-guest').click()");await new Promise(resolve=>setTimeout(resolve,350));
  await shot('guest-remove');assert.equal(await evaluate("!!$demo('.slm-ultimate-card')"),false,'Delete must not open profile');
  await evaluate("[...document.querySelectorAll('ion-alert')].find(el=>el.presented).querySelector('.alert-button-role-cancel').click()");await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'12','Cancel keeps the guest');
  await evaluate("$demo('.slm-demo-remove-guest').click()");await new Promise(resolve=>setTimeout(resolve,350));
  await evaluate("[...document.querySelectorAll('ion-alert')].find(el=>el.presented).querySelector('.alert-button-role-destructive').click()");await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'11');assert.equal(await evaluate("$demo('.slm-roster-overview').textContent.includes('Wolne miejsca4Rezerwa2')"),true);
  assert.equal(await evaluate("document.querySelectorAll('.slm-demo-remove-guest').length"),1);
  await evaluate("$demo('.slm-demo-remove-guest').click()");await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(await evaluate("[...document.querySelectorAll('ion-alert')].find(el=>el.presented).textContent.includes('Gość nie ma własnego profilu')"),true);
  await evaluate("[...document.querySelectorAll('ion-alert')].find(el=>el.presented).querySelector('.alert-button-role-destructive').click()");await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(await evaluate("$demo('[role=progressbar]').getAttribute('aria-valuenow')"),'10');assert.equal(await evaluate("document.querySelectorAll('.slm-demo-remove-guest').length"),0);
  await evaluate("document.querySelector('ion-content').scrollToTop(0)");await profile('Piotr Wójcik');assert.equal(await evaluate("$demo('.slm-ultimate-portrait').dataset.portrait"),'1-1');await evaluate("$demo('.slm-ultimate-portrait img').decode()");await shot('player-card-alternate');await back();await profile('Marek Lis');assert.equal(await evaluate("$demo('.slm-ultimate-portrait').dataset.portrait"),'0-1');await evaluate("$demo('.slm-ultimate-portrait img').src='/index.html'");await pause();assert.equal(await evaluate("$demo('.slm-ultimate-portrait').dataset.portrait"),'initials');await widths();await shot('player-card-fallback');await back();
  // Preserve exact match/tab/expansion/scroll through a global profile visit.
  await scenario('free');await click('Pokaż wszystkich (10)');await evaluate("document.querySelector('ion-content').scrollToPoint(0,400,0)");await pause();
  const y=await evaluate("document.querySelector('ion-content').getScrollElement().then(el=>el.scrollTop)");await profile('Kamil Zieliński');await back();
  assert.equal(await evaluate("document.querySelector('ion-content').getScrollElement().then(el=>el.scrollTop)"),y);assert.equal(await evaluate("$demo('.slm-roster-expand').getAttribute('aria-expanded')"),'true');
  await evaluate("document.querySelector('ion-content').scrollToTop(0)");await tools(true);
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await evaluate("document.querySelector('input[value=auto]').click()");await pause();assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"),true);
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await pause();assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"),false);
  assert.equal(requests.some(url=>url.startsWith('http')&&new URL(url).origin!==new URL(base).origin),false);assert.deepEqual(errors,[]);
  console.log('PASS: demo world 320/390/768, global profiles with Enter/tab and scroll return, teams, finance, join/guest/withdraw/reserve/cancel/debt/reset, search, Ultimate portraits/ratios/fallback/four stats/own number validation and persistence, own guest confirmation/cancel/removal and isolation/CSP.');
} finally {ws.close();}
