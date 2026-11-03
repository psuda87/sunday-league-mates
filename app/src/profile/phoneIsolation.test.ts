import { expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { forbiddenDemoModule } from '../../scripts/demoModulePolicy';
it('admits only the pure phone form/normalizer; Auth, handlers and transports remain forbidden',()=>{
 const config=readFileSync('vite.demo.config.ts','utf8');
 const block=config.slice(config.indexOf('const allowed = new Set(['),config.indexOf('export default defineConfig'));
 const allowed=new Set([...block.matchAll(/'([^']+)'/g)].map(m=>m[1]));
 for(const p of ['src/profile/PhoneEditor.tsx','supabase/functions/_shared/phone.ts'])expect(forbiddenDemoModule('/project/'+p,'/project',allowed)).toBeNull();
 for(const p of ['src/auth/sessionManager.ts','src/auth/api.ts','src/auth/profileAdapter.ts','supabase/functions/accounts/handler.ts','supabase/functions/_shared/phone-extra.ts'])expect(forbiddenDemoModule('/project/'+p,'/project',allowed)).toBe(p);
});
