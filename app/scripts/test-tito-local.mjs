// Fresh approved local stack ONLY. Existing branch guard deliberately remains
// authoritative: this cannot run on the new branch before owner guard review.
import {assertIsolated,localKeys,sql,project,base} from './stabilization-local.mjs';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
assertIsolated();
assert.equal(localKeys().API_URL,'http://127.0.0.1:55321');assert.equal(base,'http://127.0.0.1:55321');
for(const dir of ['app/supabase','.cache/stabilization-stack/supabase']){
 assert(!existsSync(dir+'/.temp/project-ref'),'Linked Cloud project prohibited');
}
const container=JSON.parse(execFileSync('docker',['inspect','supabase_db_'+project],{encoding:'utf8'}))[0];
assert.equal(container.Config.Labels['com.supabase.cli.project'],'slm-main-stabilization');
const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
const created=Number(execFileSync('git',['reflog','show','--format=%ct',branch],{encoding:'utf8'}).trim().split(/\r?\n/).at(-1))*1000;
assert(Date.parse(container.Created)>=created,'Refusing a stack older than this branch');
const sources='app/supabase/migrations',copied='.cache/stabilization-stack/supabase/migrations';
const names=d=>readdirSync(d).filter(f=>f.endsWith('.sql')).sort();
assert.deepEqual(names(sources),names(copied),'Use versioned sources from THIS branch');
for(const name of names(sources))assert.equal(readFileSync(sources+'/'+name,'utf8').replaceAll('\r\n','\n'),readFileSync(copied+'/'+name,'utf8').replaceAll('\r\n','\n'));
assert.equal(sql('select (select count(*) from auth.users)+(select count(*) from public.slm_matches)'), '0','Refusing a used database');
// Every existing SQL suite rolls back its own synthetic fixture.
for(const suite of ['match_lineups','lineup_admin','premium_match_visibility','public_match_discovery','account_privacy','notifications','settlements','premium_admin_finance','payment_workflow','tito_lineups']){
 sql(readFileSync('app/supabase/tests/'+suite+'.sql','utf8'));console.log('PASS SQL '+suite);
}
const q=s=>"'"+String(s).replaceAll("'","''")+"'",j=o=>q(JSON.stringify(o))+'::jsonb';
const u=[randomUUID(),randomUUID()],sessions=u.map(()=>randomUUID()),g=randomUUID();
const rpc=(i,kind,action,body)=>`public.slm_${kind}_dispatch(${q(u[i])},${q(sessions[i])},${q(action)},${j(body)})`;
const call=(i,kind,action,body)=>JSON.parse(sql(`begin;set local role service_role;select ${rpc(i,kind,action,body)};commit;`));
const match=(i,action,event,extra={})=>call(i,'matches',action,{event_id:event,request_id:randomUUID(),...extra});
sql(u.map((id,i)=>`insert into auth.users(id,email) values(${q(id)},${q(id+'@fixture.invalid')});
 select public.slm_account_provision(${q(id)},${q('Tito_'+id.slice(0,8))},null,${q(id+'@fixture.invalid')},null,null,false);
 update public.slm_account_security set must_change_password=false where user_id=${q(id)};
 insert into auth.sessions(id,user_id) values(${q(sessions[i])},${q(id)});
 select public.slm_account_accept_session(${q(id)},${q(sessions[i])},1);`).join('\n')+`
 insert into public.slm_groups(id,name,admin_id) values(${q(g)},'Tito concurrent fixture',${q(u[0])});
 insert into public.slm_group_members(group_id,user_id) values(${q(g)},${q(u[0])}),(${q(g)},${q(u[1])});`);
function event(capacity=15){const id=randomUUID();sql(`insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players)
 values(${q(id)},${q(g)},${q(u[0])},'Tito concurrency','private',clock_timestamp()+interval '2 days','Synthetic pitch',90,${capacity},0,1);`);return id;}
// Deterministic first-writer gate. The waiter starts only AFTER the first owns
// the same advisory lock as both dispatchers; no probabilistic race acceptance.
function transaction(query,hold=false){
 let ready;const locked=new Promise(r=>{ready=r;});
 const process=spawn('docker',['exec','-i','supabase_db_'+project,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{windowsHide:true});
 let out='',err='';process.stdout.on('data',x=>{out+=x;if(out.includes('TITO_LOCKED'))ready();});process.stderr.on('data',x=>err+=x);
 const result=new Promise((resolve,reject)=>{process.on('error',reject);process.on('close',code=>{ready();resolve({code,out,err});});});
 process.stdin.end(`begin;set local lock_timeout='5s';set local statement_timeout='10s';set local role service_role;
 ${hold?"select pg_advisory_xact_lock(20261014,1);select 'TITO_LOCKED';":''}
 select ${query};${hold?'select pg_sleep(0.3);':''}commit;`);
 return {locked,result};
}
async function ordered(first,second){
 const start=performance.now(),holder=transaction(first,true);await holder.locked;
 const waiter=transaction(second);const result=await Promise.all([holder.result,waiter.result]);
 console.log('LOCK_ELAPSED_MS '+Math.round(performance.now()-start));return result;
}
const last=event(10);
for(let i=0;i<9;i++)match(0,'guest',last,{guest_name:'Fixture '+i});
const firstBody={event_id:last,request_id:randomUUID()},secondBody={event_id:last,request_id:randomUUID()};
const race=await ordered(rpc(0,'matches','join',firstBody),rpc(1,'matches','join',secondBody));
assert.equal(race[0].code,0);assert.notEqual(race[1].code,0);assert.match(race[1].err,/event_full/);
let state=call(0,'lineups','get',{event_id:last});assert.equal(state.team_a.length,5);assert.equal(state.team_b.length,5);
const version=state.version;call(0,'matches','join',firstBody);assert.equal(call(0,'lineups','get',{event_id:last}).version,version);
for(const manualFirst of [true,false]){
 const e=event();const ids=[match(0,'join',e).participant_id,match(1,'join',e).participant_id];
 state=call(0,'lineups','get',{event_id:e});
 const save={event_id:e,expected_version:state.version,expected_roster_version:state.roster_version,team_a:state.team_b,team_b:state.team_a,request_id:randomUUID()};
 const guest={event_id:e,guest_name:'Race fixture',request_id:randomUUID()};
 const manual=rpc(0,'lineups','save',save),automatic=rpc(0,'matches','guest',guest);
 const result=await ordered(manualFirst?manual:automatic,manualFirst?automatic:manual);
 assert.equal(result[0].code,0);
 state=call(0,'lineups','get',{event_id:e});assert.equal(state.team_a.length+state.team_b.length,3);assert.equal(state.unassigned.length,0);
 if(manualFirst){assert.equal(result[1].code,0);for(const id of ids)assert(state[save.team_a.includes(id)?'team_a':'team_b'].includes(id));}
 else{assert.notEqual(result[1].code,0);assert.match(result[1].err,/lineup_(version|roster)_conflict/);}
}
console.log('PASS last place, same request retry, both forced manual/automatic orders. Synthetic fixtures retained; no reset/cleanup of existing data.');
