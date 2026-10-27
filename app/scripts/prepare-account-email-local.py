"""Prepare ONLY the isolated account foundation local stack. Never reset a DB or contact Cloud."""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[2]
STACK = ROOT / '.cache/account-email-stack'
NAME = 'supabase_auth_slm-account-mail'
args = argparse.ArgumentParser()
args.add_argument('--auth-baseline', action='store_true')
args.add_argument('--readiness',action='store_true')
args.add_argument('--mail',action='store_true')
args.add_argument('--protection',action='store_true')
options = args.parse_args()
PROJECT='slm-online-readiness' if options.readiness else 'slm-account-mail'
STACK=ROOT/('.cache/online-readiness-stack' if options.readiness else '.cache/account-email-stack')
NAME='supabase_auth_'+PROJECT
branch = subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip()
assert branch == 'feat/account-model-foundation' or (branch == 'chore/online-readiness' and options.readiness), 'Only foundation or explicit isolated readiness preparation allowed'
host = os.environ.get('DOCKER_HOST') or subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
assert host.startswith(('npipe://', 'unix://'))
if not options.auth_baseline:
    config = STACK / 'supabase/config.toml'
    if not config.exists():
        command = ['cmd', '/c', 'npx', '--yes', '--package=supabase@2.121.0', 'supabase', 'init', '--workdir', str(STACK)]
        subprocess.run(command, cwd=ROOT, check=True, capture_output=True)
    s = config.read_text(encoding='utf8')
    s = re.sub(r'^project_id = .*$', 'project_id = "'+PROJECT+'"', s, flags=re.M).replace('5432', '6232' if options.readiness else '6032').replace('inspector_port = 8083', 'inspector_port = 8883' if options.readiness else 'inspector_port = 8683')
    s = s.replace('minimum_password_length = 6', 'minimum_password_length = 8').replace('enable_confirmations = false', 'enable_confirmations = true')
    # CLI auth.email.enable_signup also selects the provider; global signup stays off.
    s = re.sub(r'(\[auth\][\s\S]*?\nenable_signup = )true', r'\g<1>false', s, count=1)
    s = re.sub(r'(\[auth.email\][\s\S]*?\nenable_signup = )false', r'\g<1>true', s, count=1)
    if '[auth.hook.send_email]' not in s:
        s += '\n[auth.hook.send_email]\nenabled = true\nuri = "pg-functions://postgres/public/slm_account_block_email"\n[auth.hook.send_sms]\nenabled = true\nuri = "pg-functions://postgres/public/slm_account_block_sms"\n'
    if '[functions.accounts]' not in s:
        s += '\n[functions.accounts]\nverify_jwt = false\nentrypoint = "./functions/accounts/local-entrypoint.example.ts"\n'
    config.write_text(s, encoding='utf8')
    for name in ('migrations', 'functions'):
        shutil.copytree(ROOT / 'app/supabase' / name, STACK / 'supabase' / name, dirs_exist_ok=True)
    entry = STACK / 'supabase/functions/accounts/local-entrypoint.example.ts'
    probe=subprocess.run(['docker','inspect','supabase_inbucket_'+PROJECT],capture_output=True)
    mail_ip=''
    if probe.returncode==0:
        mail=json.loads(probe.stdout)[0]
        assert mail['Config']['Labels']['com.supabase.cli.project']==PROJECT
        mail_ip=next(iter(mail['NetworkSettings']['Networks'].values()))['IPAddress']
    mail_setup = "import {smtpEmail} from './emailSmtp.ts';\ndeclare const EdgeRuntime:{waitUntil(task:Promise<unknown>):void};\nconst mailSettings:Record<string,string>={SLM_ACCOUNT_EMAIL_ENABLED:'true',SLM_EMAIL_LOCAL_TEST:'true',SMTP_HOST:'supabase_inbucket_'+PROJECT,SMTP_PORT:'1025',SMTP_FROM:'noreply@slm-mail.test',SLM_EMAIL_CALLBACK_URL:'http://127.0.0.1:5182/email-callback.html'};\n"
    content=entry.read_text(encoding='utf8').replace('origins: [', "email:smtpEmail(name=>mailSettings[name],url,task=>EdgeRuntime.waitUntil(task)), accountModelEnabled: true, origins: ['http://127.0.0.1:5182',")
    mail_setup=mail_setup.replace("'supabase_inbucket_'+PROJECT","'supabase_inbucket_"+PROJECT+"'")
    mail_setup=mail_setup.replace('supabase_inbucket_slm-account-mail','supabase_inbucket_'+PROJECT)
    if options.readiness and not options.mail:mail_setup=mail_setup.replace("SLM_ACCOUNT_EMAIL_ENABLED:'true'","SLM_ACCOUNT_EMAIL_ENABLED:'false'")
    if options.readiness and options.protection:
        import secrets
        secret_path=ROOT/'.cache/readiness-proxy-secret'
        if not secret_path.exists():secret_path.write_text(secrets.token_hex(32),encoding='utf8')
        proof_secret=secret_path.read_text(encoding='utf8').strip()
        (ROOT/'.cache/readiness-proxy.env').write_text('SLM_PROXY_SECRET='+proof_secret+'\n',encoding='utf8')
        content=content.replace('accountModelEnabled: true,',"accountModelEnabled: true,onlineRequired:true,online:{proxySecret:Deno.env.get('SLM_PROXY_SECRET')??'',turnstileSecret:'isolated-provider-fixture',hostnames:['auth.slm.test'],fetcher:async(_url,input)=>{const token=JSON.parse(String(input?.body??'{}')).response??'';return new Response(JSON.stringify({success:token.startsWith('fixture:'),hostname:'auth.slm.test',action:'slm_signup',cdata:token.slice(8),challenge_ts:new Date().toISOString()}),{headers:{'Content-Type':'application/json'}});}},")
    entry.write_text((mail_setup+content).replace("SMTP_PORT:'1025'","SMTP_PORT:'1025',SMTP_LOCAL_ADDRESS:'"+mail_ip+"'" if mail_ip else "SMTP_PORT:'1025'"),encoding='utf8')
    print('Prepared isolated '+PROJECT+'; no existing project changed.')
