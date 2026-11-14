import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
export const MAIN='134c52b1aee0d0804cc0cf71f151f95040e7a38f';
export const APPROVED='a82397b130ca2296511247e848139edb79308a87';
// Owner-requested Stage 1 review: only these two controllers and their two new
// dependencies use this immutable source. Visual files/other runtime keep prior approvals.
export const LINEUP_STAGE1='b30908e15cedff6ffa1a4ca76f0fb514e04302a7';
// Additive backend approval: exactly one new migration and the reviewed API route.
export const LINEUPS_STAGE2A='b46b7b91796b96acfc809799e09a5a6898b99342';
// Exact Stage2B implementation submitted for owner review. No visual/hash or
// general routing exemptions; every byte of these four sources is checked.
export const LINEUPS_STAGE2B='f47cd80ad49aa6df0faf0dcb04093f2fa1adfbcd';
export const LINEUPS_MIGRATION='app/supabase/migrations/20261029140000_match_lineups.sql';
// Owner authorized exact backend activation for discovery Stage2B; no broader exemptions.
export const DISCOVERY_SOURCE='24a59e104bfe80b4d2f41cbd0ad02b58fc546040';
export const DISCOVERY_MIGRATION='app/supabase/migrations/20261030090000_public_match_discovery.sql';
export const DISCOVERY_UI='ae2fd9550b3688f80bfc69d811eb2423743b8329';
// PR31 reviewed controls only; prior discovery/lineup approvals remain unchanged.
export const POLISH_UI='3f181e906dcad95ba570e62d71fb9e666e9836e0';
export const POLISH_ANDROID='f2edf565abd2f3f67a0cc3a28d6c01c5e93806f8';
// Owner-requested RC fixes: exact tested sources only, no manifest/hash expansion.
export const MINIMUM_PHONE_SOURCE='51c980befd6a5f28c3471c89392a8a04672aaf0b';
export const MINIMUM_MIGRATION='app/supabase/migrations/20261102180613_configurable_match_minimum.sql';
export const MINIMUM_PHONE_RUNTIME=new Set(['app/src/demo/EventForm.tsx','app/src/events/PremiumEvents.tsx','app/src/events/usePremiumEvents.ts','app/src/events/premiumContracts.ts','app/src/events/premiumForm.ts','app/src/auth/profileAdapter.ts','app/src/auth/useOwnProfile.ts','app/src/ui/personalProfile.ts','app/src/profile/PremiumIdentityEditor.tsx','app/src/profile/PhoneEditor.tsx','app/supabase/functions/accounts/handler.ts','app/vite.demo.config.ts']);
export const STABILIZATION_SOURCE='589e643de9310bd8c205ce7b1c473a55fe767464';
export const ADMIN_MIGRATION='app/supabase/migrations/20261103190639_group_admin_lineup_writes.sql';
export const STABILIZATION_RUNTIME=new Set(['app/src/auth/useB1Lifecycle.ts','app/supabase/functions/accounts/handler.ts','app/android/app/src/main/java/pl/psuda87/slm/SlmWindowInsets.java', 'app/android/app/src/androidTest/java/pl/psuda87/slm/SlmWindowInsetsTest.java', 'app/android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java', 'app/capacitor.config.ts', 'app/src/auth/B1App.tsx', 'app/src/events/PremiumEvents.tsx', 'app/src/events/PremiumTeams.tsx', 'app/src/events/lineupContracts.ts', 'app/src/events/premiumEvents.css', 'app/src/events/usePremiumEvents.ts', 'app/src/events/usePremiumLineup.ts', 'app/src/groups/PremiumGroups.tsx', 'app/src/groups/useGroups.ts', 'app/src/native/focusVisibility.ts']);
// Owner approval for PR34: exact Auth/build sources only. Historical visual
// hashes remain immutable; AccountScreens has one explicit functional binding.
export const AUTH_WEB_SOURCE='36ed569b62bb6861640d2f64c10ed12038c4b15a';
export const AUTH_WEB_MIGRATION='app/supabase/migrations/20261104090000_accounts_email_ui.sql';
export const AUTH_WEB_PRESENTATION='app/src/account-ui/AccountScreens.tsx';
export const AUTH_WEB_FILES=new Set([
 '.gitignore',
 'app/package.json',
 'app/scripts/build-premium-web.mjs',
 'app/scripts/check-premium-web-cases.mjs',
 'app/scripts/test-premium-email-browser.py',
 'app/src/account-ui/AccountScreens.tsx',
 'app/src/auth/B1App.test.tsx',
 'app/src/auth/B1App.tsx',
 'app/src/auth/B1Email.test.tsx',
 'app/src/auth/b1Port.ts',
 'app/src/auth/emailCallback.test.ts',
 'app/src/auth/emailCallback.ts',
 'app/src/auth/emailPort.test.ts',
 'app/src/auth/sessionManager.ts',
 'app/src/auth/uiAdapter.ts',
 'app/src/auth/useB1Lifecycle.ts',
 'app/supabase/functions/accounts/emailFlows.test.ts',
 'app/supabase/functions/accounts/emailFlows.ts',
 'app/supabase/functions/accounts/emailHook.test.ts',
 'app/supabase/functions/accounts/emailHook.ts',
 'app/supabase/functions/accounts/handler.ts',
 'app/supabase/functions/accounts/index.ts',
 'app/supabase/functions/accounts/smtp.test.ts',
 'app/supabase/functions/accounts/smtp.ts',
 'app/supabase/migrations/20261104090000_accounts_email_ui.sql',
 'app/vercel.json',
 ]);
