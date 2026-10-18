import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { verifyLogoAlpha } from './verify-logo-alpha.mjs';
const root = fileURLToPath(new URL('../dist-demo/', import.meta.url));
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(`${dir}/${entry.name}`);
    else files.push(`${dir}/${entry.name}`);
  }
}
await walk(root);
assert(files.some(p => p.endsWith('/index.html')));
const branding = ['slm-logo-primary-transparent.png', 'slm-favicon-64.png', 'stadium-bg-card.jpg', 'stadium-bg-main.jpg', 'espana-dark-texture.jpg'];
for (const name of branding) {
  const emitted = await readFile(new URL('../dist-demo/assets/branding/' + name, import.meta.url));
  const original = await readFile(new URL('../public/assets/branding/' + name, import.meta.url));
  assert.deepEqual(emitted, original, `Demo must ship the exact approved asset: ${name}`);
  if (name === 'slm-logo-primary-transparent.png') verifyLogoAlpha(emitted);
  assert(emitted.length < (name === 'slm-logo-primary-transparent.png' ? 350_000 : 160_000), `Unexpected asset size: ${name}`);
  if (name.endsWith('.png')) assert.equal(emitted.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  else assert(emitted[0] === 0xff && emitted[1] === 0xd8, 'Expected JPEG');
}
assert(!files.some(p => p.endsWith('slm-crest-espana.svg')), 'Old crest stays archival, outside the demo');
for (const path of files) {
  if (branding.some(name => path === `${root}/assets/branding/${name}`)) continue;
  assert(/\.(html|js|css|svg)$/.test(path), `Unexpected output: ${path}`);
  const text = await readFile(path, 'utf8');
  assert(!/DEMO_ENV_MUST_NOT_SHIP|demo-canary\.invalid|supabase\.co|hjtcyybkxebvdropchac|functions\/v1|SessionManager|Zaloguj się|Zarządzaj kontami|slm\.auth\.|FCM_SERVICE_ACCOUNT|BEGIN PRIVATE KEY|VITE_SLM_FUNCTION_URL/.test(text), `Forbidden application content: ${path}`);
}
console.log(`Demo isolation verified: ${files.length} static files, no app/Auth/Supabase/Edge markers.`);
