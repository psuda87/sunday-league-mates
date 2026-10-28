import assert from 'node:assert/strict';
// This is an accident guard, not an authorization boundary. Docker project/URL checks remain mandatory.
export function assertLocalTestContext(branch,env=process.env){
 const local=['chore/main-stabilization','chore/android-main-acceptance'].includes(branch);
 const ci=env.GITHUB_ACTIONS==='true'&&env.GITHUB_REPOSITORY==='psuda87/sunday-league-mates'&&(
  env.GITHUB_EVENT_NAME==='pull_request'&&env.GITHUB_BASE_REF==='main'&&/^refs\/pull\/\d+\/merge$/.test(env.GITHUB_REF??'')||
  env.GITHUB_EVENT_NAME==='workflow_dispatch'&&['refs/heads/main','refs/heads/chore/main-stabilization','refs/heads/chore/android-main-acceptance'].includes(env.GITHUB_REF));
 assert(local||ci,'Dedicated local-test branch or verified PR-to-main CI context required');
}