export const PRIVACY_SOURCE='bab1acc209438dca841cdce2795dd6e52dd93e81';
export const PRIVACY_MIGRATION='app/supabase/migrations/20261104183413_account_privacy_lifecycle.sql';
export const PRIVACY_FILES=new Set(["app/cypress/e2e/account-privacy.cy.ts", "app/public/polityka-prywatnosci/index.html", "app/public/regulamin/index.html", "app/scripts/test-account-privacy-local.py", "app/src/auth/profileAdapter.test.tsx", "app/src/auth/profileAdapter.ts", "app/src/auth/useOwnProfile.ts", "app/src/demo/Profile.tsx", "app/src/profile/AccountDeletion.test.tsx", "app/src/profile/PhoneEditor.test.tsx", "app/src/profile/PhoneEditor.tsx", "app/src/ui/personalProfile.ts", "app/supabase/account-privacy-worker.sql", "app/supabase/functions/accounts/accountPrivacy.test.ts", "app/supabase/functions/accounts/accountPrivacy.ts", "app/supabase/functions/accounts/handler.ts", "app/supabase/functions/accounts/privacyHandler.test.ts", "app/supabase/functions/accounts/profilePhotos.test.ts", "app/supabase/functions/accounts/profilePhotos.ts", "app/supabase/migrations/20261104183413_account_privacy_lifecycle.sql", "app/supabase/tests/account_privacy.sql"]);
export const RESUME_SOURCE='2416945ff5dc5994dce35877e52ec401aafc8550';
export const RESUME_FILES=new Set(['app/src/auth/sessionManager.ts','app/src/auth/useB1Lifecycle.ts','app/src/auth/B1App.test.tsx','app/src/auth/sessionResume.test.tsx']);

