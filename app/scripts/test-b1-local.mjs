// B1 only. One new isolated fictional Auth fixture retained; no deletion/reset/migrations.
import { randomUUID,randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { assertBranch,assertSafeConfig,management,server } from './b1-admin-local.mjs';
assertBranch();assertSafeConfig(await management('/config/auth'));
const admin=await server();
const password=randomBytes(24).toString('base64url')+'Aa7!';
const email=randomUUID()+'@slm.invalid',login='b1_'+randomUUID().slice(0,8);
const phone='+4800000'+String(Math.floor(Math.random()*10000)).padStart(4,'0');
const user=await admin.request('/auth/v1/admin/users','POST',{email,password,email_confirm:true});assert(user.ok,'Create own fictional fixture');
const provision=await admin.request('/rest/v1/rpc/slm_account_provision','POST',{p_user:user.data.id,p_login:login,p_phone:phone,p_email:email,p_admin:false});assert(provision.ok,'Provision own fixture');
const vite=await createServer({configFile:'vite.b1.config.ts',root:process.cwd(),server:{middlewareMode:true}});
try {
 const {SessionManager}=await vite.ssrLoadModule('/src/auth/sessionManager.ts');
 const {accountRequest}=await vite.ssrLoadModule('/src/auth/api.ts');
 const {b1Port}=await vite.ssrLoadModule('/src/auth/b1Port.ts');
 let token=null;const disk={read:async()=>token,write:async value=>{token=value;},clear:async()=>{token=null;}};
 let manager=new SessionManager(disk,accountRequest),port=b1Port(manager);
 await assert.rejects(port.signIn(login,'Incorrect-test-password'));assert.equal(manager.getSnapshot().phase,'signed_out');console.log('PASS local invalid credentials');
 await port.signIn(login,password);assert(manager.getSnapshot().session.must_change_password);console.log('PASS local alias login and temporary-password gate');
 const permanent=randomBytes(24).toString('base64url')+'Aa7!';
 await port.updatePassword(permanent,password);assert.equal(manager.getSnapshot().session.must_change_password,false);console.log('PASS local password change and fresh verified session');
 manager=new SessionManager(disk,accountRequest);port=b1Port(manager);await port.restoreSession();assert.equal(manager.getSnapshot().phase,'ready');console.log('PASS local restart with stored refresh and server validation');
 const revoked=token;await port.signOut();assert.equal(token,null);assert.equal(manager.getSnapshot().phase,'signed_out');
 const expired=new SessionManager({read:async()=>revoked,write:async()=>{},clear:async()=>{}},accountRequest);await expired.refresh();assert.equal(expired.getSnapshot().phase,'signed_out');console.log('PASS local logout and revoked refresh rejected');
 await port.signIn(phone,permanent);assert.equal(manager.getSnapshot().session.user_id,user.data.id);await port.signOut();console.log('PASS local phone login and final logout');
 console.log('B1 local test complete; one newly created fictional account retained, existing accounts unchanged; no secrets printed');
} finally {await vite.close();}
