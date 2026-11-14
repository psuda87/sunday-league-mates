import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, render} from '@testing-library/react';
import {lineupSnapshot} from './lineupContracts';
import {currentWithdrawals, matchDetail} from './premiumContracts';
import {lineupFixture, uid} from './lineupFixture.test-support';
import PremiumTeams from './PremiumTeams';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

afterEach(cleanup);
it('separates explicit Tito, erased manual author and historical manual receipts', () => {
  const f=lineupFixture(4,true),s=f.read(),changed_at='2026-11-10T12:00:00Z';
  const author=(actor_type?:string,user_id:string|null=null,display_name='Tito')=>({...s,last_change:{actor_type,user_id,display_name,changed_at}});
  expect(lineupSnapshot(author('automatic'),f.eventId).last_change?.actor_type).toBe('automatic');
  expect(lineupSnapshot(author('manual',null,'Usunięty użytkownik'),f.eventId).last_change?.actor_type).toBe('manual');
  expect(lineupSnapshot(author(undefined,uid(3),'Autor'),f.eventId).last_change?.user_id).toBe(uid(3));
  expect(()=>lineupSnapshot(author(),f.eventId)).toThrow();
  expect(lineupSnapshot(author('automatic',uid(3)),f.eventId).last_change?.user_id).toBe(uid(3));
  expect(()=>lineupSnapshot(author('automatic',null,'Autor'),f.eventId)).toThrow();
  expect(()=>lineupSnapshot(author('unknown',uid(3)),f.eventId)).toThrow();
});
it('records the older-client compatibility boundary without inventing an Auth identity', () => {
  // Execute the actual frozen decoder, rather than a rewritten approximation.
  const oldSource=execFileSync('git',['show','51211af24479da9ee9dfef23df2fb400d72a9738:app/src/events/lineupContracts.ts'],{encoding:'utf8'});
  const code=ts.transpileModule(oldSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
    .replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,'');
  const decode=new Function(code+'\nreturn lineupSnapshot;')() as typeof lineupSnapshot;
  const oldClientAccepts=(value:unknown)=>{try{decode(value,(value as {event_id:string}).event_id);return true;}catch{return false;}};
  const f=lineupFixture(4,true),s=f.read();
  expect(oldClientAccepts(s)).toBe(true); // Additive jersey/actor fields do not break manual writes.
  expect(oldClientAccepts({...s,last_change:{...s.last_change,actor_type:'manual'}})).toBe(true);
  expect(oldClientAccepts({...s,last_change:{...s.last_change,actor_type:'automatic',display_name:'Tito'}})).toBe(true);
  expect(oldClientAccepts({...s,last_change:{...s.last_change,user_id:null,actor_type:'automatic',display_name:'Tito'}})).toBe(false);
  // Legacy limitation: operator backfill has no account initiator; erasure also nulls it.
});
it('hides only superseded member withdrawals, retains all guest IDs and original history', () => {
  const f=lineupFixture(4),p=f.people[0];
  const rows=[{...p,id:uid(41),status:'withdrawn' as const},{...p,status:'reserve' as const},
    {...p,id:uid(42),member_id:null,status:'withdrawn' as const},
    {...p,id:uid(43),member_id:null,status:'registered' as const},
    {...f.people[1],id:uid(44),status:'withdrawn' as const}];
  expect(currentWithdrawals(rows).map(r=>r.id)).toEqual([uid(42),uid(44)]);
  expect(rows).toHaveLength(5);expect(rows[0].status).toBe('withdrawn');
  rows[1].status='withdrawn';expect(currentWithdrawals(rows).map(r=>r.id)).toContain(uid(41));
});
it.each([0,99,null,undefined])('accepts optional jersey %s from the authorized detail contract',number=>{
  const f=lineupFixture(4),d=f.detail();d.participants[0].jersey_number=number;
  expect(matchDetail(d,f.eventId).participants[0].jersey_number).toBe(number);
});
it.each([-1,100,1.5,'27'])('rejects invalid jersey %s',number=>{
  const f=lineupFixture(4),d=f.detail();Object.assign(d.participants[0],{jersey_number:number});
  expect(()=>matchDetail(d,f.eventId)).toThrow('Invalid jersey');
});
it('renders 0 and 99 on opposite teams, dash for missing number and G for guests without profile fetches',async()=>{
  const f=lineupFixture(11,true);f.people[0].jersey_number=0;f.people[1].jersey_number=99;
  f.people[9].jersey_number=27;const context=await f.context();
  const {container,findByText}=render(<PremiumTeams eventId={f.eventId} participants={f.people} canEdit cancelled={false} profileContext={context}/>);
  await findByText('Zapisany skład · lokalna edycja');
  const token=(n:number)=>container.querySelector(`[data-entry="${uid(n)}"] .slm-pitch-token`)?.textContent;
  expect(token(1)).toBe('0');expect(token(2)).toBe('99');expect(token(3)).toBe('—');expect(token(10)).toBe('G');
  expect(vi.mocked(f.request).mock.calls.filter(c=>c[0]==='groups_profile')).toHaveLength(0);
});
