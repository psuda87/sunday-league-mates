"""Opt-in transport configuration for the existing local finance runtime only.
No migrations, resets, deploys, container changes or canonical Edge source edits.
Pass the existing Stage2 worktree path explicitly; refuses any different project.
"""
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
assert subprocess.check_output(['git', 'branch', '--show-current'], cwd=root, text=True).strip() == 'test/android-premium-real-stage3'
assert len(sys.argv) == 2, 'Usage: python app/scripts/prepare-android-stage3-cors.py STAGE2_WORKTREE'
source = Path(sys.argv[1]).resolve()
assert source != root and (source / '.git').is_file(), 'Explicit linked Stage2 worktree required'
assert subprocess.check_output(['git', 'branch', '--show-current'], cwd=source, text=True).strip() == 'feat/premium-real-finance-stage2'
project = 'slm-premium-real-finance'
container = json.loads(subprocess.check_output(['docker', 'inspect', 'supabase_edge_runtime_' + project]))[0]
assert container['Config']['Labels']['com.supabase.cli.project'] == project
runtime = source / '.cache/premium-finance-stack/supabase/functions/accounts'
assert (runtime / 'handler.ts').read_bytes() == (root / 'app/supabase/functions/accounts/handler.ts').read_bytes(), 'Runtime handler differs from audited source'
p = runtime / 'premium-local.ts'
s = p.read_text(encoding='utf8')
assert "url!=='http://kong:8000'" in s and 'accountModelEnabled' not in s
before = "origins:['http://127.0.0.1:5186','http://localhost:5186']"
after = "origins:['http://127.0.0.1:5186','http://localhost:5186','https://localhost']"
assert before in s or after in s, 'Unexpected local runtime configuration'
p.write_text(s.replace(before, after), encoding='utf8')
print('PASS local generated runtime origin only; handler/Auth/model/data unchanged')
