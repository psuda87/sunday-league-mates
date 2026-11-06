import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyPremiumRuntime,APPROVED,LINEUPS_MIGRATION,DISCOVERY_MIGRATION,MINIMUM_MIGRATION,ADMIN_MIGRATION,AUTH_WEB_MIGRATION,AUTH_WEB_FILES,PRIVACY_FILES,RESUME_FILES} from './premium-route-policy.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>readFileSync(root+'/'+p,'utf8');
test('actual source graph passes',()=>assert.equal(verifyPremiumRuntime(root).frozen,55));
for(const [label,path,mutate] of [
 ['B1 bypasses live wrapper','app/src/auth/B1App.tsx',s=>s.replace('../events/PremiumWorld','../demo/App')],
 ['world replaces event slot','app/src/events/PremiumWorld.tsx',s=>s.replace('eventsView=','unusedView=')],
 ['details replaces original pitch','app/src/events/PremiumTeams.tsx',s=>s.replace('../ui/PremiumPitch','../ui/MatchSections')],
 ['Stage 1 event profile binding reverted','app/src/events/PremiumEvents.tsx',()=>execFileSync('git',['show',APPROVED+':app/src/events/PremiumEvents.tsx'],{cwd:root,encoding:'utf8'})],
 ['Stage 1 editor reverted','app/src/events/PremiumTeams.tsx',()=>execFileSync('git',['show',APPROVED+':app/src/events/PremiumTeams.tsx'],{cwd:root,encoding:'utf8'})],
 ['lineup ignores dirty comparison','app/src/events/lineupEditor.ts',s=>s.replace('.some(id => baseline[id] !== draft[id])','.some(() => false)')],
 ['restore loses baseline','app/src/events/lineupEditor.ts',s=>s.replace('draft: {...state.restorePoint}','draft: {}')],
 ['fake server save enabled','app/src/events/PremiumTeams.tsx',s=>s.replace('disabled={!writable || !dirty} aria-describedby={saveLimit}','disabled={false} aria-describedby={saveLimit}')],
 ['lineup decoder replaced','app/src/events/lineupContracts.ts',()=>"export const lineupPair=()=>({});"],
 ['lineup read disconnected','app/src/events/usePremiumLineup.ts',s=>s.replace("manager.call('lineups_get'","manager.call('status'")],
 ['lineup write disconnected','app/src/events/usePremiumLineup.ts',s=>s.replace("manager!.call('lineups_save'","manager!.call('status'")],
 ['lineup retry loses original UUID','app/src/events/usePremiumLineup.ts',s=>s.replace('s.intent?.body ??','undefined ??')],
 ['lineup recheck discards draft','app/src/events/usePremiumLineup.ts',s=>s.replace('editLineup(old.editor,','editLineup(emptyLineup(eventId),')],
 ['lineup logout retains private RAM','app/src/events/usePremiumLineup.ts',s=>s.replace('rows.clear()','rows.size')],
 ['lineup actor guard removed','app/src/events/usePremiumLineup.ts',s=>s.replace('c.auth.session?.user_id === userId','true')],
 ['lineup save drops roster token','app/src/events/usePremiumLineup.ts',s=>s.replace('expected_roster_version: s.snapshot.roster_version',"expected_roster_version: '0'.repeat(64)")],
 ['profile allows foreign identity','app/src/events/LineupPlayerProfile.tsx',s=>s.replace('if (p.user_id !== memberId)','if (false)')],
 ['profile adapter replaced','app/src/events/LineupPlayerProfile.tsx',()=>"export default function Profile(){return null;}"],
 ['original pitch geometry changed','app/src/ui/PremiumPitch.tsx',s=>s.replace('M4 80H96','M4 90H96')],
 ['BottomNav restyled','app/src/demo/DemoBottomNav.tsx',s=>s.replace('slm-demo-nav-notch','slm-demo-nav-notch-altered')],
 ['Ultimate component replaced','app/src/ui/UltimatePlayerCard.tsx',()=>"export default function Card(){return null;}"],
 ['discovery debounce removed','app/src/events/usePremiumEvents.ts',s=>s.replace('},300);','},0);')],
 ['discovery version ignored','app/src/events/premiumContracts.ts',s=>s.replace('r.public_discovery_version===1','true')],
 ['discovery field always shown','app/src/events/PremiumEvents.tsx',s=>s.replace("data.activeGroup==='public'&&",'true&&')],
 ['discovery privilege elevated',DISCOVERY_MIGRATION,s=>s.replace('security invoker','security definer')],
 ['discovery search filter disabled',DISCOVERY_MIGRATION,s=>s.replace("v_query='' or (e.visibility='public' and","true or (e.visibility='public' and")],
 ['discovery ACL exposed',DISCOVERY_MIGRATION,s=>s.replace('to service_role;','to authenticated,service_role;')],
 ['discovery actor forged','app/supabase/functions/accounts/handler.ts',s=>s.replace('p_user: ctx.id, p_session: ctx.sid, p_action: action.slice(prefix.length)','p_user: body.user_id, p_session: ctx.sid, p_action: action.slice(prefix.length)')],
 ['discovery version gate removed','app/supabase/functions/accounts/handler.ts',s=>s.replace("action === 'matches_list' && (Object.hasOwn(payload, 'query')","false && (Object.hasOwn(payload, 'query')")],
 ['lineup table RLS disabled',LINEUPS_MIGRATION,s=>s.replace('enable row level security','disable row level security')],
 ['lineup service RPC exposed',LINEUPS_MIGRATION,s=>s.replace('to service_role;','to authenticated,service_role;')],
 ['lineup no-op always writes',LINEUPS_MIGRATION,s=>s.replace('if changed then','if true then')],
 ['lineup CAS removed',LINEUPS_MIGRATION,s=>s.replace("raise exception 'lineup_version_conflict';",'null;')],
 ['lineup scope check removed',LINEUPS_MIGRATION,s=>s.replace('group_id=e.group_id and user_id=p_user','group_id=e.group_id')],
 ['lineup API author forged','app/supabase/functions/accounts/handler.ts',s=>s.replace('p_user:ctx.id,p_session:ctx.sid,p_action:action.slice(8)','p_user:body.user_id,p_session:ctx.sid,p_action:action.slice(8)')],
 ['cards replaced in rendering','app/src/events/PremiumEvents.tsx',s=>s.replace('<MatchHero minimum={m.minimum_players} compact','<section minimum={m.minimum_players} compact')],
 ['Android HTML uses a different entry','app/android-stage3/index.html',s=>s.replace('./main.tsx','../demo/main.tsx')],
 ['main switches to demo','app/src/App.tsx',()=>"export {default} from './ui/Demo';"],
 ['contract hash self-approval','app/scripts/premium318-contract.json',s=>{const j=JSON.parse(s);j.files['app/src/ui/UltimatePlayerCard.tsx'].sha256='0'.repeat(64);return JSON.stringify(j);}],
 ['Capacitor uses a hidden replacement','app/capacitor.config.ts',s=>s.replace('webDir:',"webDir: true ? 'dist-demo' :")],
 ['Vite redirects Premium entry','app/vite.b1.config.ts',s=>s.replace("'./b1'","'./demo'")],
 ['build script bypass','app/package.json',s=>{const j=JSON.parse(s);j.scripts.build='vite build --config other.ts';return JSON.stringify(j);}],
 ['alternate build alias','app/package.json',s=>{const j=JSON.parse(s);j.scripts['build:evil']='vite other';return JSON.stringify(j);}],
 ['guest normalization removed','app/src/events/GuestForm.tsx',s=>s.replace('normalizePolishPhone(phone)','phone')],
 ['guest duplicate guard removed','app/src/events/GuestForm.tsx',s=>s.replace('disabled||flight.current','disabled')],
 ['guest financial copy changed','app/src/events/GuestForm.tsx',s=>s.replace('finansowo','automatycznie')],
 ['guest import redirected','app/src/events/PremiumEvents.tsx',s=>s.replace("'./GuestForm'","'../demo/GuestForm'")],
 ['control CSS escapes scope','app/src/events/premiumEvents.css',s=>s.replace('.slm-guest-form input','input')],
 ['native inset installation removed','app/android/app/src/main/java/pl/psuda87/slm/MainActivity.java',s=>s.replace('SlmWindowInsets.install(getWindow());','')],
 ['native padding accumulates','app/android/app/src/main/java/pl/psuda87/slm/SlmWindowInsets.java',s=>s.replace('bars.top, bars.right','bars.top + view.getPaddingTop(), bars.right')],
 ['native assertions weakened','app/android/app/src/androidTest/java/pl/psuda87/slm/SlmWindowInsetsTest.java',s=>s.replace('assertNotNull(actual);','')],
 ['frozen list shrinks','app/scripts/premium318-contract.json',s=>{const j=JSON.parse(s);delete j.files['app/src/ui/UltimatePlayerCard.tsx'];return JSON.stringify(j);}],
 ['minimum migration altered',MINIMUM_MIGRATION,s=>s.replace('v_count<e.minimum_players','v_count<10')],
 ['minimum control disabled','app/src/demo/EventForm.tsx',s=>s.replace("{min:1,max:100,step:1}","{min:10,max:10,step:1}")],
 ['minimum API payload ignored','app/src/events/usePremiumEvents.ts',s=>s.replace('minimum_players:input.minimum','minimum_players:10')],
 ['minimum contract accepts zero','app/src/events/premiumContracts.ts',s=>s.replace('Number(r.minimum_players)<1','Number(r.minimum_players)<0')],
 ['phone uses unverified session mutation','app/src/auth/profileAdapter.ts',s=>s.replace("manager.changeSession('identifiers'","manager.call('identifiers'")],
 ['phone password printed as text','app/src/profile/PhoneEditor.tsx',s=>s.replace('type="password"','type="text"')],
 ['phone pending guard removed','app/src/profile/PhoneEditor.tsx',s=>s.replace('if(flight.current||binding.saving)return','if(binding.saving)return')],
 ['phone expands demo to Auth','app/vite.demo.config.ts',s=>s.replace("'src/profile/PhoneEditor.tsx'","'src/auth/sessionManager.ts'")],
 ['admin44 authorization removed',ADMIN_MIGRATION,s=>s.replace("p_action='save' and not exists","false and not exists")],
 ['resume shows stale screen','app/src/auth/B1App.tsx',s=>s.replace('hidden={view!==null}','hidden={false}')],
 ['resume retains denied account','app/src/auth/B1App.tsx',s=>s.replace('continuation.current=null','continuation.current="old"')],
 ['IME gets two inset owners','app/capacitor.config.ts',s=>s.replace("insetsHandling: 'disable'","insetsHandling: 'css'")],
 ['focus helper replaced','app/src/native/focusVisibility.ts',s=>s+'\n// unauthorized input handler\n'],
 ['member writes local draft','app/src/events/usePremiumLineup.ts',s=>s.replace('state.snapshot?.can_write === true','true')],
 ['responsive confirmation removed','app/src/events/premiumEvents.css',s=>s.replace('display:flex;flex-wrap:wrap;gap:8px','display:flex;flex-wrap:nowrap;gap:8px')],
 ['event edit overwrites a resumed version','app/src/events/PremiumEvents.tsx',s=>s.replace('editVersion.current!==e?.version','false')],
 ['logout permits foreground refresh','app/src/auth/useB1Lifecycle.ts',s=>s.replace("mayResume()&&manager.getSnapshot()","true&&manager.getSnapshot()")],
 ['raw cutout forwarded twice','app/android/app/src/main/java/pl/psuda87/slm/SlmWindowInsets.java',s=>s.replace('.setDisplayCutout(null)','')],
 ['email operation accepts a session','app/src/auth/sessionManager.ts',s=>s.replace("'access_token' in result","false")],
 ['recovery actor forged','app/supabase/functions/accounts/emailFlows.ts',s=>s.replace('p_actor:user.id','p_actor:body.user_id')],
 ['email proof check redirected','app/supabase/functions/accounts/emailFlows.ts',s=>s.replace("'/auth/v1/verify'","'/auth/v1/user'")],
 ['mail signature removed','app/supabase/functions/accounts/emailHook.ts',s=>s.replace('if(!await bounded(()=>signature','if(false&&!await bounded(()=>signature')],
 ['SMTP TLS replaced','app/supabase/functions/accounts/index.ts',s=>s.replace('Deno.connectTls(options)','Deno.connect(options)')],
 ['Premium web builds demo','app/scripts/build-premium-web.mjs',s=>s.replace("cwd+'vite.b1.config.ts'","cwd+'vite.demo.config.ts'")],
 ['Vercel CSP allows every destination','app/vercel.json',s=>s.replace("connect-src 'self' https://hjtcyybkxebvdropchac.supabase.co","connect-src *")],
 ['email helper exposed to clients',AUTH_WEB_MIGRATION,s=>s.replace('to service_role;','to authenticated,service_role;')],
 ['email recovery loses version check',AUTH_WEB_MIGRATION,s=>s.replace('s.security_version is distinct from p_version','false')],
 ['account appearance changed','app/src/account-ui/AccountScreens.tsx',s=>s.replace('slm-account-panel','slm-account-unsafe')],
])test('rejects '+label,()=>{verifyPremiumRuntime(root);const source=read(path),changed=mutate(source);assert.notEqual(changed,source,'Mutation must exercise a real source change');assert.throws(()=>verifyPremiumRuntime(root,{[path]:changed}));});
test('cannot remove an approved Auth source from the exact inventory',()=>{
 const path='app/src/auth/emailCallback.ts';
 assert(AUTH_WEB_FILES.has(path));AUTH_WEB_FILES.delete(path);
 try{assert.throws(()=>verifyPremiumRuntime(root),/Approved Auth file set changed/);}
 finally{AUTH_WEB_FILES.add(path);}
 verifyPremiumRuntime(root);
});

for(const path of ['app/src/profile/PhoneEditor.tsx','app/supabase/functions/accounts/accountPrivacy.ts','app/supabase/functions/accounts/profilePhotos.ts','app/supabase/account-privacy-worker.sql','app/supabase/migrations/20261104183413_account_privacy_lifecycle.sql','app/src/auth/sessionManager.ts','app/src/auth/useB1Lifecycle.ts'])test('rejects changed approved privacy/resume source '+path,()=>{
 assert.throws(()=>verifyPremiumRuntime(root,{[path]:read(path)+'\n// unauthorized change\n'}));
});
for(const [name,inventory,path] of [['privacy',PRIVACY_FILES,'app/src/profile/PhoneEditor.tsx'],['resume',RESUME_FILES,'app/src/auth/sessionManager.ts']])test('cannot remove approved '+name+' inventory entry',()=>{
 inventory.delete(path);try{assert.throws(()=>verifyPremiumRuntime(root),/inventory changed/);}finally{inventory.add(path);}
});
