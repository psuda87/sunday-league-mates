import {readFileSync} from 'node:fs';
import {sql,assertIsolated} from './stabilization-local.mjs';
import assert from 'node:assert/strict';
assertIsolated();
assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'40');
assert.equal(sql("select to_regclass('public.slm_account_model_state') is null"),'t');
for(const name of ['integration-contracts','premium_profile_name','premium_match_visibility','premium_admin_finance','settlements','notifications']){
 try{const result=sql(readFileSync('app/supabase/tests/'+name+'.sql','utf8'));console.log('PASS SQL '+name+' ('+result.split('PASS').length+' result segments)');}
 catch(e){console.error('FAIL SQL '+name);console.error(String(e.stderr??'').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[TOKEN]'));process.exitCode=1;}
}
