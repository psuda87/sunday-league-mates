// Run the actual MAIN component/decoder against synthetic new-server DTOs.
// This is controlled transport verification, NOT a real local database test.
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const control=resolve(process.argv[2]??'');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:control,encoding:'utf8'}).trim(),'51211af24479da9ee9dfef23df2fb400d72a9738');
execFileSync('git',['diff','--exit-code'],{cwd:control});
const app=resolve(control,'app'),dir=resolve(app,'.cache/tito-control');mkdirSync(dir,{recursive:true});
writeFileSync(resolve(dir,'legacy-null.test.tsx'),`
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import PremiumTeams from '../../src/events/PremiumTeams';
import {lineupFixture} from '../../src/events/lineupFixture.test-support';
afterEach(cleanup);
it.each(['manual','automatic'])('main cold start rejects null %s author with a generic error and no pitch',async actor_type=>{
 const f=lineupFixture(4,true),context=await f.context();
 f.intercept(async(a,b)=>a==='lineups_get'?{...f.read(),last_change:{...f.read().last_change,user_id:null,actor_type,display_name:actor_type==='automatic'?'Tito':'Usunięty użytkownik'}}:f.handle(a,b,f.userId));
 render(<PremiumTeams eventId={f.eventId} participants={f.people} canEdit cancelled={false} profileContext={context}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Nie potwierdzono operacji');
 expect(document.querySelector('.slm-football-pitch')).toBeNull();
});
it('main accepts an additive automatic marker with the real initiator UUID',async()=>{
 const f=lineupFixture(4,true),context=await f.context();
 f.intercept(async(a,b)=>a==='lineups_get'?{...f.read(),last_change:{...f.read().last_change,actor_type:'automatic',display_name:'Tito'}}:f.handle(a,b,f.userId));
 render(<PremiumTeams eventId={f.eventId} participants={f.people} canEdit cancelled={false} profileContext={context}/>);
 expect(await screen.findByText('Ostatnia zmiana: Tito')).toBeTruthy();expect(document.querySelector('.slm-football-pitch')).toBeTruthy();
});
it('main warm view retains its earlier pitch after an undecodable null-author refresh and blocks save',async()=>{
 const f=lineupFixture(4,true),context=await f.context();
 render(<PremiumTeams eventId={f.eventId} participants={f.people} canEdit cancelled={false} profileContext={context}/>);
 await screen.findByText('Ostatnia zmiana: Autor API');
 f.intercept(async(a,b)=>a==='lineups_get'?{...f.read(),last_change:{...f.read().last_change,user_id:null,actor_type:'manual',display_name:'Usunięty użytkownik'}}:f.handle(a,b,f.userId));
 fireEvent.click(screen.getByRole('button',{name:'Odśwież skład'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Nie potwierdzono operacji');
 expect(document.querySelector('.slm-football-pitch')).toBeTruthy();expect(screen.getByText('Ostatnia zmiana: Autor API')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Zapisz'})).toBeDisabled();
});
`,'utf8');
const run=spawnSync(process.execPath,[resolve(app,'node_modules/vitest/vitest.mjs'),'--run','.cache/tito-control/legacy-null.test.tsx','--maxWorkers=2'],{cwd:app,stdio:'inherit',windowsHide:true});
if(run.error)throw run.error;process.exitCode=run.status??1;
