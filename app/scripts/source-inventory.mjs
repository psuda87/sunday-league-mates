import ts from 'typescript';
import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
// Conservative static graph, not proof of dead code: dynamic/runtime and test refs remain reviewable.
const root=process.cwd();
const entries=['app/src/main.tsx','app/b1/main.tsx','app/demo/main.tsx','app/live-local/main.tsx','app/android-stage3/main.tsx','app/card-preview/main.tsx'].filter(existsSync);
const files=[];function walk(p){for(const e of readdirSync(p,{withFileTypes:true}))if(e.isDirectory())walk(p+'/'+e.name);else if(/\.(tsx?|css)$/.test(e.name))files.push(p+'/'+e.name);}walk('app/src');
const edges=new Map(),refs=new Map();
function dependencies(p){if(edges.has(p))return edges.get(p);const src=readFileSync(p,'utf8'),ast=ts.createSourceFile(p,src,ts.ScriptTarget.Latest,true);const values=[];
 function visit(n){if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))values.push(n.moduleSpecifier.text);if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(n.arguments[0]))values.push(n.arguments[0].text);ts.forEachChild(n,visit);}visit(ast);
 const resolved=values.filter(v=>v.startsWith('.')).flatMap(v=>{const b=path.resolve(path.dirname(p),v);return [b,b+'.ts',b+'.tsx',b+'.css',b+'/index.ts',b+'/index.tsx'].filter(existsSync).slice(0,1).map(f=>path.relative(root,f).replaceAll('\\','/'));});edges.set(p,resolved);return resolved;}
function closure(start){const seen=new Set();function go(p){if(seen.has(p)||!existsSync(p)||!(/\.(tsx?|css)$/.test(p)))return;seen.add(p);for(const d of dependencies(p))go(d);}go(start);return [...seen].sort();}
for(const p of files)for(const d of dependencies(p))refs.set(d,[...refs.get(d)??[],p]);
const graph=Object.fromEntries(entries.map(e=>[e,closure(e)]));const used=new Set(Object.values(graph).flat());
const candidates=files.filter(f=>!used.has(f)&&!f.includes('.test.')&&!f.endsWith('.d.ts')&&!f.includes('setupTests')).map(f=>({file:f,references:refs.get(f)??[],status:'review only; no automatic deletion'}));
const out={entries:Object.fromEntries(entries.map(e=>[e,{reachable:graph[e].length,modules:graph[e]}])),candidates};
writeFileSync('docs/SOURCE_INVENTORY.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({entries:Object.fromEntries(entries.map(e=>[e,graph[e].length])),candidates:candidates.length}));
