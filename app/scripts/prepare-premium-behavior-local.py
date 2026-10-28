"""Brand new disposable test stack only; never changes the POCO/Cloud database."""
import subprocess,json,re,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[2]
assert subprocess.check_output(['git','branch','--show-current'],cwd=root,text=True).strip()=='fix/premium-real-ui-regression'
project='slm-premium-behavior-review'
stack=root/'.cache/premium-behavior-stack'
host=subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
assert host.startswith(('npipe://','unix://'))
config=stack/'supabase/config.toml'
if not config.exists():
 r=subprocess.run(['cmd','/c','npx','--yes','--package=supabase@2.121.0','supabase','init','--workdir',str(stack)],cwd=root,capture_output=True);assert r.returncode==0
s=config.read_text(encoding='utf8')
s=re.sub(r'^project_id = .*$', 'project_id = "'+project+'"',s,flags=re.M).replace('5432','6532').replace('inspector_port = 8083','inspector_port = 9283')
s=re.sub(r'(\[auth\][\s\S]*?\nenable_signup = )true',r'\g<1>false',s,count=1)
s=re.sub(r'(\[auth.email\][\s\S]*?\nenable_signup = )false',r'\g<1>true',s,count=1)
s=s.replace('minimum_password_length = 6','minimum_password_length = 8').replace('enable_confirmations = false','enable_confirmations = true')
if '[auth.hook.send_email]' not in s:s+='\n[auth.hook.send_email]\nenabled=true\nuri="pg-functions://postgres/public/slm_account_block_email"\n[auth.hook.send_sms]\nenabled=true\nuri="pg-functions://postgres/public/slm_account_block_sms"\n'
if '[functions.accounts]' not in s:s+='\n[functions.accounts]\nverify_jwt=false\nentrypoint="./functions/accounts/premium-behavior-local.ts"\n'
config.write_text(s,encoding='utf8')
for name in ['migrations','functions']:shutil.copytree(root/'app/supabase'/name,stack/'supabase'/name,dirs_exist_ok=True)
(stack/'supabase/functions/accounts/premium-behavior-local.ts').write_text("import {createHandler} from './handler.ts';\nconst url=Deno.env.get('SUPABASE_URL')??'';if(url!=='http://kong:8000')throw Error('Local only');\nDeno.serve(createHandler({url,anon:Deno.env.get('SUPABASE_ANON_KEY')??'',service:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',origins:['http://127.0.0.1:5192']}));\n",encoding='utf8')
print('PASS prepared NEW isolated test project, API65321; no database reset or activation')
