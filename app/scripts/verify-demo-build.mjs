import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
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
const crest = 'assets/branding/slm-crest-espana.svg';
const emittedCrest = await readFile(new URL('../dist-demo/' + crest, import.meta.url));
const originalCrest = await readFile(new URL('../public/' + crest, import.meta.url));
assert.deepEqual(emittedCrest, originalCrest, 'Demo must ship the exact original crest');
for (const path of files) {
  if (path === `${root}/images/match-evening.jpg`) {
    const image = await readFile(path);
    assert(image[0] === 0xff && image[1] === 0xd8 && image.length < 100_000, 'Unexpected demo image format/size');
    continue;
  }
  assert(/\.(html|js|css|svg)$/.test(path), `Unexpected output: ${path}`);
  const text = await readFile(path, 'utf8');
  assert(!/DEMO_ENV_MUST_NOT_SHIP|demo-canary\.invalid|supabase\.co|hjtcyybkxebvdropchac|functions\/v1|SessionManager|Zaloguj się|Zarządzaj kontami|slm\.auth\.|FCM_SERVICE_ACCOUNT|BEGIN PRIVATE KEY|VITE_SLM_FUNCTION_URL/.test(text), `Forbidden application content: ${path}`);
}
console.log(`Demo isolation verified: ${files.length} static files, no app/Auth/Supabase/Edge markers.`);
