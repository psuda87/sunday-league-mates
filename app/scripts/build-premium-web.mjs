import {build,loadConfigFromFile} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const VISION_VERSION='0.10.14';
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
// PWA: manifest, ikona na pulpit (Android/iOS) i ekran startowy w kolorach wybranego profilu.
const BOOT_BG='#0b0c10';
const BOOT_LOGO='/assets/branding/slm-boot-crest.webp';
// Kolory ekranu startowego per profil i tryb (bb tło, g1/g2 poświata, a akcent, a1/a2 gradient paska, h halo); /boot-splash.js ustawia data-p i data-m.
const BOOT_PALETTES={
 'espana-dark':['#0b0c10','#3a0c17','#1a0b10','#e6b94e','#9c641e','#fff0ad','230,185,78'],
 'espana-light':['#f7f5f0','#f1d3cf','#f6e9e3','#866315','#c59a39','#f0d38c','183,44,56'],
 'fcb-dark':['#080f22','#14306d','#0c1838','#e8be62','#a8801e','#fff0b8','232,190,98'],
 'fcb-light':['#f4f5fa','#d3dcf1','#e8ecf7','#71520e','#c59a39','#e8be62','23,59,131'],
 'lime-dark':['#172a27','#2e5a35','#1d3530','#b9f254','#77a32b','#e6ffb8','185,242,84'],
 'lime-light':['#f4f8ef','#d8eacb','#e8f1df','#426516','#77a32b','#b9f254','48,100,58'],
 'deimos-dark':['#121212','#3a2763','#1d1729','#b58aff','#7142bd','#e3d2ff','181,138,255'],
 'deimos-light':['#f7f3fc','#e2d4f5','#eee7f8','#65409a','#7142bd','#c9b0f0','113,66,189']
};
const bootVars=([bb,g1,g2,a,a1,a2,h])=>'--bb:'+bb+';--g1:'+g1+';--g2:'+g2+';--a:'+a+';--a1:'+a1+';--a2:'+a2+';--h:'+h;
const bootPaletteCss=Object.entries(BOOT_PALETTES).map(([key,c])=>{const [p,m]=key.split('-');return '.slm-boot[data-p="'+p+'"][data-m="'+m+'"]{'+bootVars(c)+'}';}).join('');
export const PWA_HEAD=[
 '<link rel="manifest" href="/manifest.json" />',
 '<meta name="theme-color" content="'+BOOT_BG+'" />',
 '<link rel="apple-touch-icon" href="/assets/branding/slm-apple-touch-180.png" />',
 '<meta name="apple-mobile-web-app-capable" content="yes" />',
 '<meta name="mobile-web-app-capable" content="yes" />',
 '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
 '<meta name="apple-mobile-web-app-title" content="SLM" />',
 '<link rel="preload" as="image" href="'+BOOT_LOGO+'" />',
 '<style>html:has(#slm-boot),html:has(#slm-boot) body{background:'+BOOT_BG+'}'
 +'.slm-boot{'+bootVars(BOOT_PALETTES['espana-dark'])+';position:fixed;inset:0;z-index:2147483000;transition:opacity .45s ease;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;'
 +'background:radial-gradient(ellipse at 50% 46%,var(--g1) 0%,var(--g2) 42%,var(--bb) 75%);color:var(--a);font:600 13px/1.2 system-ui,sans-serif;letter-spacing:.22em;text-transform:uppercase}'
 +bootPaletteCss
 +'.slm-boot:before{content:"";position:absolute;inset:0;background:'+BOOT_BG+';animation:slm-boot-reveal .8s ease .2s forwards}'
 +'.slm-boot>*{position:relative;z-index:1}'
 +'.slm-boot-bar{animation:slm-boot-fade .5s ease .6s both}'
 +'.slm-boot-crest{position:relative;width:min(46vw,210px);aspect-ratio:420/471;animation:slm-boot-in .8s cubic-bezier(.2,1.2,.4,1) .1s both,slm-boot-glow 2.4s ease-in-out .7s infinite}'
 +'.slm-boot-crest img{width:100%;height:100%;object-fit:contain;display:block}'
 +'.slm-boot-crest:after{content:"";position:absolute;inset:0;-webkit-mask:url('+BOOT_LOGO+') center/contain no-repeat;mask:url('+BOOT_LOGO+') center/contain no-repeat;'
 +'background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.6) 50%,transparent 65%) -200% 0/250% 100% no-repeat;animation:slm-boot-shine 2.4s ease-in-out .9s infinite}'
 +'.slm-boot-bar{width:min(40vw,150px);height:3px;border-radius:3px;background:rgba(var(--h),.2);overflow:hidden}'
 +'.slm-boot-bar:before{content:"";display:block;width:40%;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--a1),var(--a2),var(--a));animation:slm-boot-bar 1.1s ease-in-out infinite}'
 +'.slm-boot.slm-boot-out{opacity:0;pointer-events:none}'
 +'.slm-boot-text{opacity:.85;animation:slm-boot-fade .9s ease .4s both}'
 +'@keyframes slm-boot-in{from{transform:scale(.8)}to{transform:none}}'
 +'@keyframes slm-boot-reveal{to{opacity:0}}'
 +'@keyframes slm-boot-glow{0%,100%{filter:drop-shadow(0 0 10px rgba(var(--h),.25))}50%{filter:drop-shadow(0 0 26px rgba(var(--h),.6))}}'
 +'@keyframes slm-boot-shine{0%{background-position:-200% 0}60%,100%{background-position:200% 0}}'
 +'@keyframes slm-boot-bar{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}'
 +'@keyframes slm-boot-fade{from{opacity:0}}'
 +'@media (prefers-reduced-motion:reduce){.slm-boot:before{display:none}.slm-boot *,.slm-boot *:before,.slm-boot *:after{animation:none!important}}</style>'
].join('\n    ');
export const BOOT_SPLASH='<div id="slm-boot" class="slm-boot" role="status" aria-label="Uruchamianie Sunday League Mates">'
 +'<div class="slm-boot-crest"><img src="'+BOOT_LOGO+'" alt="" width="420" height="471" /></div>'
 +'<div class="slm-boot-bar"></div><div class="slm-boot-text">Sunday League Mates</div></div>'
 // Nakładka obok #root: React jej nie czyści. /boot-splash.js (synchronicznie, przed pierwszym malowaniem) nadaje kolory profilu i chowa ją po sprawdzeniu sesji.
 +'<script src="/boot-splash.js"></script>';
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
    .replace('<title>SLM — demonstracja UI España</title>','<title>Sunday League Mates</title>')
    .replace('</head>',PWA_HEAD+'\n  </head>')
    .replace('<div id="root"></div>','<div id="root"></div>'+BOOT_SPLASH);
  }}],build:{...base.build,outDir:'../dist-premium-web',emptyOutDir:true,sourcemap:false}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const cwd=fileURLToPath(new URL('../',import.meta.url));
 const loaded=await loadConfigFromFile({command:'build',mode:'production'},cwd+'vite.b1.config.ts');
 if(!loaded)throw new Error('Existing Premium entry configuration is required');
 await build(premiumWebConfig(loaded.config));
}
