import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
// Explicit local-only endpoint: never inherit an .env or production fallback.
export default defineConfig({
 root:fileURLToPath(new URL('./b1',import.meta.url)),envDir:false,envPrefix:[],
 publicDir:fileURLToPath(new URL('./public',import.meta.url)),
 define:{'import.meta.env.VITE_SLM_FUNCTION_URL':JSON.stringify('http://127.0.0.1:54321/functions/v1/accounts')},
 plugins:[react(),{name:'email-callback-csp',apply:'build',transformIndexHtml(html,ctx){
  if(!ctx.filename.endsWith('email-callback.html'))return html;
  return html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; connect-src \'self\' http://127.0.0.1:54321; img-src \'self\' data: blob:; font-src \'self\'; object-src \'none\'; base-uri \'none\'; form-action \'self\'">');
 }}],build:{outDir:'../dist-b1',emptyOutDir:true,sourcemap:false,rollupOptions:{input:{index:fileURLToPath(new URL('./b1/index.html',import.meta.url)),emailCallback:fileURLToPath(new URL('./b1/email-callback.html',import.meta.url))}}},
});
