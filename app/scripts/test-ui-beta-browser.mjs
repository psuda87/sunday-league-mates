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
async function viewport(width = 390) { await cmd('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true }); }
async function shot(name) { await pause(); const image = await cmd('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(`${output}/${name}.png`, Buffer.from(image.data, 'base64')); }
async function back() { await evaluate("[...document.querySelectorAll('ion-button')].find(button => button.textContent.includes('Wróć do meczów')).click()"); await pause(); }
async function tools(open) { await evaluate(`document.querySelector('.slm-demo-tools').open = ${open}`); }
async function widths() {
  for (const width of [320, 390, 768]) {
    await viewport(width);
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, `Document overflow at ${width}`);
    const rows = await evaluate("[...document.querySelectorAll('[role=tab]')].map(tab=>Math.round(tab.getBoundingClientRect().top))");
    if (rows.length) assert.equal(new Set(rows).size, 1, 'Tabs must be on one horizontal row');
  }
  await viewport();
}
try {
  await cmd('Page.enable'); await cmd('Page.bringToFront'); await cmd('Network.enable'); await cmd('Log.enable'); await viewport();
  const loaded = new Promise(resolve => { onLoad = resolve; });
  await cmd('Page.navigate', { url: base }); await loaded;
  for (let i = 0; i < 100; i++) { if (await evaluate("!!document.querySelector('.slm-card-link')")) break; await pause(); }
  await evaluate('Promise.all([...document.images].map(image=>image.decode()))');
  assert.equal(await evaluate("document.querySelector('.slm-crest').getAttribute('src')"), '/assets/branding/slm-logo-primary-transparent.png');
  assert.equal(await evaluate("document.querySelector('.slm-crest').naturalWidth"), 450, 'Official logo did not load');
  assert.equal(await evaluate("document.querySelector('.slm-stadium').naturalWidth"), 1400, 'Official stadium did not load');
  await fs.mkdir(output, { recursive: true });
  const metrics = {};
  for (const mode of ['dark', 'light']) {
    await tools(true); await evaluate(`document.querySelector('input[value=${mode}]').click()`); await tools(false);
    await evaluate("document.querySelector('ion-content').scrollToTop(0)"); await widths();
    assert.equal(await evaluate("document.querySelector('#demo-count').checkVisibility()"), false, 'Closed demo tools must hide the slider');
    assert.equal(await evaluate("document.querySelector('.slm-card-link').querySelectorAll('button,ion-button,a').length"), 0);
    const crestStyle=await evaluate("(() => { const el=document.querySelector('.slm-floating-crest'),s=getComputedStyle(el),r=el.getBoundingClientRect();return {fit:s.objectFit,position:s.position,ratio:r.height/r.width}; })()");
    assert.equal(crestStyle.fit,'contain'); assert.equal(crestStyle.position,'relative'); assert(Math.abs(crestStyle.ratio-505/450)<.002);
    await evaluate("document.documentElement.style.setProperty('--ion-safe-area-top','32px')"); await pause();
    assert.equal(await evaluate("document.querySelector('.slm-floating-crest').getBoundingClientRect().top >= 32"),true,'Crest overlaps simulated top safe area');
    await evaluate("document.documentElement.style.removeProperty('--ion-safe-area-top')");
    await tools(true); await evaluate("document.querySelector('ion-content').scrollToPoint(0,100,0)"); await pause();
    assert.equal(await evaluate("document.querySelector('.slm-floating-crest').getBoundingClientRect().top < -20"),true,'Crest must scroll, not stay fixed');
    await tools(false); await evaluate("document.querySelector('ion-content').scrollToTop(0)"); await pause();
    await shot(`home-${mode}`);
    if (mode === 'dark') {
      const detail=await cmd('Page.captureScreenshot', { format:'png', clip:{x:0,y:0,width:390,height:194,scale:2} });
      await fs.writeFile(`${output}/header-detail.png`,Buffer.from(detail.data,'base64'));
    }
    if (mode === 'dark') for (const width of [320, 768]) { await viewport(width); await shot(`home-${width}`); } await viewport();
    for (const [filter, number] of [['Moje', 2], ['Historia', 1], ['Nadchodzące', 4]]) {
      await evaluate(`[...document.querySelectorAll('.slm-match-filters button')].find(button=>button.textContent==='${filter}').focus()`); await press('Enter', 'Enter', 13);
      assert.equal(await evaluate("document.querySelectorAll('.slm-card-link').length"), number);
    }
    metrics[mode] = await evaluate("Object.fromEntries(['.slm-crest','.slm-matches-screen h1','.slm-hero-card','.slm-stadium-frame','.slm-match-filters','.slm-bottom-nav'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [selector,{x:r.x,y:r.y,width:r.width,height:r.height}]}))");
    await evaluate("document.querySelector('.slm-card-link').focus()"); await press('Enter', 'Enter', 13);
    assert.equal(await evaluate("document.querySelectorAll('.slm-variant-preview').length"), 0, 'A/B in normal flow');
    assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').textContent"), 'Uczestnicy');
    assert.equal(await evaluate("[...document.querySelectorAll('[role=tabpanel]')].filter(panel=>!panel.hidden).length"), 1);
    await widths(); await shot(`participants-${mode}`);
    await evaluate("document.querySelectorAll('[role=tab]')[0].click()"); await widths(); await shot(`details-${mode}`);
    await evaluate("document.querySelectorAll('[role=tab]')[2].click()"); await widths(); await shot(`teams-${mode}`);
    await evaluate("document.querySelectorAll('[role=tab]')[1].click()");
    await evaluate("document.querySelector('[role=tab][aria-selected=true]').focus()"); await press('End', 'End', 35);
    assert.equal(await evaluate('document.activeElement.textContent'), 'Rozliczenie');
    assert.equal(await evaluate("document.querySelector('[role=tabpanel]:not([hidden])').textContent.includes('Nie pokazujemy fikcyjnych')"), true);
    await press('Home', 'Home', 36); assert.equal(await evaluate('document.activeElement.textContent'), 'Informacje');
    await press('ArrowRight', 'ArrowRight', 39); assert.equal(await evaluate('document.activeElement.textContent'), 'Uczestnicy');
    await back(); await evaluate("document.querySelector('.slm-card-link').focus()"); await press(' ', 'Space', 32);
    assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').textContent"), 'Uczestnicy'); await back();
  }
  await evaluate("document.querySelectorAll('.slm-bottom-nav button')[1].click()");
  assert.equal(await evaluate("document.querySelector('.slm-bottom-nav [aria-current=page]').textContent"),'Zawodnicy');
  assert.equal(await evaluate("document.querySelector('h1').textContent"),'Zawodnicy');
  await evaluate("document.querySelectorAll('.slm-bottom-nav button')[2].click()");
  assert.equal(await evaluate("document.querySelector('.slm-bottom-nav [aria-current=page]').textContent"),'Profil');
  await evaluate("document.querySelectorAll('.slm-bottom-nav button')[0].click()");
  assert.equal(await evaluate("document.querySelectorAll('.slm-card-link').length"),4);
  await tools(false); await evaluate("document.querySelector('.slm-demo-tools summary').focus()"); await press('Enter', 'Enter', 13);
  assert.equal(await evaluate("document.querySelector('.slm-demo-tools').open"), true, 'Tools must open with native keyboard');
  for (const value of [0, 10, 15, 12]) {
    await evaluate(`(() => { const slider=document.querySelector('#demo-count');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(slider,'${value}');slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true})); })()`); await pause();
    assert.equal(await evaluate("document.querySelector('.slm-compact-count strong').textContent"), `${value}/15`);
  }
  await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await evaluate("document.querySelector('input[value=auto]').click()"); assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"), true);
  await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  for (let i = 0; i < 30; i++) { if (!await evaluate("document.documentElement.classList.contains('ion-palette-dark')")) break; await pause(); }
  assert.equal(await evaluate("document.documentElement.classList.contains('ion-palette-dark')"), false);
  assert.equal(requests.some(url => url.includes('/functions/v1/')), false);
  assert.equal(requests.some(url => url.startsWith('http') && new URL(url).origin !== new URL(base).origin), false);
  assert.deepEqual(errors, []);
  await fs.writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2));
  console.log('PASS: full crest/contain/scroll/simulated safe area, official assets, filters (4/2/1), home/details 320/390/768, horizontal tabs/default Participants, Enter/Space/Home/End/arrows, one panel, themes/live system, slider 0/10/15, isolation/CSP.');
  console.log(JSON.stringify(metrics.dark));
} finally { ws.close(); }
