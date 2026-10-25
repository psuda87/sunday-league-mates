"""Prepare ignored local Edge config, never read/copy env or production credentials."""
from pathlib import Path
import subprocess,secrets
repo=Path(__file__).resolve().parents[2]
assert subprocess.check_output(["git","branch","--show-current"],cwd=repo,text=True).strip()in ("feat/integration","feat/v1-consolidation")
local=repo/".cache/http-edge"
(local/"supabase/functions").mkdir(parents=True,exist_ok=True)
sources=repo/"app/supabase/functions"
for source in sorted(sources.rglob("*.ts")):
 assert source.resolve().is_relative_to(sources.resolve()), "Only checked-out local sources allowed"
 if source.suffix!=".ts":continue
 relative=source.relative_to(repo/"app/supabase/functions")
 dest=local/"supabase/functions"/relative
 dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(source.read_bytes())
(local/"supabase/config.toml").write_text('project_id = "sunday-league-mates"\n[functions.accounts]\nverify_jwt = false\nentrypoint = "./functions/accounts/local-entrypoint.example.ts"\n[functions.push-worker]\nverify_jwt = false\n',encoding="utf-8")
env=local/"worker.env"
if not env.exists():env.write_text("PUSH_WORKER_SECRET="+secrets.token_hex(32)+"\n",encoding="utf-8")
print("Local Edge prepared; keys/env not copied. From app: npx supabase functions serve --workdir ../.cache/http-edge --env-file ../.cache/http-edge/worker.env")
