"""Replay the read-only Cloud history + pending repo SQL ONLY in a new local DB.
Input contains schema migrations, never a Cloud data dump. Fictional data only.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/cloud-audit'
CONTAINER = 'supabase_db_sunday-league-mates'
DB = 'slm_cloud_audit_' + uuid.uuid4().hex
created = False
passed = 0

def command(args, data=None):
    return subprocess.run(['docker', 'exec', '-i', CONTAINER, *args], input=data, capture_output=True)

def sql(query):
    r = command(['psql', '-X', '-qAt', '-U', 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1'], query.encode())
    if r.returncode:
        raise RuntimeError(r.stderr.decode())
    return r.stdout.decode().strip()

def check(value, name):
    global passed
    assert value, name
    passed += 1
    print('PASS', name)

try:
    assert subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip() == 'feat/cloud-test-preparation'
    context = subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
    assert (os.environ.get('DOCKER_HOST') or context).startswith(('npipe://', 'unix://'))
    assert subprocess.check_output(['docker', 'inspect', '--format', '{{.Name}}', CONTAINER], text=True).strip() == '/' + CONTAINER
    history = json.loads((CACHE / 'cloud-history.json').read_text(encoding='utf8'))
    migrations = sorted((ROOT / 'app/supabase/migrations').glob('*.sql'))
    assert len(history) == 7 and [h['version'] for h in history] == [p.name[:14] for p in migrations[:7]]
    for h in history:
        assert hashlib.md5('\n'.join(h['statements']).encode()).hexdigest() == h['joined_md5']
    assert command(['createdb', '-U', 'postgres', '-T', 'template0', DB]).returncode == 0
    created = True
    dump = command(['pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema-only'])
    assert dump.returncode == 0
    restored = command(['psql', '-X', '-q', '-U', 'supabase_admin', '-d', DB, '-v', 'ON_ERROR_STOP=1'], dump.stdout)
    assert restored.returncode == 0, 'Local managed-schema bootstrap failed'
    sql('drop schema public cascade; drop schema slm_private cascade; drop schema if exists slm_auth_proof_private cascade; create schema public; grant usage on schema public to anon,authenticated,service_role; grant all on schema public to postgres,service_role;')
    # Cloud-managed helper is referenced only by historical REVOKE. This inert,
    # revoked scratch stub is NOT a proof of managed platform trigger behavior.
    sql("create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin return;end$$; revoke all on function public.rls_auto_enable() from public,anon,authenticated;")
    for h in history:
        sql('\n'.join(h['statements']))
    check(sql("select count(*) from pg_tables where schemaname='public' and tablename like 'slm_%'") == '13', 'exact seven Cloud migration payloads replay to thirteen SLM tables')
    cloud = json.loads((CACHE / 'cloud-metadata.json').read_text(encoding='utf8'))
    prefix = json.loads(sql((CACHE / 'metadata.sql').read_text(encoding='utf8')))
    key = lambda f: (f['schema'], f['name'], f['identity'])
    actual = {key(f): f for f in prefix['routines']}
    check(all(actual.get(key(f), {}).get('definition_md5') == f['definition_md5'] for f in cloud['routines']), 'seventeen Cloud routine definitions match historical replay')
    check(prefix['policies'] == cloud['policies'], 'Cloud RLS policies match historical replay')
    check(all(prefix[k] == cloud[k] for k in ('columns', 'constraints', 'indexes', 'triggers')), 'Cloud columns/constraints/indexes/triggers match historical replay')
    users = [str(uuid.uuid4()) for _ in range(2)]
    for i, u in enumerate(users):
        sql(f"insert into auth.users(id,aud,role,email) values('{u}','authenticated','authenticated','{u}@fixture.invalid'); select public.slm_account_provision('{u}','CloudFixture{i}','+48000000{i:03d}','{u}@fixture.invalid',null,null,{'true' if i == 0 else 'false'});")
    event = sql(f"insert into public.slm_events(starts_at,location,capacity,created_by) values(now()+interval '4 days','Fictional audit location',10,'{users[0]}') returning id")
    participant = sql(f"insert into public.slm_event_participants(event_id,member_id,responsible_user_id,status) values('{event}','{users[1]}','{users[1]}','registered') returning id")
    sql(f"insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot) select '{event}','{participant}','{users[0]}','{users[1]}','joined',now(),now()+interval '2 days',false,jsonb_build_object('participant',to_jsonb(p),'previous_status',null) from public.slm_event_participants p where id='{participant}'")
    snapshot_query = "select jsonb_build_object('aliases',(select jsonb_agg(to_jsonb(t) order by user_id) from public.slm_aliases t),'profiles',(select jsonb_agg(to_jsonb(t) order by user_id) from public.slm_profiles t),'roles',(select jsonb_agg(to_jsonb(t) order by user_id) from public.slm_roles t),'events',(select jsonb_agg(to_jsonb(t) order by id) from public.slm_events t),'participants',(select jsonb_agg(to_jsonb(t) order by id) from public.slm_event_participants t),'history',(select jsonb_agg(to_jsonb(t) order by sequence) from public.slm_event_history t))"
    before = json.loads(sql(snapshot_query))
    for p in migrations[7:]:
        sql(p.read_text(encoding='utf8'))
    after = json.loads(sql(snapshot_query))
    # Additive columns (e.g. legacy total_cost) are expected. Every original
    # column and row must retain its value; do not confuse new keys with loss.
    for table, rows in before.items():
        current = after[table]
        assert len(rows or []) == len(current or []), 'Historical row count changed: ' + table
        for old, new in zip(rows or [], current or []):
            assert all(new.get(k) == v for k, v in old.items()), 'Historical values changed: ' + table
    check(True, 'twenty-seven pending migrations preserve all original fictional account/event/entry columns and rows')
    check(sql("select count(*) from pg_tables where schemaname='public' and tablename like 'slm_%'") == '46', 'complete schema has forty-six SLM tables')
    check(sql('select count(*) from public.slm_group_members') == '2', 'legacy accounts mapped to one group with unambiguous administrator')
    check(sql('select count(*) from public.slm_group_members where share_full_name') == '0', 'all migrated per-group name consents default false')
    check(sql("select count(*) from storage.buckets where id='slm-profile-photos' and not public and file_size_limit=150000 and allowed_mime_types=array['image/webp']") == '1', 'private WebP bucket limits installed')
    final = json.loads(sql((CACHE / 'metadata.sql').read_text(encoding='utf8')))
    (CACHE / 'prefix-final-metadata.json').write_text(json.dumps(final, indent=2), encoding='utf8')
    check(not [t for t in final['tables'] if not t['rls']], 'every SLM table has RLS')
    check(not [f for f in final['routines'] if f['schema'] == 'public' and f['anon_execute']], 'no public SLM routine exposed to anon')
    print(f'RESULT {passed} PASS; exact Cloud prefix plus pending migrations, fictional data only')
finally:
    if created:
        assert DB.startswith('slm_cloud_audit_') and len(DB) == len('slm_cloud_audit_') + 32
        assert command(['dropdb', '-U', 'postgres', DB]).returncode == 0
        print('Only the newly created audit database removed; existing local and Cloud data untouched')
