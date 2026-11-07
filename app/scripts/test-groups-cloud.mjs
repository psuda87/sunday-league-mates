import {readFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const base='https://hjtcyybkxebvdropchac.supabase.co',origin='https://slm-ui-demo.vercel.app';
let email,password,tag,nick,emails,winner,sessions=[];
const output=value=>console.log(JSON.stringify(value));
async function* commandLines(){
 const path=resolve('../.cache/groups-cloud-command.json');
 while(true){try{const line=await readFile(path,'utf8');await unlink(path);yield line;}catch(error){if(error.code!=='ENOENT')throw error;await new Promise(r=>setTimeout(r,300));}}
}
async function api(action,body={},session){const r=await fetch(base+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(25000)});return {status:r.status,data:await r.json(),cors:r.headers.get('access-control-allow-origin')};}
const signup=(address,name)=>api('signup',{email:address,password,profile:{nickname:name,fullName:'',phone:''},accept_policies:true});
for await(const line of commandLines()){
 try{
 const command=JSON.parse(line);
 if(command.action==='start'){
  email=command.email;tag=randomBytes(4).toString('hex');nick='Groups'+tag;password=randomBytes(24).toString('base64url')+'Aa7!';
  const [local,domain]=email.split('@');assert(domain==='gmail.com');emails=[1,2].map(i=>`${local}+slmgroups${tag}${i}@${domain}`);
  const results=await Promise.all(emails.map(address=>signup(address,nick)));
  winner=results.findIndex(r=>r.status===200);output({stage:'signup-race',tag,winner,results:results.map(r=>({status:r.status,code:r.data.code,verified:r.data.verification_required,cors:r.cors}))});
  assert.equal(winner>=0,true,'Signup needs one success');assert.equal(results.filter(r=>r.status===409&&r.data.code==='nickname_taken').length,1);
 }else if(command.action==='verify'){
  const result=await api('verify_email',{token_hash:command.token});assert.equal(result.status,200);assert.equal(result.data.email_verified,true);output({stage:'verify',pass:true});
 }else if(command.action==='login'){
  const r=await api('login',{identifier:emails[winner],password});output({stage:'login',status:r.status,code:r.data.code});assert.equal(r.status,200);sessions[0]=r.data;
 }else if(command.action==='second'){
  const r=await signup(emails[1-winner],'Other'+tag);output({stage:'second-signup',status:r.status,code:r.data.code});assert.equal(r.status,200);
 }else if(command.action==='login-second'){
  const r=await api('login',{identifier:emails[1-winner],password});output({stage:'login-second',status:r.status,code:r.data.code});assert.equal(r.status,200);sessions[1]=r.data;
 }else if(command.action==='nickname'){
  assert(sessions[0]&&sessions[1]);
  const body={nickname:nick.toUpperCase(),first_name:'',full_name:'',display_as:'nickname',jersey_number:null,group_scope:[],accept_disclosure:false,request_id:crypto.randomUUID()};
  const conflict=await api('save_premium_profile',body,sessions[1]);output({stage:'nickname-conflict',status:conflict.status,code:conflict.data.code});assert.equal(conflict.status,409);assert.equal(conflict.data.code,'nickname_taken');
  const own=await api('save_premium_profile',body,sessions[0]);output({stage:'nickname-case-change',status:own.status});assert.equal(own.status,200);
  const renamed=await api('save_premium_profile',{...body,nickname:'Renamed'+tag,request_id:crypto.randomUUID()},sessions[0]);assert.equal(renamed.status,200);
  const again=await api('login',{identifier:emails[winner],password});assert.equal(again.status,200);sessions[0]=again.data;
  const profile=await api('profile',{},sessions[0]);assert.equal(profile.data.nickname,'Renamed'+tag);output({stage:'rename-login-readback',pass:true});
 }else if(command.action==='groups'){
  const create=await api('groups_create',{name:'Odbior '+tag,description:'Fikcyjna grupa testu odbioru',request_id:crypto.randomUUID()},sessions[0]);assert.equal(create.status,200);const gid=create.data.group_id;
  const join=await api('groups_join',{group_id:gid,request_id:crypto.randomUUID()},sessions[1]);assert.equal(join.status,200);
  const detail=await api('groups_detail',{group_id:gid},sessions[0]);assert.equal(detail.status,200);const request=detail.data.requests.find(r=>r.kind==='join'&&r.state==='pending');assert(request);
  const wrong=await api('groups_decide',{id:request.id,accept:true,request_id:crypto.randomUUID()},sessions[1]);assert.equal(wrong.status,403);
  const list=await api('groups_list',{},sessions[0]);assert.equal(list.data.groups.find(g=>g.id===gid).pending_count,1);
  const decide=await api('groups_decide',{id:request.id,accept:true,request_id:crypto.randomUUID()},sessions[0]);assert.equal(decide.status,200);
  const after=await api('groups_list',{},sessions[0]);assert.equal(after.data.groups.find(g=>g.id===gid).pending_count,0);output({stage:'groups-live-admin-scope-and-counts',pass:true});
 }else if(command.action==='finish'){
  for(const s of sessions)if(s)await api('logout',{},s);password=undefined;sessions=[];output({stage:'finished'});break;
 }
 }catch(e){process.exitCode=1;output({stage:'ERROR',message:e.message});}
}
