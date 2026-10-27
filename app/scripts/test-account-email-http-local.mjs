// Real Supabase SMTP/HTTP/browser checks; all fixtures retained.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {own,check,signup,mail,proof,yes,account,rpc,request,keys,addr,password,tag,browser,count} from './account-email-test-support.mjs';
const before=await request('/rest/v1/slm_account_model_state',undefined,undefined,undefined,'GET');if(!before.data[0].active)assert((await rpc('slm_model_prepare')).ok,'Prepare only this isolated mail test project');
const a=await signup('Mail_'+tag);const emailA=addr('first');const wrong=await account(a,'model_email_request',{email:emailA,current_password:'WrongOnlyTest9!',request_id:randomUUID()});check(wrong.status===401,'wrong current password never issues email proof');
const send=(u,email)=>yes(u,'model_email_request',{email,current_password:u.password,request_id:randomUUID()});
await send(a,emailA);check((await account(null,'login',{identifier:emailA,password:a.password})).status===401,'unconfirmed alias cannot log in');
let m=await mail(emailA);check(m.msg.To.some(x=>x.Address===emailA),'actual SMTP message addressed to optional alias');
await browser(m.link,'verify');check(true,'delivered link opened and confirmed in real browser');
check((await yes(null,'login',{identifier:emailA,password:a.password})).user_id===a.id,'verified alias logs in to original UUID');
check((await own(a)).email_login===emailA,'owner profile reads verified personal email, not technical address');
check((await account(null,'model_email_confirm',proof(m.link))).ok,'confirmation retry is idempotent');
const oldLink=m.link,emailB=addr('changed');await send(a,emailB);m=await mail(emailB);check((await yes(null,'login',{identifier:emailA,password:a.password})).user_id===a.id,'old email remains usable before new address verified');
await yes(null,'model_email_confirm',proof(m.link));check((await account(null,'login',{identifier:emailA,password:a.password})).status===401&&(await yes(null,'login',{identifier:emailB,password:a.password})).user_id===a.id,'email change retires old alias without changing UUID');
check((await account(null,'model_email_confirm',proof(oldLink))).status===410,'old confirmation link cannot revert changed email');
const emailC=addr('resend');await send(a,emailC);const firstC=await mail(emailC);await send(a,emailC);check((await own(a)).email_pending?.target_email===emailC,'immediate resend is cooldown-safe');
async function age(link,expired=false){const t=proof(link);const r=await request('/rest/v1/slm_email_links?id=eq.'+t.id,{created_at:new Date(Date.now()-120000).toISOString(),...(expired?{expires_at:new Date(Date.now()-1000).toISOString()}:{})},undefined,undefined,'PATCH');assert(r.ok,'Only own test link ageing');}
await age(firstC.link);await send(a,emailC);const secondC=await mail(emailC,new Set([firstC.id]));check((await account(null,'model_email_confirm',proof(firstC.link))).status===410,'resend invalidates previous confirmation link');await yes(null,'model_email_confirm',proof(secondC.link));
const emailD=addr('expired');await send(a,emailD);m=await mail(emailD);await age(m.link,true);check((await account(null,'model_email_confirm',proof(m.link))).status===410&&(await own(a)).email_login===emailC,'expired link leaves existing verified email unchanged');
const xEmail=addr('signup'),x=await signup('Optional_'+tag,xEmail);m=await mail(xEmail);check((await account(null,'login',{identifier:xEmail,password:x.password})).status===401,'email entered at registration is not auto-confirmed');await yes(null,'model_email_confirm',proof(m.link));check((await yes(null,'login',{identifier:xEmail,password:x.password})).user_id===x.id,'optional signup email works only after delivered confirmation');
const b=await signup('Other_'+tag);const occupied=await account(b,'model_email_request',{email:xEmail,current_password:b.password,request_id:randomUUID()});check(occupied.status===409&&(await own(x)).email_login===xEmail,'occupied alias cannot be stolen by another account');
const tampered=await account(null,'model_email_confirm',{...proof(m.link),token:randomBytes(32).toString('hex')});check(tampered.status===410,'wrong callback token denied');
const openRedirect=await account(b,'model_email_request',{email:addr('redirect'),current_password:b.password,request_id:randomUUID(),redirect_to:'https://attacker.invalid'});check(openRedirect.status===400,'client cannot choose a redirect URL');
const unknown=await account(null,'model_recovery_request',{email:addr('missing')}),known=await account(null,'model_recovery_request',{email:emailC});check(unknown.status===known.status&&JSON.stringify(unknown.data)===JSON.stringify(known.data),'recovery acknowledgement hides account existence');
let resetMail=await mail(emailC,new Set([firstC.id,secondC.id]));await age(resetMail.link,true);const oldPassword=a.password;await browser(resetMail.link,'expired',password());check((await yes(null,'login',{identifier:a.nickname,password:a.password})).user_id===a.id,'expired reset link cannot change password');
await yes(null,'model_recovery_request',{email:emailC});const goodReset=await mail(emailC,new Set([firstC.id,secondC.id,resetMail.id]));const next=password(),oldSession=a.session;
await browser(goodReset.link,'recovery',next);check(true,'real browser callback changes password through Auth');
check((await account({session:oldSession},'profile')).status===401&&(await account(null,'refresh',{refresh_token:oldSession.refresh_token})).status===401,'email reset revokes old protected session and refresh');
check((await account(null,'login',{identifier:a.nickname,password:oldPassword})).status===401,'old password rejected after email recovery');a.password=next;a.session=await yes(null,'login',{identifier:a.nickname,password:a.password});check(a.session.user_id===a.id,'new password restores same account UUID');
check((await account(null,'model_recovery_complete',{...proof(goodReset.link),new_password:password()})).status===410,'consumed reset link cannot change password twice');
// Replacing verified email cancels an old recovery capability.
await yes(null,'model_recovery_request',{email:emailC});const staleReset=await mail(emailC,new Set([firstC.id,secondC.id,resetMail.id,goodReset.id]));const emailE=addr('final');await send(a,emailE);m=await mail(emailE);await yes(null,'model_email_confirm',proof(m.link));check((await account(null,'model_recovery_complete',{...proof(staleReset.link),new_password:password()})).status===410,'changing email invalidates recovery sent to old address');
// Private SQL and token material remain inaccessible to an ordinary user.
const forbidden=await request('/rest/v1/slm_email_links?select=*',undefined,a.session.access_token,keys.ANON_KEY,'GET');check(!forbidden.ok||forbidden.data.length===0,'RLS keeps callback hashes and target addresses private');
const internal=(await request('/rest/v1/slm_identity_registry?user_id=eq.'+a.id,undefined,undefined,undefined,'GET')).data[0].auth_email;
check(!(await account(null,'login',{identifier:internal,password:a.password})).ok,'internal Auth email still cannot log in publicly');
check(!JSON.stringify(await own(a)).includes(internal),'internal Auth address never appears in profile DTO');
console.log('EMAIL REAL SMTP/HTTP '+count+' PASS; 3 real browser callbacks; all aliases synthetic; internet deliverability NOT TESTED.');
