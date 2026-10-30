"""Reuse ONLY the existing local slm-main-stabilization project. No reset/cloud/new project."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
PROJECT = 'slm-main-stabilization'
DB = 'supabase_db_' + PROJECT
EDGE = 'supabase_edge_runtime_' + PROJECT
STATE = ROOT / '.cache/live-backend'


def command(args, data=None):
    p = subprocess.run(args, input=data, capture_output=True, timeout=180)
    if p.returncode:
        # Never echo command output: container config/dumps may contain secrets.
        raise RuntimeError('Local command failed: ' + args[0] + ' ' + args[1])
    return p.stdout


def inspect(name):
    return json.loads(command(['docker', 'inspect', name]))[0]


def sql(query):
    return command(['docker', 'exec', '-i', DB, 'psql', '-X', '-qAt', '-U', 'postgres',
                    '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], query.encode()).decode().strip()


def versions():
    return sql('select version from supabase_migrations.schema_migrations order by version').splitlines()


def guard(require_running=True):
    host = os.environ.get('DOCKER_HOST') or command(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).decode().strip()
    assert host.startswith(('npipe://', 'unix://')), 'Local Docker socket required'
    d = inspect(DB)
    assert d['Config']['Labels']['com.supabase.cli.project'] == PROJECT
    stack = Path(d['Config']['Labels']['com.supabase.cli.workdir']).resolve()
    repo = Path(command(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir']).decode().strip()).parent
    assert stack.is_relative_to(repo / '.worktrees'), 'Unexpected stack location'
    assert 'project_id = "' + PROJECT + '"' in (stack / 'supabase/config.toml').read_text()
    assert d['State']['Running'] or not require_running, 'Start existing database deliberately before preparation'
    return stack


def fingerprint_existing():
    # Aggregate only; no account data/password/token is emitted or written here.
    names = sql("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','auth') order by 1").splitlines()
    result = {}
    for name in names:
        assert re.fullmatch(r'[a-z0-9_]+\.[a-z0-9_]+', name)
        result[name] = sql('select md5(coalesce(string_agg(to_jsonb(t)::text, chr(10) order by to_jsonb(t)::text),\'\')) from ' + name + ' t')
    return result


def verify_sources():
    approved = '58a9babf257876e47cf6db269a0bf05d2e1db1f4'
    paths = command(['git','-C',str(ROOT),'ls-tree','-r','--name-only',approved,'--',
                     'app/supabase/migrations','app/supabase/functions']).decode().splitlines()
    for path in paths:
        original = command(['git','-C',str(ROOT),'show',approved+':'+path]).replace(b'\r\n',b'\n')
        assert (ROOT/path).read_bytes().replace(b'\r\n',b'\n') == original, 'Unreviewed backend source: '+path
    return len(paths)


def prepare(stack):
    sources = ROOT / 'app/supabase'
    verify_sources()
    files = sorted((sources / 'migrations').glob('*.sql'))
    expected = [p.name.split('_')[0] for p in files]
    assert len(files) == 41 and expected[-1] == '20261029140000'
    current = versions()
    assert current in (expected[:-1], expected), 'Divergent database: do not migrate'
    cached = stack / 'supabase/migrations'
    for p in cached.glob('*.sql'):
        canonical = sources / 'migrations' / p.name
        assert canonical.exists() and canonical.read_text() == p.read_text(), 'Divergent cached migration'
    backup = STATE / ('backup-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:6])
    backup.mkdir(parents=True)
    if os.name == 'nt':
        import csv
        sid = list(csv.reader(command(['whoami', '/user', '/fo', 'csv', '/nh']).decode().splitlines()))[0][1]
        command(['icacls', str(backup), '/inheritance:r', '/grant:r', '*' + sid + ':(OI)(CI)F'])
    dump = command(['docker', 'exec', DB, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '--no-owner', '--no-acl'])
    (backup / 'database.dump').write_bytes(dump)
    assert command(['docker', 'exec', '-i', DB, 'pg_restore', '--list'], dump), 'Backup is unreadable'
    shutil.copytree(stack / 'supabase', backup / 'supabase')
    # Private restore evidence. Not printed, committed, or used to change keys.
    (backup / 'containers.private.json').write_bytes(command(['docker', 'inspect', DB, EDGE]))
    prior = fingerprint_existing()
    (backup / 'migration-state.json').write_text(json.dumps({'versions': current, 'dump_sha256': hashlib.sha256(dump).hexdigest()}, indent=2))
    print('PASS private database/config backup and pg_restore listing', flush=True)
    if current != expected:
        migration = files[-1].read_text()
        body = migration.replace('\nbegin;\n', '\n', 1)
        assert body.rstrip().endswith('commit;')
        body = body.rstrip()[:-len('commit;')]
        sql('BEGIN;\n' + body + '\nROLLBACK;')
        assert versions() == current and sql("select to_regclass('public.slm_match_lineups') is null") == 't'
        tag = '$slm_source_' + uuid.uuid4().hex + '$'
        history = "insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261029140000','match_lineups',ARRAY[" + tag + migration + tag + ']);'
        # Schema and migration receipt commit together, including postconditions.
        sql('BEGIN;\n' + body + '\n' + history + "\nDO $$BEGIN IF to_regclass('public.slm_match_lineups') IS NULL THEN RAISE EXCEPTION 'missing lineup table'; END IF; END$$;\nCOMMIT;")
        assert versions() == expected
    after = fingerprint_existing()
    assert all(after.get(name) == value for name, value in prior.items()), 'Existing data changed during migration'
    for folder in ('migrations', 'functions'):
        shutil.copytree(sources / folder, stack / 'supabase' / folder, dirs_exist_ok=True)
    entry = stack / 'supabase/functions/accounts/stabilization-local.ts'
    entry.write_text("""import {createHandler} from './handler.ts';
