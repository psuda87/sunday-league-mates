import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLocalTestContext} from './local-test-context.mjs';
test('allows only dedicated local branches',()=>{
 for(const branch of ['chore/main-stabilization','chore/android-main-acceptance'])assert.doesNotThrow(()=>assertLocalTestContext(branch,{}));
 for(const branch of ['main','feat/ui-beta',''])assert.throws(()=>assertLocalTestContext(branch,{}));
});
const ci={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'psuda87/sunday-league-mates',GITHUB_EVENT_NAME:'pull_request',GITHUB_BASE_REF:'main',GITHUB_REF:'refs/pull/24/merge'};
test('allows detached GitHub PR merge ref to main',()=>assert.doesNotThrow(()=>assertLocalTestContext('',ci)));
test('allows manual main only inside the exact GitHub repository CI',()=>assert.doesNotThrow(()=>assertLocalTestContext('main',{...ci,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main'})));
test('rejects unrelated manual CI branch',()=>assert.throws(()=>assertLocalTestContext('',{...ci,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/unrelated'})));
for(const [field,value] of [['GITHUB_REPOSITORY','other/repo'],['GITHUB_BASE_REF','development'],['GITHUB_EVENT_NAME','pull_request_target'],['GITHUB_REF','refs/heads/main'],['GITHUB_ACTIONS','false']])
 test('rejects CI mismatch '+field,()=>assert.throws(()=>assertLocalTestContext('',{...ci,[field]:value})));
