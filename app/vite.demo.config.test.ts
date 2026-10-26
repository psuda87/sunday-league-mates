import {expect,it} from 'vitest';
import {forbiddenDemoModule as checkModule} from './scripts/demoModulePolicy';
const presentation=new Set(['src/native/frozenDemoAndroid.ts','src/profile/PremiumIdentityEditor.tsx']);
const forbiddenDemoModule=(id:string,root:string)=>checkModule(id,root,presentation);

it.each([
 ['I:\\slm\\app\\','I:/slm/app/src/auth/api.ts'],
 ['I:\\slm\\app\\','I:\\slm\\app\\src\\auth\\api.ts?import'],
 ['/workspace/app/','/workspace/app/src/auth/api.ts'],
])('rejects production Auth on every path representation: %s', (root,id)=>{
 expect(forbiddenDemoModule(id,root)).toBe('src/auth/api.ts');
});
it('allows only explicitly approved presentation modules, not all native modules',()=>{
 expect(forbiddenDemoModule('I:/slm/app/src/native/frozenDemoAndroid.ts','I:\\slm\\app\\')).toBeNull();
 expect(forbiddenDemoModule('I:/slm/app/src/native/productionTokens.ts','I:\\slm\\app\\')).toBe('src/native/productionTokens.ts');
 expect(forbiddenDemoModule('I:/slm/app/src/profile/PremiumIdentityEditor.tsx','I:\\slm\\app\\')).toBeNull();
});
