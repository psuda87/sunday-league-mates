"""Local Android preparation only. Never prints Supabase status keys or raw logs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error
import zipfile

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'app'
DB = 'supabase_db_sunday-league-mates'
BASE = 'http://127.0.0.1:54321'
APK = APP / 'android/app/build/outputs/apk/debug/app-debug.apk'
CLI = ['cmd', '/c', 'npx', '--yes', '--package=supabase@2.121.0', 'supabase']

def run(args, **kwargs):
    return subprocess.run(args, cwd=APP, capture_output=True, **kwargs)

def required(args):
    result = run(args)
    if result.returncode:
        raise RuntimeError('Local operation failed: ' + Path(str(args[0])).name + '; raw output suppressed')
    return result.stdout

def guard():
    branch = required(['git', 'branch', '--show-current']).decode().strip()
    if branch not in ('feat/integration', 'chore/android-phone-readiness'):
        raise RuntimeError('Requires an approved local integration/readiness branch; no automatic checkout')
    host = os.environ.get('DOCKER_HOST') or required(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).decode().strip()
    if not host.startswith(('npipe://', 'unix://')):
        raise RuntimeError('Only a local Docker socket is allowed')

def http(path, method='GET', body=None, origin=None, key=None):
    headers = {'Content-Type': 'application/json'}
    if origin:
        headers['Origin'] = origin
        if method == 'OPTIONS':
            headers['Access-Control-Request-Method'] = 'POST'
            headers['Access-Control-Request-Headers'] = 'authorization,content-type'
    if key:
        headers['apikey'] = key
    req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status, response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.headers

def edge_ready():
    try:
        return http('/functions/v1/accounts', 'POST', {'action': 'profile'})[0] == 401
    except (OSError, TimeoutError):
        return False

def backend_check():
    guard()
    required(['docker', 'exec', DB, 'pg_isready', '-U', 'postgres', '-d', 'postgres'])
    versions = required(['docker', 'exec', DB, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-c', 'select version from supabase_migrations.schema_migrations order by version']).decode().splitlines()
    expected = [p.name[:14] for p in sorted((APP / 'supabase/migrations').glob('*.sql'))]
    if versions != expected:
        raise RuntimeError('Local migration history differs from repository; do not reset or apply remotely')
    # Keys are used only in memory. Never forward CLI output to a terminal/file.
    raw = required(CLI + ['status', '-o', 'json']).decode()
    status = json.loads(raw[raw.index('{'):])
    if status.get('API_URL') != BASE:
        raise RuntimeError('Local Supabase API URL mismatch')
    if http('/auth/v1/health', key=status['ANON_KEY'])[0] != 200:
        raise RuntimeError('Local Auth is unavailable')
    config = json.loads(required(['docker', 'inspect', 'supabase_auth_sunday-league-mates']))[0]
    env = dict(value.split('=', 1) for value in config['Config']['Env'])
    safe = {'GOTRUE_DISABLE_SIGNUP': 'true', 'GOTRUE_HOOK_SEND_EMAIL_ENABLED': 'true', 'GOTRUE_HOOK_SEND_SMS_ENABLED': 'true', 'GOTRUE_HOOK_SEND_EMAIL_URI': 'pg-functions://postgres/public/slm_account_block_email', 'GOTRUE_HOOK_SEND_SMS_URI': 'pg-functions://postgres/public/slm_account_block_sms'}
    if any(env.get(k) != v for k, v in safe.items()):
        raise RuntimeError('Local Auth safety settings are not ready; run Backend action')
    if not edge_ready():
        raise RuntimeError('Local accounts Edge Function is unavailable')
    for origin in ('https://localhost', 'capacitor://localhost'):
        code, headers = http('/functions/v1/accounts', 'OPTIONS', origin=origin)
        if code not in (200, 204) or headers.get('Access-Control-Allow-Origin') not in (origin, '*'):
            raise RuntimeError('Native origin rejected by local CORS')
        if http('/functions/v1/accounts', 'POST', {'action': 'profile'}, origin=origin)[0] != 401:
            raise RuntimeError('Native origin must reach protected handler without bypassing Auth')
    # Kong may answer browser preflight generically; the actual handler must reject POST.
    if http('/functions/v1/accounts', 'POST', {'action': 'profile'}, origin='https://untrusted.fixture.invalid')[0] != 403:
        raise RuntimeError('Untrusted CORS origin must be rejected')
    if http('/functions/v1/push-worker', 'POST', {})[0] != 403:
        raise RuntimeError('Worker must reject a request without its secret')
    print('PASS local PostgreSQL, %d migrations, Auth, native CORS, protected Edge and worker' % len(versions))

def backend_start():
    guard()
    active = run(['docker', 'inspect', '--format', '{{.State.Running}}', DB])
    if active.returncode or active.stdout.strip() != b'true':
        # Vector is an optional log collector with a known local socket problem.
        # Do not ignore health checks or expose the Docker daemon over TCP.
        result = run(CLI + ['start', '--exclude', 'vector'])
        if result.returncode:
            raise RuntimeError('Local Supabase start failed; no reset performed, keys suppressed')
    for script in ('configure-auth-local.py', 'prepare-edge-local.py'):
        required([sys.executable, str(APP / 'scripts' / script)])
    if edge_ready():
        backend_check()
        print('Existing local Edge service preserved; no second server started')
        return
    command = CLI + ['functions', 'serve', '--workdir', str(ROOT / '.cache/http-edge'), '--env-file', str(ROOT / '.cache/http-edge/worker.env')]
    child = subprocess.Popen(command, cwd=APP, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            if child.poll() is not None:
                raise RuntimeError('Local Edge runtime exited; raw output suppressed')
            if edge_ready():
                backend_check()
                print('Local backend ready. Keep this terminal open; Ctrl+C stops only this Edge process.')
                child.wait()
                return
            time.sleep(0.5)
        raise RuntimeError('Local Edge readiness timed out; no database reset performed')
    finally:
        if child.poll() is None:
            child.terminate()

def verify_apk(write_report=False):
    if not APK.is_file():
        raise RuntimeError('Debug APK missing; run Build action')
    with zipfile.ZipFile(APK) as bundle:
        config = json.loads(bundle.read('assets/capacitor.config.json'))
        if config.get('appId') != 'pl.psuda87.slm' or config.get('appName') != 'Sunday League Mates':
            raise RuntimeError('APK application identity mismatch')
        if config.get('loggingBehavior') != 'none' or config.get('android', {}).get('webContentsDebuggingEnabled') is not False:
            raise RuntimeError('APK must disable bridge and WebView debugging logs')
        if config.get('android', {}).get('allowMixedContent') is not True:
            raise RuntimeError('Expected local debug-only mixed content configuration')
        count = 0
        for source in (APP / 'dist').rglob('*'):
            if source.is_file():
                relative = source.relative_to(APP / 'dist').as_posix()
                if bundle.read('assets/public/' + relative) != source.read_bytes():
                    raise RuntimeError('APK does not match current dist: ' + relative)
                count += 1
        html = bundle.read('assets/public/index.html').decode()
        js = b'\n'.join(bundle.read(name) for name in bundle.namelist() if re.fullmatch(r'assets/public/assets/index-[^/]+\.js', name))
        if not count or BASE.encode() not in js or '/demo/' in html or 'AccountDemo' in js.decode(errors='ignore'):
            raise RuntimeError('APK must contain the live local integration, not demo')
        for marker in (b'groups_list', b'matches_list', b'group_finance_account'):
            if marker not in js:
                raise RuntimeError('Live integration marker missing')
        plugins = json.loads(bundle.read('assets/capacitor.plugins.json'))
        if not any('SecureStorage' in str(plugin) for plugin in plugins):
            raise RuntimeError('Native secure token storage plugin missing')
    sdk = Path(os.environ.get('ANDROID_HOME') or (Path.home() / 'AppData/Local/Android/Sdk'))
    tools = sorted((sdk / 'build-tools').glob('*'), key=lambda path: [int(v) for v in path.name.split('.') if v.isdigit()])[-1]
    badging = required([str(tools / 'aapt2.exe'), 'dump', 'badging', str(APK)]).decode(errors='replace')
    if "package: name='pl.psuda87.slm'" not in badging or 'application-debuggable' not in badging:
        raise RuntimeError('APK package/debuggable manifest mismatch')
    required([str(tools / 'apksigner.bat'), 'verify', str(APK)])
    report = {'apk': str(APK), 'bytes': APK.stat().st_size, 'sha256': hashlib.sha256(APK.read_bytes()).hexdigest(), 'head': required(['git', 'rev-parse', 'HEAD']).decode().strip(), 'backend': BASE, 'application_id': 'pl.psuda87.slm', 'dist_files_verified': count, 'device_tested': False}
    if write_report:
        cache = ROOT / '.cache'; cache.mkdir(exist_ok=True)
        (cache / 'android-phone-build.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))

def release_guard():
    result = run([str(APP / 'android/gradlew.bat'), '-p', 'android', ':app:assembleRelease', '--dry-run'])
    text = (result.stdout + result.stderr).decode(errors='replace')
    if result.returncode == 0 or 'Local Android transport is forbidden in release builds' not in text:
        raise RuntimeError('Expected release guard did not reject the local debug configuration')
    print('PASS release guard: local configuration rejected before task execution')

def logs(adb, serial):
    if not serial:
        raise RuntimeError('Explicit device serial required')
    pid = required([adb, '-s', serial, 'shell', 'pidof', 'pl.psuda87.slm']).decode().strip()
    if not pid.isdigit():
        raise RuntimeError('Application must be running before log collection')
    child = subprocess.Popen([adb, '-s', serial, 'logcat', '--pid=' + pid, '-v', 'threadtime'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding='utf-8', errors='replace')
    try:
        for line in child.stdout:
            if re.search(r'password|access_token|refresh_token|authorization|service_role|apikey|private.key|sbp_|sb_secret_|Bearer\s', line, re.I):
                print('[Sensitive diagnostic line omitted]', flush=True)
                continue
            line = re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[TOKEN OMITTED]', line)
            line = re.sub(r'[A-Za-z0-9_.+%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[EMAIL OMITTED]', line)
            print(line.rstrip(), flush=True)
    finally:
        child.terminate()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['check', 'backend', 'verify-apk', 'release-guard', 'logs'])
    parser.add_argument('--write-report', action='store_true')
    parser.add_argument('--adb')
    parser.add_argument('--serial')
    args = parser.parse_args()
    try:
        if args.action == 'check': backend_check()
        elif args.action == 'backend': backend_start()
        elif args.action == 'verify-apk': verify_apk(args.write_report)
        elif args.action == 'release-guard': release_guard()
        elif args.action == 'logs': logs(args.adb, args.serial)
    except KeyboardInterrupt:
        print('Stopped own local helper; no database or device data deleted')
    except Exception as error:
        # Do not serialize HTTP errors, command output, env or credentials.
        print('FAIL: ' + (str(error) if isinstance(error, RuntimeError) else 'Local preparation failed; raw diagnostics suppressed'))
        sys.exit(1)
