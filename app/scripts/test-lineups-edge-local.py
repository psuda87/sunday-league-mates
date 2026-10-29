"""Stage 2A: real GoTrue -> accounts Edge -> PostgREST -> PostgreSQL.

Creates NEW network-none containers only; no published ports, CLI/cloud config,
existing databases, APK or production entrypoint changes. Stops and retains all
fixtures. Requires Python stdlib and Docker with the pinned images available.
Passwords/JWT keys stay in process memory and the private Docker fixture config.
Run from any directory: python -X utf8 app/scripts/test-lineups-edge-local.py
"""
from pathlib import Path
import base64
import concurrent.futures
import hashlib
import hmac
from http.client import HTTPResponse, HTTPException as http_error
import json
import os
import secrets
import shutil
import subprocess
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
PG_IMAGE = 'postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b'
AUTH_IMAGE = 'public.ecr.aws/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b'
EDGE_IMAGE = 'public.ecr.aws/supabase/edge-runtime@sha256:ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8'
REST_IMAGE = 'postgrest/postgrest@sha256:5f4ce744539bbba786b4e24dbbd95bdb2a956dcf568c5374995a0ff4a68f5bd2'
NAME = 'slm-lineups-edge-' + uuid.uuid4().hex[:12]
SOURCE = ROOT / '.cache' / NAME
SECRET = secrets.token_hex(32)
started = []
passed = 0


def command(args, data=None, timeout=40):
    # Never print argv/stderr: fixture envs and HTTP bodies contain credentials.
    try:
        r = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError('Fixture command timed out: ' + args[0] + ' ' + args[1]) from None
    if r.returncode:
        raise RuntimeError('Fixture command failed: ' + args[0] + ' ' + args[1])
    return r.stdout


def sql(query):
    return command(['docker', 'exec', '-i', NAME, 'psql', '-X', '-qAt', '-U', 'postgres',
                    '-v', 'ON_ERROR_STOP=1'], query.encode('utf-8')).decode('utf-8').strip()


def start(name, image, env, args=(), mount=None):
    argv = ['docker', 'run', '--detach', '--pull=never', '--name', name,
            '--label', 'slm.fixture=lineups-edge-stage2a', '--network',
            'none' if name == NAME else 'container:' + NAME]
    for key, value in env.items():
        argv += ['-e', key + '=' + value]
    if mount:
        argv += ['--mount', 'type=bind,src=' + str(mount) + ',dst=/fixture,readonly']
    command(argv + [image] + list(args))
    started.append(name)


def jwt(role):
    def enc(value):
        return base64.urlsafe_b64encode(value).decode().rstrip('=')
    value = enc(b'{"alg":"HS256","typ":"JWT"}') + '.' + enc(json.dumps({
        'role': role, 'exp': int(time.time()) + 3600, 'iss': 'fixture-only'}).encode())
    return value + '.' + enc(hmac.new(SECRET.encode(), value.encode(), hashlib.sha256).digest())


class WireSocket:
    def __init__(self, stream):
        self.stream = stream

    def makefile(self, *args):
        return self.stream


def http(port, path, body=None, token=None):
    payload = b'' if body is None else json.dumps(body).encode('utf-8')
    head = ('GET' if body is None else 'POST') + ' ' + path + ' HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n'
    if token:
        head += 'Authorization: Bearer ' + token + '\r\n'
    if body is not None:
        head += 'Content-Type: application/json\r\nContent-Length: ' + str(len(payload)) + '\r\n'
    # Keep stdin open until the response arrives. EOF on BusyBox nc would close
    # the connection and cancel GoTrue's in-flight request context prematurely.
    transport = subprocess.Popen(['docker', 'exec', '-i', NAME, 'nc', '-w', '5', '127.0.0.1', str(port)],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    deadline = threading.Timer(15, transport.kill)
    deadline.start()
    response = None
    try:
        transport.stdin.write((head + '\r\n').encode() + payload)
        transport.stdin.flush()
        response = HTTPResponse(WireSocket(transport.stdout))
        try:
            response.begin()
        except http_error:
            return 0, {}, {}
        content = response.read()
        try:
            data = json.loads(content)
        except ValueError:
            data = {}
        return response.status, data, dict(response.getheaders())
    finally:
        deadline.cancel()
        if response is not None:
            response.close()
        transport.stdin.close()
        transport.stdout.close()
        try:
            transport.wait(timeout=.2)
        except subprocess.TimeoutExpired:
            transport.kill()
            transport.wait()


def wait_http(port, path):
    for _ in range(80):
        if http(port, path)[0] == 200:
            return
        time.sleep(.25)
    raise RuntimeError('Fixture HTTP startup failed on port ' + str(port))


def check(ok, label):
    global passed
    if not ok:
        raise AssertionError(label)
    passed += 1
    print('PASS ' + label, flush=True)


def account(user, action, expected=200, **body):
    status, data, headers = http(9000, '/functions/v1/accounts', dict(body, action=action),
                                 user['token'] if user else None)
    if status != expected:
        raise AssertionError(action + ': expected HTTP ' + str(expected) + ', got ' + str(status) + ' ' + str(data.get('code', '')))
    if expected == 200 and headers.get('cache-control') != 'no-store':
        raise AssertionError('Missing no-store on accounts response')
    return data


def write(user, action, **body):
    return account(user, action, **dict(body, request_id=str(uuid.uuid4())))


def parallel(jobs):
    barrier = threading.Barrier(len(jobs))

    def work(job):
        barrier.wait()
        return job()

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(jobs)) as pool:
        return list(pool.map(work, jobs))


