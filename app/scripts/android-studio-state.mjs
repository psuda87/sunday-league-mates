import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
function walk(dir, prefix = '') {
  return readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory()
    ? walk(resolve(dir, e.name), prefix + e.name + '/') : [prefix + e.name]);
}
export function fingerprint() {
  const names = ['src', 'demo', 'android-stage3', 'b1', 'public'].flatMap(dir =>
    walk(resolve(app, dir)).map(name => dir + '/' + name));
  names.push('capacitor.config.ts', 'package.json', 'package-lock.json', 'index.html',
    ...readdirSync(app).filter(name => /^vite\..*config\.ts$/.test(name)));
  return hash(names.sort().map(name => name + ':' + hash(readFileSync(resolve(app, name)))).join('\n'));
}
export function verifyPrepared() {
  const state = JSON.parse(readFileSync(resolve(app, '.cache/android-studio/prepared.json'), 'utf8'));
  assert(['ui', 'live'].includes(state.mode), 'Unknown prepared mode');
  assert.equal(state.inputsSha256, fingerprint(), 'Sources changed: run android:ui or android:live before Android Studio Run');
  const native = resolve(app, 'android/app/src/main/assets');
  assert.equal(hash(readFileSync(resolve(native, 'capacitor.config.json'))), state.configSha256, 'Another cap sync replaced the prepared mode');
  assert.deepEqual(walk(resolve(native, 'public')).sort(), Object.keys(state.assets).sort(), 'Native asset set changed');
  for (const [name, expected] of Object.entries(state.assets))
    assert.equal(hash(readFileSync(resolve(native, 'public', name))), expected, 'Stale/tampered native asset: ' + name);
  console.log(`PASS prepared ${state.mode.toUpperCase()}: current sources, Capacitor config and all native assets match. No build/install/network.`);
  return state;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) verifyPrepared();
