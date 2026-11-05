"""Replay canonical sources in a fresh scratch DB of slm-main-stabilization.
Never resets, migrates, or deletes the existing postgres database or real users.
SQL/RLS/FK tests use real local PostgreSQL; SMTP/GoTrue/Storage HTTP use unit tests.
"""
import os
from pathlib import Path
import subprocess
import uuid

CONTAINER = 'supabase_db_slm-main-stabilization'
DATABASE = 'slm_privacy_test_' + uuid.uuid4().hex
assert DATABASE.startswith('slm_privacy_test_') and len(DATABASE) == 49
APP = Path(__file__).resolve().parents[1]

def docker(args, data=None):
    r = subprocess.run(['docker', *args], input=data, capture_output=True)
    if r.returncode:
        raise RuntimeError(r.stderr.decode(errors='replace')[-7000:])
    return r.stdout

def sql(text, role='postgres'):
    return docker(['exec', '-i', CONTAINER, 'psql', '-X', '-qAt', '-U', role,
                   '-d', DATABASE, '-v', 'ON_ERROR_STOP=1'], text.encode()).decode()

host = os.environ.get('DOCKER_HOST') or docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).decode().strip()
assert host.startswith(('npipe://', 'unix://')), 'Only local Docker'
assert docker(['inspect', '--format', '{{.Name}}', CONTAINER]).decode().strip() == '/' + CONTAINER
created = False
try:
    docker(['exec', CONTAINER, 'createdb', '-U', 'postgres', '-T', 'template0', DATABASE])
    created = True
    dump = docker(['exec', CONTAINER, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema-only'])
    docker(['exec', '-i', CONTAINER, 'psql', '-X', '-q', '-U', 'supabase_admin', '-d', DATABASE,
            '-v', 'ON_ERROR_STOP=1'], dump)
    # This is the generated, schema-only scratch DB, checked above, never postgres.
    sql('drop schema public cascade; drop schema if exists slm_private cascade; '
        'drop schema if exists slm_auth_proof_private cascade; create schema public; '
        'grant usage on schema public to anon,authenticated,service_role; '
        'grant all on schema public to postgres,service_role;', 'supabase_admin')
    files = sorted((APP / 'supabase/migrations').glob('*.sql'))
    for migration in files:
        try:
            sql(migration.read_text(encoding='utf-8'))
        except RuntimeError as ex:
            raise RuntimeError(migration.name + '\n' + str(ex)) from ex
    print('PASS replay', len(files), 'canonical migrations', flush=True)
    sql((APP / 'supabase/tests/minimum_phone.sql').read_text(encoding='utf-8'))
    print('PASS existing minimum_phone SQL/security contract', flush=True)
    print(sql((APP / 'supabase/tests/account_privacy.sql').read_text(encoding='utf-8')), flush=True)
finally:
    if created:
        assert DATABASE.startswith('slm_privacy_test_') and DATABASE != 'postgres'
        docker(['exec', CONTAINER, 'dropdb', '-U', 'postgres', DATABASE])
