import {build,loadConfigFromFile} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const VISION_VERSION='0.10.22';
const VISION_ASSETS=[
 ['tasks-vision.mjs','https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+VISION_VERSION+'/vision_bundle.mjs'],
 ['vision_wasm_internal.wasm','https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+VISION_VERSION+'/wasm/vision_wasm_internal.wasm'],
 ['vision_wasm_internal.js','https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+VISION_VERSION+'/wasm/vision_wasm_internal.js'],
 ['vision_wasm_nosimd_internal.wasm','https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+VISION_VERSION+'/wasm/vision_wasm_nosimd_internal.wasm'],
 ['vision_wasm_nosimd_internal.js','https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+VISION_VERSION+'/wasm/vision_wasm_nosimd_internal.js'],
 ['selfie_segmenter.tflite','https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite']
];
const mediaPipeAssets={name:'slm-local-vision-assets',apply:'build',async generateBundle(){
 for(const [file,url] of VISION_ASSETS){
  const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error('Vision asset unavailable: '+file+' HTTP '+response.status);
  this.emitFile({type:'asset',fileName:'mediapipe/vision/'+file,source:new Uint8Array(await response.arrayBuffer())});
 }
}};
export const ACCOUNTS='https://hjtcyybkxebvdropchac.supabase.co/functions/v1/accounts';
export const CSP="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://hjtcyybkxebvdropchac.supabase.co; font-src 'self' data:; connect-src 'self' https://hjtcyybkxebvdropchac.supabase.co; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
export function premiumWebConfig(base,env=process.env){
 if(env.VITE_SLM_FUNCTION_URL&&env.VITE_SLM_FUNCTION_URL!==ACCOUNTS)throw new Error('Only the approved HTTPS accounts endpoint is allowed');
 const define={...base.define,'import.meta.env.VITE_SLM_FUNCTION_URL':JSON.stringify(ACCOUNTS)};
 for(const name of ['VITE_SLM_TERMS_URL','VITE_SLM_PRIVACY_URL']){
  const value=env[name]??'';
  if(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw new Error('Legal documents require public HTTPS URLs');}
  define['import.meta.env.'+name]=JSON.stringify(value);
 }
 return {...base,configFile:false,envDir:false,envPrefix:[],define,
  plugins:[...base.plugins,mediaPipeAssets,{name:'premium-web-document',transformIndexHtml(html){
   const old="connect-src 'self' http://127.0.0.1:54321";
   if(!html.includes(old))throw new Error('Unexpected Premium source CSP');
   // frame-ancestors is sent as an HTTP header by Vercel, not an ineffective meta.
   return html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*" \/>/,
    '<meta http-equiv="Content-Security-Policy" content="'+CSP.replace("; frame-ancestors 'none'",'')+'" />')
    .replace('<title>SLM — demonstracja UI España</title>','<title>Sunday League Mates</title>');
  }}],build:{...base.build,outDir:'../dist-premium-web',emptyOutDir:true,sourcemap:false}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const cwd=fileURLToPath(new URL('../',import.meta.url));
 const loaded=await loadConfigFromFile({command:'build',mode:'production'},cwd+'vite.b1.config.ts');
 if(!loaded)throw new Error('Existing Premium entry configuration is required');
 await build(premiumWebConfig(loaded.config));
}
