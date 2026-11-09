// Run only on the repository-approved disposable local stack; never targets Cloud.
import {assertIsolated, sql} from './stabilization-local.mjs';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
assertIsolated(); // Preserve the existing branch, project and Docker-label guards.
sql(readFileSync('app/supabase/tests/tito_lineups.sql', 'utf8'));
console.log('PASS: SQL Tito w transakcji wycofywanej po teście.');
const q = s => `'${String(s).replaceAll("'", "''")}'`;
const id = () => randomUUID(), u=id(), v=id(), su=id(), sv=id(), g=id(), e=id();
const suffix=u.replaceAll('-','').slice(0,12);
sql(`insert into auth.users(id,email) values(${q(u)},${q(u+'@example.invalid')}),(${q(v)},${q(v+'@example.invalid')});
select public.slm_account_provision(${q(u)},${q('tu'+suffix)},null,${q(u+'@example.invalid')},null,null,false);
select public.slm_account_provision(${q(v)},${q('tv'+suffix)},null,${q(v+'@example.invalid')},null,null,false);
update public.slm_account_security set must_change_password=false where user_id in (${q(u)},${q(v)});
insert into auth.sessions(id,user_id) values(${q(su)},${q(u)}),(${q(sv)},${q(v)});
select public.slm_account_accept_session(${q(u)},${q(su)},1),public.slm_account_accept_session(${q(v)},${q(sv)},1);
insert into public.slm_groups(id,name,admin_id) values(${q(g)},'Tito concurrent fixture',${q(u)});
insert into public.slm_group_members(group_id,user_id) values(${q(g)},${q(u)}),(${q(g)},${q(v)});
insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players)
values(${q(e)},${q(g)},${q(u)},'Tito concurrent','private',now()+interval '2 days','fixture',90,15,0,1);`);
function body(value){return `${q(JSON.stringify(value))}::jsonb`;}
function matches(user, session, action, value){return `public.slm_matches_dispatch(${q(user)},${q(session)},${q(action)},${body(value)})`;}
function lineups(user, session, action, value){return `public.slm_lineups_dispatch(${q(user)},${q(session)},${q(action)},${body(value)})`;}
function concurrent(query){return new Promise(resolve=>{
 const p=spawn('docker',['exec','-i','supabase_db_slm-main-stabilization','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']);
 let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('close',code=>resolve({code,out,err}));
 p.stdin.end(`begin; select pg_advisory_xact_lock(20261014,1); select pg_sleep(0.4); ${query}; commit;`);
});}
const r1=id(),r2=id(),b1={event_id:e,request_id:r1},b2={event_id:e,request_id:r2};
const joined=await Promise.all([concurrent(`select ${matches(u,su,'join',b1)}`),concurrent(`select ${matches(v,sv,'join',b2)}`)]);
assert(joined.every(x=>x.code===0),JSON.stringify(joined));
let state=JSON.parse(sql(`select ${lineups(u,su,'get',{event_id:e})}`));
assert.equal(state.team_a.length,1);assert.equal(state.team_b.length,1);
const version=state.version;
sql(`select ${matches(u,su,'join',b1)}`); // same request replays, no extra version
state=JSON.parse(sql(`select ${lineups(u,su,'get',{event_id:e})}`));assert.equal(state.version,version);
const save={event_id:e,expected_version:state.version,expected_roster_version:state.roster_version,team_a:state.team_b,team_b:state.team_a,request_id:id()};
const guest={event_id:e,guest_name:'Gość współbieżny',request_id:id()};
const race=await Promise.all([concurrent(`select ${lineups(u,su,'save',save)}`),concurrent(`select ${matches(u,su,'guest',guest)}`)]);
assert.equal(race[1].code,0,JSON.stringify(race));
assert(race[0].code===0 || /lineup_(version|roster)_conflict/.test(race[0].err),JSON.stringify(race));
state=JSON.parse(sql(`select ${lineups(u,su,'get',{event_id:e})}`));
assert.equal(state.team_a.length+state.team_b.length,3);assert.equal(state.unassigned.length,0);
console.log('PASS: równoczesne zapisy, idempotencja, konflikt ręcznego składu i gościa.');
