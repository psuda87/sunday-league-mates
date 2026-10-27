// Additional real HTTP fault/concurrency tests; pauses ONLY the isolated test Mailpit.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {check,signup,mail,proof,yes,account,rpc,request,addr,password,tag,count} from './account-email-test-support.mjs';
const a=await signup('Fault_'+tag),email=addr('failure');
const send=()=>yes(a,'model_email_request',{email,current_password:a.password,request_id:randomUUID()});
const c=JSON.parse(execFileSync('docker',['inspect','supabase_inbucket_slm-account-mail'],{encoding:'utf8'}))[0];assert.equal(c.Config.Labels['com.supabase.cli.project'],'slm-account-mail');
try{
 execFileSync('docker',['pause','supabase_inbucket_slm-account-mail'],{stdio:'ignore'});await send();let failed=false;
 for(let n=0;n<50;n++){const p=await yes(a,'profile');if(p.email_pending?.delivery==='failed'){failed=true;break;}await new Promise(r=>setTimeout(r,500));}
 check(failed,'SMTP timeout exposes private failed delivery state');check((await yes(a,'profile')).email_login===null,'failed SMTP cannot activate login alias');
}finally{execFileSync('docker',['unpause','supabase_inbucket_slm-account-mail'],{stdio:'ignore'});}
await send();let m=await mail(email);await yes(null,'model_email_confirm',proof(m.link));check((await yes(null,'login',{identifier:email,password:a.password})).user_id===a.id,'resend after SMTP failure restores real verified login');
await yes(null,'model_recovery_request',{email});let reset=await mail(email,new Set([m.id]));const next1=password(),next2=password();
const pair=await Promise.all([account(null,'model_recovery_complete',{...proof(reset.link),new_password:next1}),account(null,'model_recovery_complete',{...proof(reset.link),new_password:next2})]);
check(pair.filter(r=>r.ok).length===1&&pair.filter(r=>[409,410].includes(r.status)).length===1,'two simultaneous reset requests have exactly one successful writer');
a.password=pair[0].ok?next1:next2;a.session=await yes(null,'login',{identifier:a.nickname,password:a.password});
check(a.session.user_id===a.id&&(await yes(a,'profile')).nickname===a.nickname,'reset race preserves UUID and canonical nickname');
await yes(null,'model_recovery_request',{email});let interrupted=await mail(email,new Set([m.id,reset.id]));let t=proof(interrupted.link);const {createHash}=await import('node:crypto');const hash=createHash('sha256').update(t.token).digest('hex');
assert((await rpc('slm_email_recovery_begin',{p_id:t.id,p_hash:hash,p_lease:randomUUID()})).ok);check((await account(null,'model_recovery_complete',{...t,new_password:password()})).status===409,'interrupted reset retains exclusive live lease');
assert((await request('/rest/v1/slm_email_links?id=eq.'+t.id,{lease_until:new Date(Date.now()-1000).toISOString()},undefined,undefined,'PATCH')).ok);
const restored=password();await yes(null,'model_recovery_complete',{...t,new_password:restored});a.password=restored;a.session=await yes(null,'login',{identifier:email,password:a.password});check(a.session.user_id===a.id,'expired worker lease safely resumes through real Supabase Auth');
// A separately verified account reset by the existing account administrator invalidates mail proof.
const b=await signup('AdminMail_'+tag),victim=await signup('VictimMail_'+tag),target=addr('admin-victim');
await yes(victim,'model_email_request',{email:target,current_password:victim.password,request_id:randomUUID()});m=await mail(target);await yes(null,'model_email_confirm',proof(m.link));await yes(null,'model_recovery_request',{email:target});reset=await mail(target,new Set([m.id]));
assert((await request('/rest/v1/slm_roles?user_id=eq.'+b.id,{role:'admin'},undefined,undefined,'PATCH')).ok);b.session=await yes(null,'login',{identifier:b.nickname,password:b.password});
const adminReset=await yes(b,'reset_password',{user_id:victim.id,confirm_identity:true,reason:'Independent identity check for isolated synthetic fixture',current_password:b.password});
check(adminReset.temporary_password.length===12,'existing administrative reset still issues mandatory temporary password');
check((await account(null,'model_recovery_complete',{...proof(reset.link),new_password:password()})).status===410,'administrator reset invalidates previously delivered recovery proof');
console.log('EMAIL FAULT/CONCURRENCY '+count+' PASS; no existing account or database reset.');
