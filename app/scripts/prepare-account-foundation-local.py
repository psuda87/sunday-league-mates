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
STACK = ROOT / '.cache/account-foundation-stack'
NAME = 'supabase_auth_slm-account-foundation'
args = argparse.ArgumentParser()
args.add_argument('--auth-baseline', action='store_true')
options = args.parse_args()
assert subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip() == 'feat/account-model-foundation'
host = os.environ.get('DOCKER_HOST') or subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
assert host.startswith(('npipe://', 'unix://'))
if not options.auth_baseline:
    config = STACK / 'supabase/config.toml'
    if not config.exists():
        command = ['cmd', '/c', 'npx', '--yes', '--package=supabase@2.121.0', 'supabase', 'init', '--workdir', str(STACK)]
        subprocess.run(command, cwd=ROOT, check=True, capture_output=True)
    s = config.read_text(encoding='utf8')
    s = re.sub(r'^project_id = .*$', 'project_id = "slm-account-foundation"', s, flags=re.M).replace('5432', '5732').replace('inspector_port = 8083', 'inspector_port = 8283')
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
    entry.write_text(entry.read_text(encoding='utf8').replace('origins: [', 'accountFoundationEnabled: true, origins: ['), encoding='utf8')
    print('Prepared isolated slm-account-foundation API57321; no service or existing data changed.')
else:
    c = json.loads(subprocess.check_output(['docker', 'inspect', NAME]))[0]
    assert c['Name'] == '/' + NAME and c['Config']['Labels']['com.supabase.cli.project'] == 'slm-account-foundation'
    assert all('slm-account-foundation' in n for n in c['NetworkSettings']['Networks'])
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
