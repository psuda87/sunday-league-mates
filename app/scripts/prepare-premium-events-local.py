"""New local project only. No reset/deletion/Cloud, no account-model activation."""
import argparse,json,os,re,shlex,shutil,subprocess,tempfile,uuid
from pathlib import Path
root=Path(__file__).resolve().parents[2]
assert subprocess.check_output(['git','branch','--show-current'],cwd=root,text=True).strip()=='feat/premium-real-events-stage1'
host=os.environ.get('DOCKER_HOST') or subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
assert host.startswith(('npipe://','unix://'))
args=argparse.ArgumentParser();args.add_argument('--auth-baseline',action='store_true');options=args.parse_args()
project='slm-premium-real-events';stack=root/'.cache/premium-events-stack'
if not options.auth_baseline:
    config=stack/'supabase/config.toml'
    if not config.exists():
        r=subprocess.run(['cmd','/c','npx','--yes','--package=supabase@2.121.0','supabase','init','--workdir',str(stack)],cwd=root,capture_output=True)
        assert r.returncode==0,'Local CLI init failed; output withheld'
    s=config.read_text(encoding='utf8')
    s=re.sub(r'^project_id = .*$', 'project_id = "'+project+'"',s,flags=re.M).replace('5432','6332').replace('inspector_port = 8083','inspector_port = 8983')
    s=re.sub(r'(\[auth\][\s\S]*?\nenable_signup = )true',r'\g<1>false',s,count=1)
    s=re.sub(r'(\[auth.email\][\s\S]*?\nenable_signup = )false',r'\g<1>true',s,count=1)
    s=s.replace('minimum_password_length = 6','minimum_password_length = 8').replace('enable_confirmations = false','enable_confirmations = true')
    if '[auth.hook.send_email]' not in s:
        s+='\n[auth.hook.send_email]\nenabled=true\nuri="pg-functions://postgres/public/slm_account_block_email"\n[auth.hook.send_sms]\nenabled=true\nuri="pg-functions://postgres/public/slm_account_block_sms"\n'
    if '[functions.accounts]' not in s:s+='\n[functions.accounts]\nverify_jwt=false\nentrypoint="./functions/accounts/premium-local.ts"\n'
    config.write_text(s,encoding='utf8')
    for name in ['migrations','functions']:shutil.copytree(root/'app/supabase'/name,stack/'supabase'/name,dirs_exist_ok=True)
    (stack/'supabase/functions/accounts/premium-local.ts').write_text("""// GENERATED LOCAL ONLY. Never deploy. Candidate account model stays disabled.
import {createHandler} from './handler.ts';
const url=Deno.env.get('SUPABASE_URL')??'';
if(url!=='http://kong:8000')throw Error('Local Kong only');
Deno.serve(createHandler({url,anon:Deno.env.get('SUPABASE_ANON_KEY')??'',service:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',origins:['http://127.0.0.1:5185','http://localhost:5185']}));
""",encoding='utf8')
    print('PASS prepared exact new local project slm-premium-real-events; model remains inactive')
else:
    name='supabase_auth_'+project
    c=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
    assert c['Config']['Labels']['com.supabase.cli.project']==project
    assert all(project in n for n in c['NetworkSettings']['Networks'])
    env=dict(x.split('=',1) for x in c['Config']['Env'])
    for k in ['GOTRUE_DISABLE_SIGNUP','GOTRUE_HOOK_SEND_EMAIL_ENABLED','GOTRUE_HOOK_SEND_SMS_ENABLED']:assert env[k]=='true'
    assert env['GOTRUE_MAILER_AUTOCONFIRM']=='false'
    wanted={'GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD':'true','GOTRUE_EXTERNAL_EMAIL_ENABLED':'true'}
    if all(env.get(k)==v for k,v in wanted.items()):print('PASS isolated Auth baseline unchanged')
    else:
        env.update(wanted)
        f=tempfile.NamedTemporaryFile(mode='w',suffix='.env',prefix='slm-premium-events-',delete=False,encoding='utf8');f.write('\n'.join(k+'='+v for k,v in env.items()));f.close()
        try:
            subprocess.run(['docker','stop',name],check=True,capture_output=True)
            subprocess.run(['docker','rename',name,name+'_baseline_'+uuid.uuid4().hex[:8]],check=True,capture_output=True)
            command=['docker','create','--name',name,'--network',next(iter(c['NetworkSettings']['Networks'])),'--env-file',f.name,'--restart','unless-stopped']
            for k,v in c['Config']['Labels'].items():command+=['--label',k+'='+v]
            h=c['Config']['Healthcheck'];command+=['--health-cmd',h['Test'][1] if h['Test'][0]=='CMD-SHELL' else shlex.join(h['Test'][1:])]
            for k,flag in [('Interval','--health-interval'),('Timeout','--health-timeout'),('StartPeriod','--health-start-period')]:
                if h.get(k):command+=[flag,str(h[k])+'ns']
            if h.get('Retries'):command+=['--health-retries',str(h['Retries'])]
            command+=[c['Config']['Image']]+(c['Config'].get('Cmd') or [])
            subprocess.run(command,check=True,capture_output=True);subprocess.run(['docker','start',name],check=True,capture_output=True)
            print('PASS exact new Auth baseline; prior container retained, database unchanged')
        finally:os.unlink(f.name)