declare const Deno:{env:{get(n:string):string|undefined};serve(h:(r:Request)=>Promise<Response>):void};
const url=Deno.env.get('SUPABASE_URL')??'';
if(!['http://kong:8000','http://127.0.0.1:55321'].includes(url))throw Error('Local isolation required');
Deno.serve(createHandler({url,anon:Deno.env.get('SUPABASE_ANON_KEY')??'',service:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',
origins:['https://localhost','capacitor://localhost','http://127.0.0.1:5196','http://localhost:5196','http://127.0.0.1:5186','http://localhost:5186']}));
""", encoding='utf-8')
    STATE.mkdir(parents=True, exist_ok=True)
    (STATE / 'prepared.json').write_text(json.dumps({'project': PROJECT, 'api': 'http://127.0.0.1:55321', 'stack': str(stack), 'backup': str(backup), 'versions': expected}, indent=2))
    if inspect(EDGE)['State']['Running']:
        command(['docker', 'restart', EDGE])
    print('PASS 41 canonical migrations; all pre-existing public/auth rows unchanged; current Edge sources and native CORS prepared', flush=True)


def start():
    for service in ('db', 'auth', 'rest', 'storage', 'kong', 'edge_runtime'):
        name = 'supabase_' + service + '_' + PROJECT
        d = inspect(name)
        assert d['Config']['Labels']['com.supabase.cli.project'] == PROJECT
        if not d['State']['Running']:
            command(['docker', 'start', name])
    # A running container is not necessarily a ready Kong upstream. In
    # particular the first request after a cold start can be disconnected.
    import http.client
    import time
    import urllib.error
    import urllib.request
    deadline = time.monotonic() + 60
    checks = [('/auth/v1/health', 200), ('/rest/v1/', 200), ('/functions/v1/accounts', 401)]
    while time.monotonic() < deadline:
        ready = True
        for path, expected in checks:
            data = b'{"action":"status"}' if path.endswith('/accounts') else None
            req = urllib.request.Request('http://127.0.0.1:55321' + path, data=data,
                                         headers={'Content-Type':'application/json', 'Origin':'https://localhost'})
            try:
                with urllib.request.urlopen(req, timeout=2) as response:
                    status = response.status
            except urllib.error.HTTPError as error:
                status = error.code
            except (urllib.error.URLError, OSError, http.client.HTTPException):
                ready = False
                break
            if status != expected:
                ready = False
                break
        if ready:
            break
        time.sleep(.5)
    else:
        raise RuntimeError('Local services started but Auth/REST/accounts did not become ready')
    print('Started/reused the six existing local services; no containers/keys/projects created')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=['prepare', 'start', 'status'])
    a = p.parse_args()
    stack = guard(require_running=a.action != 'start')
    if a.action == 'prepare':
        prepare(stack)
    elif a.action == 'start':
        verify_sources()
        assert (stack / 'supabase/functions/accounts/handler.ts').read_text() == (ROOT / 'app/supabase/functions/accounts/handler.ts').read_text(), 'Cached Edge differs from canonical source'
        if not inspect(DB)['State']['Running']:
            command(['docker', 'start', DB])
            import time
            for _ in range(60):
                if subprocess.run(['docker','exec',DB,'pg_isready','-U','postgres'],capture_output=True).returncode == 0:
                    break
                time.sleep(.5)
            else:
                raise RuntimeError('Existing local database did not become ready')
        assert versions() == [x.name.split('_')[0] for x in sorted((ROOT / 'app/supabase/migrations').glob('*.sql'))]
        start()
    else:
        print(json.dumps({'project': PROJECT, 'api': 'http://127.0.0.1:55321', 'migrations': len(versions()), 'approved_sources': verify_sources(),
                          'services': {s: inspect('supabase_' + s + '_' + PROJECT)['State']['Status']
                                       for s in ('db','auth','rest','storage','kong','edge_runtime')}}))
