// Vite IDs use forward slashes; Windows fileURLToPath uses backslashes.
export function forbiddenDemoModule(raw:string,root:string,allowed:ReadonlySet<string>):string|null {
 const id=raw.split('?')[0].replace(/\\/g,'/'),base=root.replace(/\\/g,'/');
 const prefix=base.endsWith('/')?base:base+'/';
 if(id.startsWith(prefix)&&!id.includes('/node_modules/')&&!allowed.has(id.slice(prefix.length)))return id.slice(prefix.length);
 return null;
}
