"""Local overlay of the already running API; no remote commands, migrations or secrets."""
from pathlib import Path
import hashlib,json,shutil,subprocess
repo=Path(__file__).resolve().parents[2]
assert subprocess.check_output(['git','branch','--show-current'],cwd=repo,text=True).strip()=='feat/slm-v1-live'
base=repo.parent/'premium318-live/.cache/http-edge/supabase/functions'
owned=repo/'app/local-backend'
local=repo/'.cache/b22-edge'
manifest=json.loads((owned/'PROVENANCE.json').read_text(encoding='utf8'))
for rel,digest in manifest.items():
    assert hashlib.sha256((base/rel).read_bytes()).hexdigest()==digest,'Local base changed: '+rel
for rel in manifest:
    target=local/'supabase/functions'/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(base/rel,target)
for source in owned.rglob('*.ts'):
    target=local/'supabase/functions'/source.relative_to(owned);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
config=repo.parent/'premium318-live/.cache/http-edge/supabase/config.toml'
shutil.copyfile(config,local/'supabase/config.toml')
# Preserve existing local worker secret without printing or committing it.
env=repo.parent/'premium318-live/.cache/http-edge/worker.env'
if env.exists():shutil.copyfile(env,local/'worker.env')
print('Prepared verified local B2.2 overlay; no database or remote operations performed.')
