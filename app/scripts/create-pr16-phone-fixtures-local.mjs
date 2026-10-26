// Only fictional accounts in the isolated local PR16 project. Never prints passwords.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'feat/premium-profile-name-privacy');
const host=process.env.DOCKER_HOST??execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();assert(/^(npipe|unix):/.test(host));
const raw=execFileSync('cmd',['/c','npx','--yes','--package=supabase@2.121.0','supabase','status','--workdir','../.cache/pr16-stack','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});const keys=JSON.parse(raw.slice(raw.indexOf('{'))),url='http://127.0.0.1:56321';assert.equal(keys.API_URL,url);assert(keys.SERVICE_ROLE_KEY&&keys.ANON_KEY);
async function request(path,body,token=keys.SERVICE_ROLE_KEY,key=keys.SERVICE_ROLE_KEY){const r=await fetch(url+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const data=await r.json().catch(()=>null);assert(r.ok,'Local fixture operation HTTP '+r.status);return data;}
const password=()=>randomBytes(6).toString('base64url')+'Aa7!';
const call=(u,action,body={})=>request('/functions/v1/accounts',{...body,action},u.session.access_token,keys.ANON_KEY);
async function account(kind){
 const email=randomUUID()+'@fixture.invalid',initial=password(),u={login:'POCO_'+kind+'_'+randomUUID().slice(0,4),password:password()};
 const created=await request('/auth/v1/admin/users',{email,password:initial,email_confirm:true});u.id=created.id;
 await request('/rest/v1/rpc/slm_account_provision',{p_user:u.id,p_login:u.login,p_phone:'+48000'+String(Math.floor(Math.random()*999999)+1).padStart(6,'0'),p_email:email,p_actor:null,p_actor_session:null,p_admin:false});
 u.session=await request('/functions/v1/accounts',{action:'login',identifier:u.login,password:initial},keys.ANON_KEY,keys.ANON_KEY);
 u.session=await call(u,'password',{current_password:initial,new_password:u.password});return u;
}
const [subject,viewer,admin]=await Promise.all([account('Gracz'),account('Widz'),account('Admin')]);
await call(subject,'save_premium_profile',{nickname:'POCO Zawodnik',first_name:'Aleks',full_name:'Aleks Testowy',jersey_number:27,display_as:'nickname',group_scope:[],accept_disclosure:false,request_id:randomUUID()});
for(const name of ['POCO PR16 A','POCO PR16 B']){
 const g=await call(admin,'groups_create',{name,description:'Fikcyjne dane odbioru PR16',request_id:randomUUID()});
 for(const u of [subject,viewer]){await call(admin,'groups_invite',{...g,user_id:u.id,request_id:randomUUID()});const invite=(await call(u,'groups_inbox')).requests.find(x=>x.group_id===g.group_id&&x.state==='pending');assert(invite);await call(u,'groups_decide',{id:invite.id,accept:true,request_id:randomUUID()});}
}
const path=join(tmpdir(),'SLM-PR16-POCO-'+randomUUID().slice(0,8)+'.txt');
writeFileSync(path,['TYLKO lokalny Supabase PR16 / 56321. Nie kopiuj do Git ani raportu.','Zawodnik — edytuj własny profil:',subject.login,subject.password,'','Obserwator — sprawdzaj widoczność zawodnika w dwóch grupach:',viewer.login,viewer.password,'','Grupy: POCO PR16 A i POCO PR16 B. Dane są całkowicie fikcyjne. Nie wysyłaj haseł do czatu.'].join('\r\n'),{flag:'wx',mode:0o600});
console.log('Created 3 fictional local accounts and 2 groups; private handoff file: '+path);