else:
    c = json.loads(subprocess.check_output(['docker', 'inspect', NAME]))[0]
    assert c['Name'] == '/' + NAME and c['Config']['Labels']['com.supabase.cli.project'] == PROJECT
    assert all(PROJECT in n for n in c['NetworkSettings']['Networks'])
    env = dict(x.split('=', 1) for x in c['Config']['Env'])
    assert env['GOTRUE_DISABLE_SIGNUP'] == 'true' and env['GOTRUE_MAILER_AUTOCONFIRM'] == 'false'
    assert env['GOTRUE_HOOK_SEND_EMAIL_ENABLED'] == 'true' and env['GOTRUE_HOOK_SEND_SMS_ENABLED'] == 'true'
    wanted = {'GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD': 'true', 'GOTRUE_EXTERNAL_EMAIL_ENABLED': 'true'}
    if all(env.get(k) == v for k, v in wanted.items()):
        print('Isolated Auth baseline already matches; no restart.')
    else:
        env.update(wanted)
        f = tempfile.NamedTemporaryFile(mode='w', suffix='.env', prefix='slm-foundation-auth-', delete=False, encoding='utf8')
        f.write('\n'.join(k + '=' + v for k, v in env.items())); f.close()
        try:
            subprocess.run(['docker', 'stop', NAME], check=True, capture_output=True)
            subprocess.run(['docker', 'rename', NAME, NAME + '_before_baseline_' + uuid.uuid4().hex[:8]], check=True, capture_output=True)
            command = ['docker', 'create', '--name', NAME, '--network', next(iter(c['NetworkSettings']['Networks'])), '--env-file', f.name, '--restart', 'unless-stopped']
            for k, v in c['Config']['Labels'].items():
                command += ['--label', k + '=' + v]
            health = c['Config']['Healthcheck']; test = health['Test']
            command += ['--health-cmd', test[1] if test[0] == 'CMD-SHELL' else shlex.join(test[1:])]
            for k, flag in [('Interval', '--health-interval'), ('Timeout', '--health-timeout'), ('StartPeriod', '--health-start-period')]:
                if health.get(k): command += [flag, str(health[k]) + 'ns']
            if health.get('Retries'): command += ['--health-retries', str(health['Retries'])]
            command += [c['Config']['Image']] + (c['Config'].get('Cmd') or [])
            subprocess.run(command, check=True, capture_output=True)
            subprocess.run(['docker', 'start', NAME], check=True, capture_output=True)
            print('Only isolated Auth baseline adjusted; prior container retained stopped, database unchanged.')
        finally:
            os.unlink(f.name)
