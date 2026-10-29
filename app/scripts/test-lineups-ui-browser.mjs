// Real browser/UI + real SessionManager and HTTP. Bootstrap arrives on stdin;
// generated source and screenshots never contain fixture keys or credentials.
import fs from 'node:fs/promises';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';

const bootstrap = JSON.parse(readFileSync(0, 'utf8'));
assert.match(bootstrap.proxy, /^http:\/\/127\.0\.0\.1:\d+$/);
const app = path.resolve('app'), root = path.join(app, '.cache/lineup-stage2b');
const out = path.resolve('docs/ui/lineups-stage2b');
await fs.mkdir(root, {recursive: true}); await fs.mkdir(out, {recursive: true});
await fs.writeFile(path.join(root, 'index.html'), '<html lang="pl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await fs.writeFile(path.join(root, 'main.tsx'), `
import React,{useState,useSyncExternalStore} from 'react';import {createRoot} from 'react-dom/client';
import {IonApp,IonPage,IonContent,IonFooter,setupIonicReact} from '@ionic/react';
import '@ionic/react/css/core.css';import '@ionic/react/css/normalize.css';import '@ionic/react/css/structure.css';import '@ionic/react/css/typography.css';import '@ionic/react/css/palettes/dark.class.css';
import '../../src/theme/variables.css';import '../../src/pages/Accounts.css';import '../../src/events/premiumEvents.css';
import PremiumTeams from '../../src/events/PremiumTeams';import {SessionManager} from '../../src/auth/sessionManager';import {AccountError} from '../../src/auth/api';
import MatchHeader from '../../src/ui/MatchHeader';import BottomNav from '../../src/demo/DemoBottomNav';
setupIonicReact();
const setup=await (await fetch('/fixture')).json();
async function request(action,values={},session){
 let r;try{r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({...values,action}),signal:AbortSignal.timeout(20000)});}catch{throw new AccountError('offline','network_error');}
 const data=await r.json();if(!r.ok)throw new AccountError(data.error??'Local API error',data.code??'server_error');return data;
}
const ports=await Promise.all(setup.users.map(async u=>{
 const manager=new SessionManager({read:async()=>u.refresh,write:async()=>{},clear:async()=>{}},request);await manager.refresh();
 if(manager.getSnapshot().phase!=='ready')throw Error('Local session not confirmed');
 const detail=await manager.call('matches_detail',{event_id:setup.eventId});return {context:{manager,userId:u.id,groupId:setup.groupId},detail};
}));
window.lineupFixture={ports,eventId:setup.eventId};
function Client({index,active}){
 const p=ports[index],auth=useSyncExternalStore(p.context.manager.subscribe,p.context.manager.getSnapshot),[open,setOpen]=useState(true);
 return <section data-client={index} hidden={!active}>
 <button type="button" onClick={()=>setOpen(v=>!v)}>{open?'Zamknij edytor':'Otwórz edytor'}</button>
 {auth.phase==='ready'&&open?<PremiumTeams eventId={setup.eventId} participants={p.detail.participants} cancelled={false} canEdit profileContext={p.context}/>:auth.phase!=='ready'?<><p>Sesja wymaga ponownego potwierdzenia.</p><button type="button" onClick={()=>p.context.manager.refresh()}>Sprawdź sesję</button></>:null}
 </section>;
}
function App(){const [active,setActive]=useState(0);return <IonApp><IonPage className="slm-demo"><IonContent><main className="slm-accounts"><MatchHeader title="Składy"/><p>Test lokalny · fikcyjne konta · rzeczywisty backend</p><div className="slm-team-actions"><button onClick={()=>setActive(0)}>Klient A</button><button onClick={()=>setActive(1)}>Klient B</button></div><Client index={0} active={active===0}/><Client index={1} active={active===1}/></main></IonContent><IonFooter><BottomNav active="events" onSelect={()=>{}} canCreate={false} onCreate={()=>{}}/></IonFooter></IonPage></IonApp>}
createRoot(document.getElementById('root')).render(<App/>);
`);
const writes = [], traffic = [], browserErrors = []; let loseNext = false;
const server = await createServer({configFile: false, root, cacheDir: path.join(root, 'vite-cache'),
  optimizeDeps: {entries: [path.join(root, 'main.tsx')], include: ['react', 'react-dom/client', '@ionic/react', 'ionicons/icons']},
  publicDir: path.join(app, 'public'), plugins: [
  {name: 'isolated-fixture-bridge', configureServer(s) {s.middlewares.use(bridgeMiddleware);}}, react()],
  server: {host: '127.0.0.1', port: 5198, strictPort: true, fs: {allow: [app]}, hmr: false}});
async function bridgeMiddleware(req, res, next) {
  if (req.url === '/fixture') {res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(bootstrap)); return;}
  if (req.url === '/lose-next-response') {loseNext = true; res.end('{}'); return;}
  if (req.url !== '/api') {next(); return;}
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks), data = JSON.parse(body.toString('utf8'));
    if (data.action === 'lineups_save') {
      assert.deepEqual(Object.keys(data).sort(), ['action','event_id','expected_version','expected_roster_version','team_a','team_b','request_id'].sort());
      writes.push(data);
    }
    const response = await fetch(bootstrap.proxy + '/functions/v1/accounts', {method: 'POST', headers: {
      'Content-Type': 'application/json', ...(req.headers.authorization ? {Authorization: req.headers.authorization} : {})}, body, signal: AbortSignal.timeout(25000)});
    const bytes = Buffer.from(await response.arrayBuffer());
    traffic.push({action: data.action, status: response.status});
    if (loseNext && data.action === 'lineups_save' && response.ok) {loseNext = false; res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({code:'service_unavailable',error:'Controlled lost response after real commit'})); return;}
    res.statusCode = response.status; res.setHeader('Content-Type', 'application/json'); res.end(bytes);
  } catch {res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end('{"code":"service_unavailable"}');}
}
await server.listen();
const chromePath = process.env.SLM_CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/chromium');
assert(existsSync(chromePath), 'Existing Chrome/Chromium required; no browser installation is performed');
const chrome = spawn(chromePath, ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=9227', '--user-data-dir=' + path.join(app, '.cache/lineup-stage2b-chrome'), 'about:blank'], {stdio: 'ignore', windowsHide: true});
let ws, passed = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const check = (ok, label) => {assert(ok, label); console.log('PASS UI real backend: ' + label); passed++;};
try {
  let pages;
  for (let i = 0; i < 100; i++) {try {pages = await (await fetch('http://127.0.0.1:9227/json')).json(); break;} catch {await sleep(100);}}
  assert(pages?.length); ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, {once: true}));
  let serial = 0; const tasks = new Map();
  ws.addEventListener('message', e => {const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') browserErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); if (m.id) {const t = tasks.get(m.id); tasks.delete(m.id); m.error ? t.reject(Error(m.error.message)) : t.resolve(m.result);}});
  const cmd = (method, params = {}) => new Promise((resolve, reject) => {const id = ++serial; tasks.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params}));});
  const evaluate = async expression => {const r = await cmd('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw Error('Browser evaluation failed: ' + expression); return r.result.value;};
  const wait = async expression => {for (let i = 0; i < 240; i++) {if (await evaluate(expression)) return; await sleep(100);} console.error('UI diagnostics', JSON.stringify({traffic, browserErrors, visibleText: await evaluate('document.body.innerText.slice(0,800)')})); throw Error('UI timeout: ' + expression);};
  const client = i => `document.querySelector('[data-client="${i}"]')`;
  const click = (i, label) => evaluate(`(()=>{const b=[...${client(i)}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Unavailable button');b.click();})()`);
  const marker = (i, id) => evaluate(`${client(i)}.querySelector('[data-entry="${id}"] button').click()`);
  const dirty = i => `${client(i)}.querySelector('[data-lineup-dirty]')?.dataset.lineupDirty`;
  const counts = async (i, a, b) => (await evaluate(`${client(i)}.querySelectorAll('.slm-team-a [data-entry]').length`)) === a && (await evaluate(`${client(i)}.querySelectorAll('.slm-team-b [data-entry]').length`)) === b;
  const shot = async name => fs.writeFile(path.join(out, name + '.png'), Buffer.from((await cmd('Page.captureScreenshot', {format: 'png'})).data, 'base64'));
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await cmd('Page.navigate', {url:'http://127.0.0.1:5198/'});
  await wait(`document.querySelectorAll('.slm-football-pitch').length===2`);
  check(await counts(0, 6, 5) && writes.length === 0, 'initial 6:5 proposal, two independent GoTrue clients, no automatic write');
  await shot('proposal-dark');
  await click(0, 'Zapisz'); await wait(`${dirty(0)}==='false'`);
  check(writes.length === 1 && await evaluate(`${client(0)}.innerText.includes('Ostatnia zmiana:')`), 'explicit proposal save, readback, safe server author');
  await shot('saved-dark');
  const aId = await evaluate(`${client(1)}.querySelector('.slm-team-a [data-entry]').dataset.entry`);
  const bId = await evaluate(`${client(1)}.querySelector('.slm-team-b [data-entry]').dataset.entry`);
  await click(1, 'Zamień zawodników'); await marker(1, aId); await marker(1, bId); await click(1, 'Zapisz');
  await wait(`${client(1)}.innerText.includes('Ktoś zapisał nowszy skład')`);
  check(await evaluate(`${dirty(1)}==='true'`), 'second real editor receives HTTP409 and retains its draft');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Klient B').click()"); await shot('conflict');
  await click(1, 'Odśwież skład'); await wait(`${client(1)}.querySelector('[role="alertdialog"]')!==null`); await click(1, 'Zachowaj szkic');
  await click(1, 'Odśwież skład'); await click(1, 'Pobierz aktualny skład'); await wait(`${dirty(1)}==='false'`);
  const guest = await evaluate(`window.lineupFixture.ports[1].detail.participants.find(p=>!p.member_id&&${client(1)}.querySelector('.slm-team-a [data-entry="'+p.id+'"]')).id`);
  await click(1, 'Przenieś zawodnika'); await marker(1, guest); await click(1, 'Przenieś do drużyny B');
  await click(1, 'Zapisz'); await wait(`${dirty(1)}==='false'`);
  check(await counts(1, 5, 6), 'guest participation UUID transfer A to B persists 5:6'); await shot('transfer-guest');
  await click(1, 'Zamień zawodników'); await marker(1, aId); await marker(1, bId); await click(1, 'Zakończ zamiany');
  const member = await evaluate('window.lineupFixture.ports[1].detail.participants.find(p=>p.member_id).id');
  await marker(1, member); await wait(`${client(1)}.querySelector('.slm-ultimate-card')!==null`); await shot('profile');
  await click(1, 'Wróć do składów'); check(await evaluate(`${dirty(1)}==='true'`), 'real scoped profile and original Ultimate/back preserve dirty draft');
  const beforeRestore = writes.length; await click(1, 'Przywróć skład');
  check(await evaluate(`${dirty(1)}==='false'`) && writes.length === beforeRestore, 'baseline restore sends no write');
  await click(1, 'Zamień zawodników'); await marker(1, aId); await marker(1, bId);
  await evaluate("fetch('/lose-next-response',{method:'POST'})"); await click(1, 'Zapisz');
  await wait(`${client(1)}.innerText.includes('Sesja wymaga ponownego potwierdzenia')`);
  const uncertain = writes.at(-1); await click(1, 'Sprawdź sesję'); await wait(`${client(1)}.innerText.includes('Ponów zapis')`);
  await click(1, 'Ponów zapis'); await wait(`${dirty(1)}==='false'`);
  check(writes.at(-1).request_id === uncertain.request_id && JSON.stringify(writes.at(-1)) === JSON.stringify(uncertain), 'lost real commit response survives Auth-shell unmount; identical UUID/payload retry');
  await click(1, 'Zamknij edytor'); await click(1, 'Otwórz edytor'); await wait(`${dirty(1)}==='false'`);
  check(await counts(1, 5, 6), 'reopening reads the persisted common lineup');
  for (const width of [320,390,768]) for (const dark of [true,false]) {
    await cmd('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate(`document.documentElement.classList.toggle('ion-palette-dark',${dark})`); await sleep(120);
    check(!await evaluate("document.documentElement.scrollWidth>innerWidth"), `original Premium layout has no overflow at ${width} ${dark?'Dark':'Light'}`);
    assert(await evaluate(`[...${client(1)}.querySelectorAll('.slm-pitch-player')].every(e=>e.getBoundingClientRect().width>=44)`));
    if(width===390)await shot(dark?'teams-dark':'teams-light');
  }
  console.log(`UI_RESULT ${passed} PASS; real browser/SessionManager/GoTrue/Edge/PostgREST/PostgreSQL; response loss deliberately injected after a real commit.`);
} finally {ws?.close(); chrome.kill(); await server.close();}