// Owner approval 2026-11-06: preserve the PR37 baseline and the reviewed seven
// groups fixes. Exact immutable Git objects; no editable hash can approve itself.
export const GROUPS_SOURCE='3596de1';
export const PR37_SOURCE='c27a84f';
export const GROUPS_MIGRATION='app/supabase/migrations/20261106220609_groups_nickname_uniqueness.sql';
export const PAYMENT_MIGRATION='app/supabase/migrations/20261105220005_payment_workflow.sql';
export const GROUPS_FILES=new Set(["app/cypress/e2e/groups-acceptance.cy.ts", "app/scripts/test-groups-nicknames-local.py", "app/src/auth/useOwnProfile.ts", "app/src/demo/GroupScreens.tsx", "app/src/events/PremiumEvents.tsx", "app/src/events/PremiumScrollHeader.tsx", "app/src/groups/GroupControls.css", "app/src/groups/GroupNotifications.test.tsx", "app/src/groups/GroupNotifications.tsx", "app/supabase/functions/accounts/emailFlows.test.ts", "app/supabase/functions/accounts/emailFlows.ts", "app/supabase/functions/accounts/handler.ts", "app/supabase/migrations/20261106220609_groups_nickname_uniqueness.sql", "app/supabase/tests/groups_acceptance.sql", "app/supabase/tests/groups_nicknames.sql"]);
const PR37_FILES=new Set(["app/src/demo/Profile.tsx", "app/src/ui/personalProfile.ts", "app/src/finance/PremiumFinance.tsx", "app/src/finance/premiumFinance.css", "app/src/events/premiumEvents.css", "app/src/auth/useB1Lifecycle.ts", "app/src/auth/B1App.test.tsx", "app/src/auth/nativeResume.test.tsx", "app/supabase/migrations/20261105220005_payment_workflow.sql"]);
// Owner instruction 2026-11-14 ("1 tak"): re-baseline stale pins. Files that legitimately changed after their
// earlier approvals (accepted PR #48-#57, audit fixes, Tito, login wording, withdraw confirm/restore) are pinned to this
// immutable commit. Adding a path here still needs owner review of the change to this file.
export const OWNER_SOURCE='32df99d5c0c41681976a289d22a9eb9534fe9699';
export const OWNER_MIGRATIONS=['app/supabase/migrations/20261110205229_tito_lineups_completion.sql','app/supabase/migrations/20261112230000_guard_pending_manual_payment.sql','app/supabase/migrations/20261114100000_fix_account_deletion_request_receipts.sql','app/supabase/migrations/20261114190000_rating_module.sql'];
export const OWNER_FILES=new Set(["app/scripts/build-premium-web.mjs", "app/scripts/test-premium-email-browser.py", "app/src/account-ui/AccountScreens.tsx", "app/src/auth/B1App.test.tsx", "app/src/auth/B1App.tsx", "app/src/auth/useOwnProfile.ts", "app/src/demo/Profile.tsx", "app/src/events/PremiumEvents.tsx", "app/src/events/PremiumTeams.tsx", "app/src/events/lineupContracts.ts", "app/src/events/premiumContracts.ts", "app/src/events/premiumEvents.css", "app/src/events/usePremiumEvents.ts", "app/src/events/usePremiumLineup.ts", "app/src/groups/GroupControls.css", "app/src/groups/GroupNotifications.tsx", "app/src/groups/PremiumGroups.tsx", "app/src/groups/useGroups.ts", "app/supabase/functions/accounts/handler.ts", "app/supabase/functions/accounts/privacyHandler.test.ts", "app/vercel.json", "app/src/account-ui/Fields.tsx", "app/src/account-ui/model.ts", "app/src/demo/App.tsx", "app/src/demo/Identity.tsx", "app/src/theme/variables.css", "app/src/ui/MatchHero.tsx", "app/src/events/PremiumWorld.tsx", "app/src/finance/PremiumFinance.tsx", "app/src/finance/premiumFinance.css", "app/src/events/LineupPlayerProfile.tsx", "app/src/demo/Teams.tsx", "app/src/ui/UltimatePlayerCard.tsx", "app/src/demo/GroupScreens.tsx", "app/src/ui/MatchTabs.tsx"]);
export const reviewedSource=(path,fallback)=>OWNER_FILES.has(path)?OWNER_SOURCE:GROUPS_FILES.has(path)?GROUPS_SOURCE:PR37_FILES.has(path)?PR37_SOURCE:fallback;

