// Read the exact original modules for visual comparison; no branch/worktree mutation.
import {build,loadConfigFromFile} from 'vite';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const app=fileURLToPath(new URL('../',import.meta.url)).replace(/\\/g,'/');
const repo=fileURLToPath(new URL('../../',import.meta.url));
const base='d0f9fa9f840d2bd7f4985d00c24ee9a703f6b3e4';
const modules=new Set(['demo/main.tsx','src/demo/App.tsx','src/demo/AccountDemo.tsx','src/demo/Profile.tsx','src/demo/GroupScreens.tsx']);
const original={name:'original-frozen-baseline',enforce:'pre',
 resolveId(source,importer){if(source==='./Groups'&&importer?.replace(/\\/g,'/').startsWith(app+'src/demo/'))return app+'src/demo/GroupScreens.tsx';},
 load(id){const relative=id.replace(/\\/g,'/').slice(app.length);if(!modules.has(relative))return;const source=relative.replace('GroupScreens.tsx','Groups.tsx');return execFileSync('git',['show',base+':app/'+source],{cwd:repo,encoding:'utf8'});}
};
const loaded=await loadConfigFromFile({command:'build',mode:'production'},'vite.demo.config.ts');
await build({...loaded.config,configFile:false,plugins:[original,...loaded.config.plugins],build:{...loaded.config.build,outDir:'../.cache/frozen318-baseline'}});
