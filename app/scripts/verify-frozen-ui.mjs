import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const photoApproved=JSON.parse(readFileSync(new URL('./b22-data-ui.json',import.meta.url),'utf8'));
const profileApproved=JSON.parse(readFileSync(new URL('./b2-data-ui.json',import.meta.url),'utf8'));
const approved=JSON.parse(readFileSync(new URL('./b1-approved-ui.json',import.meta.url),'utf8'));
const reference='d0f9fa9f840d2bd7f4985d00c24ee9a703f6b3e4';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',cwd:repo}).trim();
assert.equal(git('branch','--show-current'),'feat/slm-v1-live');
assert.equal(git('merge-base',reference,'HEAD'),reference);
const paths=git('ls-tree','-r','--name-only',reference,'--','app/src/demo','app/src/ui','app/src/account-ui','app/src/theme','app/public/assets','app/src/pages/Accounts.css','app/demo/main.tsx').split('\n').filter(path=>path&&!/\.test\./.test(path));
let exact=0,technical=0;
function normalize(source,path){
 let value=source.replace(/\r\n/g,'\n');
 for(const change of [...(photoApproved[path]??[]),...(profileApproved[path]??[]),...(approved[path]??[])])if(value.includes(change.after))value=value.replace(change.after,change.before);
 if(!/\.(tsx?|css)$/.test(path))return value;
 value=value.replace(/^\s*\/\/ FROZEN_ANDROID_BEGIN\n[\s\S]*?^\s*\/\/ FROZEN_ANDROID_END\n/gm,'');
 value=value.replace(/^import \{[^\n]*\} from '[^']*native\/frozenDemoAndroid';\n/gm,'');
 if(path.endsWith('demo/App.tsx')||path.endsWith('demo/Groups.test.tsx'))value=value.replace("from './GroupScreens'","from './Groups'");
 if(path.endsWith('demo/main.tsx'))value=value.replace('setupIonicReact({hardwareBackButton:true});','setupIonicReact();').replace('installFrozenAndroid();\n','');
 return value;
}
for(const path of paths){
 const local=path.replace(/^app\//,'').replace(/src\/demo\/Groups(\.test)?\.tsx$/,'src/demo/GroupScreens$1.tsx');
 assert(existsSync(local),'Frozen file missing: '+local);
 const before=execFileSync('git',['show',reference+':'+path],{cwd:repo}),after=readFileSync(local);
 if(path.includes('/public/assets/')&&!path.endsWith('.svg')){assert(before.equals(after),'Frozen asset changed: '+local);exact++;continue;}
 if(before.equals(after)||before.toString().replace(/\r\n/g,'\n')===after.toString().replace(/\r\n/g,'\n')){exact++;continue;}
 assert.equal(normalize(after.toString(),path),normalize(before.toString(),path),'Unauthorized frozen UI change: '+local);technical++;
}
console.log(`Frozen 3.18 guard PASS: ${exact} unchanged files, ${technical} technical/authorized B1-B2 data modules; CSS/assets/layout unchanged.`);
