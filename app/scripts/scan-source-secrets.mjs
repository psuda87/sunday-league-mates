// Values are never printed. This is a current-tree scan, not a complete history audit.
import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {basename} from 'node:path';
const repo=fileURLToPath(new URL('../../',import.meta.url)),files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:repo,encoding:'utf8'}).split(/\r?\n/).filter(Boolean))],issues=[];
for(const file of files){
 const name=basename(file);if((name==='.env'||name.includes('.env.'))&&!name.endsWith('.example'))issues.push({file,kind:'tracked-env'});
 if(!/\.(ts|tsx|js|mjs|py|md|txt|json|sql|toml|html|xml|example)$/.test(file))continue;
 const text=readFileSync(repo+file,'utf8');
 for(const [kind,pattern] of [['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{20,}/],['secret-key',/sb_secret_[A-Za-z0-9_-]{16,}/],['github-token',/gh[pousr]_[A-Za-z0-9]{30,}/]])if(pattern.test(text))issues.push({file,kind});
 for(const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]{20,}/g)){try{if(JSON.parse(Buffer.from(match[1],'base64url').toString()).role==='service_role')issues.push({file,kind:'literal-service-jwt'});}catch{ /* Pattern alone is not a valid JWT. */ }}
}
if(issues.length){console.log(JSON.stringify({issues}));process.exitCode=1;}else console.log('PASS source secret scan: '+files.length+' paths; no recognized private keys/service JWT/PAT/secret keys or tracked env. Values not logged; history and arbitrary PII NOT exhaustively audited.');
