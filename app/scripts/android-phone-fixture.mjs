// Local Admin API only; no PAT, remote URLs or credentials in files/arguments.
import { assertBranch, assertSafeConfig, management, server } from './accounts-admin-local.mjs';
let input;
try {
  assertBranch();
  assertSafeConfig(await management('/config/auth'));
  if (process.argv.length !== 3 || !['--check','--stdin'].includes(process.argv[2])) throw new Error();
  if (process.argv[2] === '--check') {
    console.log('PASS local fixture preflight; no account created');
  } else {
    let raw = '';
    for await (const chunk of process.stdin) {
      raw += chunk.toString('utf8');
      if (Buffer.byteLength(raw) > 4096) throw new Error();
    }
    input = JSON.parse(raw.replace(/^\uFEFF/, '')); raw = '';
    if (typeof input.email !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,48}@phone-fixture\.invalid$/.test(input.email)) throw new Error();
    if (typeof input.password !== 'string' || [...input.password].length < 8 || Buffer.byteLength(input.password) > 72) throw new Error();
    const api = await server();
    const result = await api.request('/auth/v1/admin/users','POST',{email:input.email,password:input.password,email_confirm:true});
    if (!result.ok || !result.data?.id) throw new Error();
    // No global admin metadata/role, forced group membership, mail or SMS.
    console.log('PASS one fictional local email account created; group role is assigned only when the user creates a group');
  }
} catch {
  console.error('FAIL local fixture operation. Check local Auth, unique .invalid address and password policy; existing accounts were not changed.');
  process.exitCode = 1;
} finally { if (input) input.password = null; input = null; }
