"""Test an INACTIVE owner-review patch in /tmp, never apply it to the checkout.
Only source/runtime contract tests; this does not authorize or start CI or a DB.
"""
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PATCH = Path(__file__).with_name('public-discovery-contracts-proposed.patch')
ALLOWED = {'app/scripts/premium-route-policy.mjs', 'app/scripts/verify-consolidation.mjs',
           'app/scripts/verify-premium-policy-cases.mjs'}


def proposed():
    sections = re.split(r'^--- a/', PATCH.read_text(), flags=re.M)[1:]
    result = {}
    for section in sections:
        name, body = section.split('\n', 1)
        if name not in ALLOWED or name in result:
            raise RuntimeError('Unexpected proposal target')
        lines = (ROOT / name).read_text().splitlines(keepends=True)
        output, cursor = [], 0
        for hunk in re.split(r'^@@ ', body, flags=re.M)[1:]:
            header, edits = hunk.split('\n', 1)
            start = int(re.match(r'-(\d+)', header)[1]) - 1
            if start < cursor:
                raise RuntimeError('Overlapping proposal')
            output.extend(lines[cursor:start])
            cursor = start
            for line in edits.splitlines(keepends=True):
                if line.startswith((' ', '-')):
                    if cursor >= len(lines) or lines[cursor] != line[1:]:
                        raise RuntimeError('Proposal no longer matches exact source')
                    cursor += 1
                if line.startswith((' ', '+')):
                    output.append(line[1:])
        output.extend(lines[cursor:])
        result[name] = ''.join(output)
    if set(result) != ALLOWED:
        raise RuntimeError('Incomplete proposal')
    return result


def main():
    sources = proposed()
    with tempfile.TemporaryDirectory(prefix='slm-discovery-contract-proposal-') as folder:
        temp = Path(folder)
        policy = sources['app/scripts/premium-route-policy.mjs'].replace("from 'typescript'", "from '" + (ROOT / 'app/node_modules/typescript/lib/typescript.js').as_uri() + "'")
        (temp / 'premium-route-policy.mjs').write_text(policy)
        for name in ('verify-consolidation.mjs', 'verify-premium-policy-cases.mjs'):
            text = sources['app/scripts/' + name]
            text = text.replace("fileURLToPath(new URL('../../',import.meta.url))", repr(str(ROOT) + '/'))
            # Other policies/manifests remain the actual unmodified checkout files.
            text = text.replace("new URL('./consolidation-sources.json',import.meta.url)", repr(str(ROOT / 'app/scripts/consolidation-sources.json')))
            text = text.replace("new URL('./prepare-edge-local.py',import.meta.url)", repr(str(ROOT / 'app/scripts/prepare-edge-local.py')))
            (temp / name).write_text(text)
        subprocess.run(['node', str(temp / 'verify-consolidation.mjs')], check=True, cwd=ROOT)
        subprocess.run(['node', '--test', str(temp / 'verify-premium-policy-cases.mjs')], check=True, cwd=ROOT)
        # Extra negative tests exercise exact backend hashes via read overrides.
        # Existing 37 cases above remain entirely intact.
        check = """import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyPremiumRuntime,DISCOVERY_MIGRATION} from './premium-route-policy.mjs';
const root=ROOT;
assert.equal(verifyPremiumRuntime(root).frozen,55);
for(const path of [DISCOVERY_MIGRATION,'app/supabase/functions/accounts/handler.ts']){
 const original=readFileSync(root+'/'+path,'utf8');
 assert.throws(()=>verifyPremiumRuntime(root,{[path]:original+'\\n--unreviewed change'}));
}
console.log('PASS proposed backend pins reject either changed backend source; visual/runtime protections intact.');
""".replace('const root=ROOT;', 'const root=' + repr(str(ROOT)) + ';')
        (temp / 'negative.mjs').write_text(check)
        subprocess.run(['node', str(temp / 'negative.mjs')], check=True, cwd=ROOT)
    print('PASS INACTIVE proposal only; checkout guards/pointers were NOT activated.')


if __name__ == '__main__':
    main()
