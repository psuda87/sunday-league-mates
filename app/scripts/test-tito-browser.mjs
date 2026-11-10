// Mobile component E2E with controlled transport; explicitly NOT database E2E.
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const app=process.cwd(),root=path.join(app,'.cache/tito-browser');
await mkdir(root,{recursive:true});
await writeFile(path.join(root,'index.html'),'<html lang="pl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/tito-browser-fixture.tsx"></script></body></html>');
const server=await createServer({configFile:false,root:app,envDir:false,envPrefix:[],publicDir:path.join(app,'public'),plugins:[react()],
 server:{host:'127.0.0.1',port:5199,strictPort:true,hmr:false}});
await server.listen();
let code=1;
try{
 code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(app,'node_modules/cypress/bin/cypress'),'run','--browser','chrome',
   '--spec','cypress/e2e/tito-lineups.cy.ts','--config','baseUrl=http://127.0.0.1:5199,video=false,screenshotsFolder=.cache/tito-browser/evidence'],{stdio:'inherit',windowsHide:true});
  child.on('error',reject);child.on('close',value=>resolve(value??1));
 });
 console.log('CYPRESS_EXIT '+code);
}finally{await server.close();}
process.exitCode=code;