export const authSource=(path,fallback)=>reviewedSource(path,RESUME_FILES.has(path)?RESUME_SOURCE:PRIVACY_FILES.has(path)?PRIVACY_SOURCE:AUTH_WEB_FILES.has(path)?AUTH_WEB_SOURCE:fallback);
const polishUi=new Set(['app/src/events/PremiumEvents.tsx','app/src/events/premiumEvents.css','app/src/events/GuestForm.tsx']);
const discoveryUi=new Set(['app/src/events/PremiumEvents.tsx','app/src/events/usePremiumEvents.ts','app/src/events/premiumContracts.ts']);
const lineupStage1=new Set(['app/src/events/PremiumEvents.tsx','app/src/events/PremiumTeams.tsx','app/src/events/lineupEditor.ts','app/src/events/LineupPlayerProfile.tsx']);
const lineupStage2b=new Set(['app/src/events/PremiumTeams.tsx','app/src/events/lineupEditor.ts','app/src/events/lineupContracts.ts','app/src/events/usePremiumLineup.ts']);
const historyCache=new Map();
const selected=new Set(['app/src/demo/App.tsx','app/src/demo/EventForm.tsx','app/src/demo/GroupScreens.tsx','app/src/demo/Profile.tsx','app/src/demo/Teams.tsx','app/src/ui/MatchHero.tsx']);
const digest=s=>createHash('sha256').update(typeof s==='string'?s.replace(/\r\n/g,'\n'):s).digest('hex');
export function verifyPremiumRuntime(root,overrides={}){
 const read=p=>Object.hasOwn(overrides,p)?overrides[p]:readFileSync(root+'/'+p,'utf8');
 const git=(ref,p)=>{const key=root+ref+p;if(!historyCache.has(key))historyCache.set(key,execFileSync('git',['show',ref+':'+p],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}));return historyCache.get(key);};
 // Do not trust editable hashes as proof of owner approval. Compare to immutable historical Git objects.
 const original=JSON.parse(git(MAIN,'app/scripts/premium318-contract.json'));
 const manifest=JSON.parse(read('app/scripts/premium318-contract.json'));
 assert.deepEqual(Object.keys(manifest.files).sort(),Object.keys(original.files).sort(),'Frozen file list changed without approval');
 const authReview=JSON.parse(git(AUTH_WEB_SOURCE,'docs/review/premium-real-auth-web-manifest.json'));
 assert.deepEqual([...AUTH_WEB_FILES].sort(),authReview.files.map(row=>row.path).sort(),'Approved Auth file set changed');
 for(const path of Object.keys(original.files)){
  const ref=selected.has(path)?APPROVED:MAIN;
  const raw=original.files[path].text?git(ref,path):execFileSync('git',['show',ref+':'+path],{cwd:root,stdio:['ignore','pipe','pipe']});
  const current=original.files[path].text?read(path):Object.hasOwn(overrides,path)?overrides[path]:readFileSync(root+'/'+path);
  const expected=digest(raw);
  assert.equal(manifest.files[path].sha256,expected,'Unapproved contract hash: '+path);
  assert.equal(digest(current),OWNER_FILES.has(path)||GROUPS_FILES.has(path)||PR37_FILES.has(path)?digest(git(reviewedSource(path,null),path)):path==='app/src/demo/Profile.tsx'?digest(git(reviewedSource(path,PRIVACY_SOURCE),path)):path===AUTH_WEB_PRESENTATION?digest(git(reviewedSource(path,authSource(path,AUTH_WEB_SOURCE)),path)):path==='app/src/demo/EventForm.tsx'?digest(git(reviewedSource(path,MINIMUM_PHONE_SOURCE),path)):expected,'Unapproved visual source: '+path);
 }
 assert.deepEqual([...PRIVACY_FILES].sort(),JSON.parse(git(PRIVACY_SOURCE,'docs/review/account-privacy-manifest.json')).files.map(r=>r.path).sort(),'Approved privacy inventory changed');
 assert.deepEqual([...RESUME_FILES].sort(),execFileSync('git',['diff-tree','--no-commit-id','--name-only','-r',RESUME_SOURCE,'--','app'],{cwd:root,encoding:'utf8'}).trim().split('\n').sort(),'Approved resume inventory changed');
 assert.deepEqual([...GROUPS_FILES].sort(),execFileSync('git',['diff','--name-only',PR37_SOURCE+'..'+GROUPS_SOURCE,'--','app'],{cwd:root,encoding:'utf8'}).trim().split('\n').sort(),'Reviewed groups inventory changed');
 for(const path of GROUPS_FILES)assert.equal(digest(read(path)),digest(git(reviewedSource(path,GROUPS_SOURCE),path)),'Unreviewed groups acceptance source: '+path);
 for(const p of OWNER_MIGRATIONS)assert.equal(digest(read(p)),digest(git(OWNER_SOURCE,p)),'Unreviewed owner-approved migration: '+p);
 assert.equal(digest(read(PAYMENT_MIGRATION)),digest(git(PR37_SOURCE,PAYMENT_MIGRATION)),'Unreviewed existing payment migration');
 for(const path of RESUME_FILES)assert.equal(digest(read(path)),digest(git(reviewedSource(path,RESUME_SOURCE),path)),'Unreviewed resume source: '+path);
 for(const path of PRIVACY_FILES)assert.equal(digest(read(path)),digest(git(reviewedSource(path,PRIVACY_SOURCE),path)),'Unreviewed privacy source: '+path);
 // Newly approved files are pinned to fixed Git objects, including tests/build/CSP.
 for(const path of AUTH_WEB_FILES)assert.equal(digest(read(path)),digest(git(reviewedSource(path,authSource(path,AUTH_WEB_SOURCE)),path)),'Unreviewed real Auth source: '+path);
 // The historical minimum control keeps exactly its prior field exception.
 const form=git(MINIMUM_PHONE_SOURCE,'app/src/demo/EventForm.tsx');
 assert.equal(form.replace("{field('minimum','Minimum zawodników','number',{min:1,max:100,step:1})}","{live?<p>Minimum zawodników: 10</p>:field('minimum','Minimum zawodników','number',{min:1,step:1})}"),git(APPROVED,'app/src/demo/EventForm.tsx'),'Minimum form exception exceeded its exact field');
 const mainSteps=execFileSync('git',['ls-tree','-r','--name-only',MAIN,'--','app/supabase/migrations'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 const added=['20261028174603_premium_match_membership_visibility.sql','20261028174920_premium_member_creation_finance_guard.sql','20261028175508_premium_match_feed_filters.sql','20261028181054_premium_group_admin_only_finance.sql'].map(n=>'app/supabase/migrations/'+n);
 assert.deepEqual(readdirSync(root+'/app/supabase/migrations').filter(n=>n.endsWith('.sql')).sort(),[...mainSteps,...added,'app/supabase/migrations/20261028204500_restore_pr16_match_name_projection.sql',LINEUPS_MIGRATION,DISCOVERY_MIGRATION,MINIMUM_MIGRATION,ADMIN_MIGRATION,AUTH_WEB_MIGRATION,PRIVACY_MIGRATION,PAYMENT_MIGRATION,GROUPS_MIGRATION,...OWNER_MIGRATIONS].map(p=>p.split('/').at(-1)).sort(),'Unexpected migration/model activation');
 for(const p of [...mainSteps,...added])assert.equal(digest(read(p)),digest(git(added.includes(p)?APPROVED:MAIN,p)),'Historical migration overwritten: '+p);
 assert.equal(digest(read(LINEUPS_MIGRATION)),digest(git(LINEUPS_STAGE2A,LINEUPS_MIGRATION)),'Unreviewed Stage 2A backend source: '+LINEUPS_MIGRATION);
 for(const p of [DISCOVERY_MIGRATION,'app/supabase/functions/accounts/handler.ts',MINIMUM_MIGRATION])
  assert.equal(digest(read(p)),digest(git(authSource(p,STABILIZATION_RUNTIME.has(p)?STABILIZATION_SOURCE:p===DISCOVERY_MIGRATION?DISCOVERY_SOURCE:MINIMUM_PHONE_SOURCE),p)),'Unreviewed discovery backend source: '+p);
 assert.equal(digest(read(ADMIN_MIGRATION)),digest(git(STABILIZATION_SOURCE,ADMIN_MIGRATION)),'Unreviewed admin44 migration');
 for(const p of STABILIZATION_RUNTIME)assert.equal(digest(read(p)),digest(git(authSource(p,STABILIZATION_SOURCE),p)),'Unreviewed POCO stabilization source: '+p);
 for(const p of MINIMUM_PHONE_RUNTIME)assert.equal(digest(read(p)),digest(git(authSource(p,STABILIZATION_RUNTIME.has(p)?STABILIZATION_SOURCE:MINIMUM_PHONE_SOURCE),p)),'Unreviewed minimum/phone runtime: '+p);
 assert.equal(digest(read('app/src/auth/tokenStore.ts')),digest(git(APPROVED,'app/src/auth/tokenStore.ts')),'Secure vault namespace changed');
 const bindings={
  'app/src/events/PremiumWorld.tsx':['../demo/App','./PremiumEvents','./usePremiumEvents'],
  'app/src/events/PremiumEvents.tsx':['../ui/MatchHero','../ui/MatchTabs','./PremiumTeams','../finance/PremiumFinance','./PremiumScrollHeader','./GuestForm'],
  'app/src/events/GuestForm.tsx':['react','../../supabase/functions/_shared/phone'],
  'app/src/profile/PremiumIdentityEditor.tsx':['./PhoneEditor'],
  'app/src/profile/PhoneEditor.tsx':['react','../../supabase/functions/_shared/phone'],
  'app/src/events/PremiumTeams.tsx':['../ui/PremiumPitch','./lineupEditor','./LineupPlayerProfile','./usePremiumLineup'],
  'app/src/events/usePremiumLineup.ts':['../auth/api','./lineupEditor','./lineupContracts'],
  'app/src/events/lineupContracts.ts':['../auth/api','./premiumContracts','./lineupEditor'],
  'app/src/events/LineupPlayerProfile.tsx':['../groups/contracts','../ui/UltimatePlayerCard'],
  'app/src/auth/B1App.tsx':['../events/PremiumWorld','../native/focusVisibility'],
  'app/android-stage3/main.tsx':['../src/auth/B1App'],
  'app/b1/main.tsx':['../src/auth/B1App'],
  'app/src/main.tsx':['./App'],
 };
 for(const [path,imports] of Object.entries(bindings)){
  const ast=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const actual=ast.statements.filter(ts.isImportDeclaration).map(i=>i.moduleSpecifier.text);
  for(const target of imports)assert(actual.includes(target),'Entry/import routing regression: '+path+' -> '+target);
 }
 // These reviewed controllers are part of the approved runtime, not spare files next to a replacement.
 for(const path of ['app/src/events/PremiumWorld.tsx','app/src/events/PremiumEvents.tsx','app/src/events/PremiumTeams.tsx','app/src/events/PremiumScrollHeader.tsx','app/src/ui/PremiumPitch.tsx','app/src/finance/PremiumFinance.tsx','app/src/finance/premiumFinance.css','app/src/events/premiumEvents.css','app/src/events/lineupEditor.ts','app/src/events/LineupPlayerProfile.tsx','app/src/events/lineupContracts.ts','app/src/events/usePremiumLineup.ts'])
  assert.equal(digest(read(path)),digest(git(reviewedSource(path,STABILIZATION_RUNTIME.has(path)?STABILIZATION_SOURCE:MINIMUM_PHONE_RUNTIME.has(path)?MINIMUM_PHONE_SOURCE:polishUi.has(path)?POLISH_UI:discoveryUi.has(path)?DISCOVERY_UI:lineupStage2b.has(path)?LINEUPS_STAGE2B:lineupStage1.has(path)?LINEUP_STAGE1:APPROVED),path)),'Approved runtime replaced/condition changed: '+path);
 for(const path of discoveryUi)assert.equal(digest(read(path)),digest(git(reviewedSource(path,STABILIZATION_RUNTIME.has(path)?STABILIZATION_SOURCE:MINIMUM_PHONE_RUNTIME.has(path)?MINIMUM_PHONE_SOURCE:polishUi.has(path)?POLISH_UI:DISCOVERY_UI),path)),'Unreviewed discovery UI: '+path);
 for(const path of polishUi)assert.equal(digest(read(path)),digest(git(reviewedSource(path,STABILIZATION_RUNTIME.has(path)?STABILIZATION_SOURCE:MINIMUM_PHONE_RUNTIME.has(path)?MINIMUM_PHONE_SOURCE:POLISH_UI),path)),'Unreviewed PR31 control: '+path);
 for(const path of ['app/android/app/src/main/java/pl/psuda87/slm/MainActivity.java','app/android/app/src/main/java/pl/psuda87/slm/SlmWindowInsets.java','app/android/app/src/androidTest/java/pl/psuda87/slm/SlmWindowInsetsTest.java'])
  assert.equal(digest(read(path)),digest(git(reviewedSource(path,STABILIZATION_RUNTIME.has(path)?STABILIZATION_SOURCE:POLISH_ANDROID),path)),'Unreviewed PR31 native source: '+path);
 assert.equal(digest(read('app/src/groups/PremiumGroups.tsx')),digest(git(reviewedSource('app/src/groups/PremiumGroups.tsx',STABILIZATION_SOURCE),'app/src/groups/PremiumGroups.tsx')),'Group UI wrapper replaced');
 const old=git(MAIN,'app/src/auth/B1App.tsx');
 const expected=old.replace("import WorldApp from '../demo/App';","import WorldApp from '../events/PremiumWorld';").replace("<WorldApp key={owner??'none'}","<WorldApp key={owner??'none'} manager={manager} userId={owner??''}");
 assert.equal(digest(git('94efc95b65476fa4102006a25b9d5b3b1e126b5c','app/src/auth/B1App.tsx')),digest(expected),'Historical gate approval changed');
 assert.equal(digest(read('app/src/auth/B1App.tsx')),digest(git(reviewedSource('app/src/auth/B1App.tsx',AUTH_WEB_SOURCE),'app/src/auth/B1App.tsx')),'Auth/Premium gate adapter changed without review');
 assert.equal(digest(read('app/src/App.tsx')),digest(git(MAIN,'app/src/App.tsx')),'Default LIVE routing changed without owner decision');
 assert.match(read('app/index.html'),/src=\"\/src\/main\.tsx\"/,'Default HTML entry changed');
 assert.match(read('app/android-stage3/index.html'),/src=\"\.\/main\.tsx\"/,'Android HTML entry changed');
 assert.match(read('app/b1/index.html'),/src=\"\.\/main\.tsx\"/,'Premium HTML entry changed');
 for(const path of ['app/capacitor.config.ts','app/vite.android-stage3.config.ts','app/vite.premium-finance-local.config.ts','app/android-stage3/index.html'])
  assert.equal(digest(read(path)),digest(git(reviewedSource(path,STABILIZATION_RUNTIME.has(path)?STABILIZATION_SOURCE:APPROVED),path)),'Build/entry configuration changed: '+path);
 for(const path of ['app/vite.config.ts','app/vite.b1.config.ts','app/vite.live-local.config.ts','app/index.html','app/b1/index.html','app/b1/main.tsx','app/src/main.tsx'])
  assert.equal(digest(read(path)),digest(git(reviewedSource(path,MAIN),path)),'Existing entry configuration changed: '+path);
 const android=git(APPROVED,'app/android-stage3/main.tsx').replace(' accountModel={false}','');
 assert.equal(digest(read('app/android-stage3/main.tsx')),digest(android),'Android render condition changed');
 const configs=readdirSync(root+'/app').filter(p=>/^vite\..*config\.ts$/.test(p)).sort();
 assert.deepEqual(configs,['vite.config.ts','vite.b1.config.ts','vite.demo.config.ts','vite.live-local.config.ts','vite.premium-finance-local.config.ts','vite.android-stage3.config.ts','vite.stabilization.config.ts'].sort(),'Unreviewed alternative Vite entry');
 const pkg=JSON.parse(read('app/package.json')),baseline=JSON.parse(git(MAIN,'app/package.json'));
 for(const [key,value] of Object.entries(baseline.scripts).filter(([key])=>key.startsWith('build')))
  assert.equal(pkg.scripts[key],value,'Existing build command changed: '+key);
 assert.deepEqual(Object.keys(pkg.scripts).filter(k=>k.startsWith('build')).sort(),[...Object.keys(baseline.scripts).filter(k=>k.startsWith('build')),'build:android-stage3','build:premium-finance-local','build:premium-web'].sort(),'Unreviewed build entry command');
 for(const name of ['prebuild','postbuild','preinstall','postinstall','prepare'])assert(!pkg.scripts[name],'Unexpected lifecycle entry: '+name);
 for(const [key,config] of [['build:android-stage3','vite.android-stage3.config.ts'],['build:premium-finance-local','vite.premium-finance-local.config.ts']])
  assert.equal(pkg.scripts[key],'tsc --noEmit && vite build --config '+config,'Reviewed build bypassed');
 for(const path of ['app/src/auth/emailProof.ts','app/src/auth/onlineClient.ts','app/supabase/migrations/20261026225907_account_model_candidate.sql'])
  assert(!existsSync(root+'/'+path),'Unapproved account candidate entered consolidation: '+path);
 return {frozen:Object.keys(original.files).length,bindings:Object.keys(bindings).length};
}