def main():
    branch = command(['git', '-C', str(ROOT), 'branch', '--show-current']).decode().strip()
    assert branch == 'feat/premium-lineups-stage2a', 'Reviewed Stage 2A branch required'
    context = json.loads(command(['docker', 'context', 'inspect']))[0]
    host = context['Endpoints']['docker']['Host'] if os.environ.get('DOCKER_CONTEXT') else os.environ.get('DOCKER_HOST', context['Endpoints']['docker']['Host'])
    assert host.startswith(('unix://', 'npipe://')), 'Local Docker socket required'
    command(['docker', 'version', '--format', '{{.Server.Version}}'], timeout=20)
    for image in [PG_IMAGE, AUTH_IMAGE, REST_IMAGE, EDGE_IMAGE]:
        command(['docker', 'image', 'inspect', image])
    SOURCE.mkdir(parents=True, exist_ok=False)
    shutil.copytree(ROOT / 'app/supabase/functions', SOURCE / 'functions')
    (SOURCE / 'index.ts').write_text('''import {createHandler} from './functions/accounts/handler.ts';
const url='http://127.0.0.1:9000';
const handler=createHandler({url,anon:Deno.env.get('FIXTURE_ANON')!,service:Deno.env.get('FIXTURE_SERVICE')!,origins:[]});
// Local routing harness replaces Kong, with no access outside network-none.
Deno.serve(async(req:Request)=>{
 const u=new URL(req.url);
 if(u.pathname==='/health')return new Response('{}');
 for(const [prefix,port] of [['/auth/v1',9999],['/rest/v1',3000]] as const){
  if(u.pathname.startsWith(prefix+'/')||u.pathname===prefix){
   const target=`http://127.0.0.1:${port}${u.pathname.slice(prefix.length)||'/'}${u.search}`;
   return fetch(new Request(target,req));
  }
 }
 return handler(req);
});
''', encoding='utf-8')
    start(NAME, PG_IMAGE, {'POSTGRES_HOST_AUTH_METHOD': 'trust'})
    for _ in range(100):
        ready = subprocess.run(['docker', 'exec', NAME, 'pg_isready', '-U', 'postgres'], capture_output=True, timeout=10)
        logs = command(['docker', 'logs', NAME])
        if ready.returncode == 0 and b'init process complete' in logs:
            break
        time.sleep(.2)
    else:
        raise RuntimeError('Fresh PostgreSQL startup failed')
    sql('create role supabase_auth_admin login; create schema auth authorization supabase_auth_admin; '
        'grant all on database postgres to supabase_auth_admin; '
        'alter role supabase_auth_admin set search_path=auth,public; '
        'create role anon;create role authenticated;create role service_role bypassrls; '
        'create schema extensions;create schema storage; '
        'create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); '
        'create table storage.objects(id uuid primary key,bucket_id text,name text); '
        'grant usage on schema auth,public,storage to anon,authenticated,service_role;')
    start(NAME + '-auth', AUTH_IMAGE, {
        'GOTRUE_DB_DRIVER': 'postgres', 'GOTRUE_DB_DATABASE_URL': 'postgres://supabase_auth_admin@127.0.0.1/postgres?sslmode=disable',
        'API_EXTERNAL_URL': 'http://127.0.0.1:9000/auth/v1', 'GOTRUE_API_HOST': '127.0.0.1', 'GOTRUE_API_PORT': '9999',
        'GOTRUE_SITE_URL': 'http://127.0.0.1:9000', 'GOTRUE_JWT_SECRET': SECRET, 'GOTRUE_JWT_AUD': 'authenticated',
        'GOTRUE_JWT_ADMIN_ROLES': 'service_role', 'GOTRUE_DISABLE_SIGNUP': 'true', 'GOTRUE_MAILER_AUTOCONFIRM': 'true',
        'GOTRUE_JWT_DEFAULT_GROUP_NAME': 'authenticated',
        'GOTRUE_LOG_LEVEL': 'error', 'GOTRUE_JWT_EXP': '3600',
    })
    wait_http(9999, '/health')
    # GoTrue migrations supply auth tables AND auth.uid/jwt functions themselves.
    sql('grant select on auth.users,auth.sessions to service_role;'
        'grant execute on all functions in schema auth to anon,authenticated,service_role;')
    migrations = sorted((ROOT / 'app/supabase/migrations').glob('*.sql'))
    assert len(migrations) == 41, 'Expected exact reviewed migration set'
    for file in migrations:
        sql(file.read_text(encoding='utf-8'))
    check(True, '41 canonical migrations replay on real GoTrue Auth schema')
    sql('create role authenticator login noinherit;grant anon,authenticated,service_role to authenticator;')
    start(NAME + '-rest', REST_IMAGE, {
        'PGRST_DB_URI': 'postgresql://authenticator@127.0.0.1/postgres', 'PGRST_DB_SCHEMAS': 'public',
        'PGRST_DB_ANON_ROLE': 'anon', 'PGRST_JWT_SECRET': SECRET,
    })
    wait_http(3000, '/')
    start(NAME + '-edge', EDGE_IMAGE, {'FIXTURE_ANON': jwt('anon'), 'FIXTURE_SERVICE': jwt('service_role')},
          ['start', '--ip', '127.0.0.1', '--main-service', '/fixture'], SOURCE)
    wait_http(9000, '/health')
    users = []
    for i in range(4):
        email, password = str(uuid.uuid4()) + '@fixture.invalid', secrets.token_urlsafe(24) + 'Aa7!'
        status, user, _ = http(9999, '/admin/users', {'email': email, 'password': password, 'email_confirm': True}, jwt('service_role'))
        assert status in (200, 201), 'Local GoTrue admin fixture creation failed'
        login = account(None, 'login', identifier=email, password=password)
        encoded = login['access_token'].split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)))
        assert claims['role'] == 'authenticated', 'Real client must exercise authenticated ACL'
        users.append({'id': user['id'], 'token': login['access_token']})
    admin, member, second, outsider = users
    check(sql('select count(*) from auth.sessions') == '4', 'four real GoTrue sessions accepted through unchanged accounts login')
    group = write(admin, 'groups_create', name='Lineup Edge fixture')['group_id']
    for user in [member, second]:
        write(admin, 'groups_invite', group_id=group, user_id=user['id'])
        invitation = account(user, 'groups_inbox')['requests'][0]
        write(user, 'groups_decide', id=invitation['id'], accept=True)
    event = write(member, 'matches_create', group_id=group, name='Lineup HTTP fixture', visibility='private',
                  date='2099-01-01', time='18:00', location='Fixture only', duration_minutes=90, capacity=15, cost_cents=0)['event_id']
    for user in [member, second]:
        write(user, 'matches_join', event_id=event)
    for i in range(3):
        write(member, 'matches_guest', event_id=event, guest_name='Gość fixture ' + str(i), list='registered')

    def get(user=member):
        return account(user, 'lineups_get', event_id=event)

    def payload(state, a, b):
        return dict(event_id=event, expected_version=state['version'], expected_roster_version=state['roster_version'],
                    team_a=a, team_b=b, request_id=str(uuid.uuid4()))

    state = get()
    ids = state['unassigned']
    check(state['version'] == 0 and len(ids) == 5 and state['last_change'] is None, 'real Edge GET exposes five roster entries including three guests')
    initial = payload(state, ids[:3], ids[3:])
    saved = account(member, 'lineups_save', **initial)
    check(saved['version'] == 1 and saved['changed'] and saved['last_change']['user_id'] == member['id'] and get(second)['team_a'] == saved['team_a'], 'ordinary member commits shared A/B over real GoTrue/Edge/PostgREST')
    noop = account(second, 'lineups_save', **payload(get(), list(reversed(saved['team_a'])), saved['team_b']))
    check(not noop['changed'] and noop['version'] == 1 and noop['last_change'] == saved['last_change'], 'HTTP no-op preserves author timestamp and version')
    replay = account(member, 'lineups_save', **initial)
    check(replay['replayed'] and replay['version'] == 1, 'HTTP retry returns original receipt')
    account(outsider, 'lineups_get', expected=404, event_id=event)
    account(outsider, 'lineups_save', expected=404, **payload(get(), [], ids))
    account(member, 'lineups_save', expected=400, **dict(initial, updated_by=outsider['id']))
    check(True, 'real Edge denies private outsider read/write and forged author')
    a, b = payload(get(), ids[3:], ids[:3]), payload(get(), [], ids)
    results = parallel([lambda: http(9000, '/functions/v1/accounts', dict(a, action='lineups_save'), member['token']),
                        lambda: http(9000, '/functions/v1/accounts', dict(b, action='lineups_save'), second['token'])])
    check(sorted(r[0] for r in results) == [200, 409] and any(r[1].get('code') == 'lineup_version_conflict' for r in results) and get()['version'] == 2, 'two GoTrue clients race through Edge: one commit and one HTTP409')
    stale = get()
    write(member, 'matches_guest', event_id=event, guest_name='Nowy gość fixture', list='registered')
    account(member, 'lineups_save', expected=409, **payload(stale, [], ids))
    account(member, 'lineups_save', expected=400, **payload(get(), [str(uuid.uuid4())], []))
    check(True, 'real Edge rejects stale roster and foreign assignment')
    protected = http(3000, '/slm_match_lineups?select=*', token=member['token'])[0]
    forged = http(3000, '/rpc/slm_lineups_dispatch', dict(p_user=admin['id'], p_session=str(uuid.uuid4()), p_action='get', p_body=dict(event_id=event)), member['token'])[0]
    check(protected in (401, 403, 404) and forged in (401, 403, 404), 'GoTrue JWT cannot bypass table ACL or invoke service RPC directly')
    before = get()
    # The sidecars share the database container's network namespace. Stop them
    # first and rejoin its new namespace after restart; do not leave them in the
    # old disconnected namespace and mistake that for an application failure.
    for suffix in ['-edge', '-rest', '-auth']:
        command(['docker', 'stop', '--timeout', '5', NAME + suffix])
    command(['docker', 'restart', NAME])
    for _ in range(100):
        if subprocess.run(['docker', 'exec', NAME, 'pg_isready', '-U', 'postgres'], capture_output=True, timeout=10).returncode == 0:
            break
        time.sleep(.2)
    for suffix in ['-auth', '-rest', '-edge']:
        command(['docker', 'start', NAME + suffix])
    wait_http(9999, '/health')
    wait_http(3000, '/')
    wait_http(9000, '/health')
    # Reuse the ORIGINAL GoTrue-issued access token, without signing in again.
    for _ in range(80):
        status, after, _ = http(9000, '/functions/v1/accounts', dict(action='lineups_get', event_id=event), member['token'])
        if status == 200:
            break
        time.sleep(.25)
    check(status == 200 and after == before, 'same GoTrue client reads identical persisted snapshot after isolated backend restart')
    write(second, 'groups_leave', group_id=group)
    account(second, 'lineups_get', expected=404, event_id=event)
    account(second, 'lineups_save', expected=404, **payload(get(), [], ids))
    check(True, 'live GoTrue token loses lineup access immediately after leaving group')
    account(member, 'logout')
    account(member, 'lineups_get', expected=401, event_id=event)
    check(True, 'revoked real application session cannot read lineup')
    print('RESULT ' + str(passed) + ' PASS; real GoTrue-issued JWT -> accounts Edge -> PostgREST -> PostgreSQL. Kong/Storage/browser/Android not tested.', flush=True)


if __name__ == '__main__':
    try:
        main()
    finally:
        for name in reversed(started):
            subprocess.run(['docker', 'stop', '--timeout', '5', name], capture_output=True, timeout=25)
        if started:
            print('Stopped and retained fixture containers: ' + ', '.join(started), flush=True)
