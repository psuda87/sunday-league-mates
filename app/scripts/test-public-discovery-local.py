"""Public discovery ONLY: new retained network-none PostgreSQL fixture.
Auth/Storage schemas are minimal test contracts, NOT GoTrue/Edge/HTTP E2E.
No reset, existing DB, Cloud endpoint, published port or production credential.
"""
from pathlib import Path
import json
import os
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
BASE = 'e04d9a47560de36657da76f12ae63e20ef2299cb'
AUDIT_BASE = '24a59e104bfe80b4d2f41cbd0ad02b58fc546040'
MIGRATION = '20261030090000_public_match_discovery.sql'
IMAGE = 'postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b'


def require(value, label):
    if not value:
        raise RuntimeError(label)


require(os.environ.get('GITHUB_ACTIONS') != 'true', 'Separate local discovery runner; CI requires owner source review')
branch = subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip()
require(branch in ('feat/public-match-discovery', 'audit/public-match-discovery-backend', 'feat/public-match-discovery-stage2b'), 'Discovery or exact audit branch required')
if branch in ('audit/public-match-discovery-backend', 'feat/public-match-discovery-stage2b'):
    require(subprocess.run(['git', 'merge-base', '--is-ancestor', AUDIT_BASE, 'HEAD'], cwd=ROOT, capture_output=True).returncode == 0, 'Exact audit base ancestry required')
    for name in ('app/supabase/migrations/' + MIGRATION, 'app/supabase/functions/accounts/handler.ts'):
        require((ROOT / name).read_bytes().replace(b'\r\n',b'\n') == subprocess.check_output(['git', 'show', AUDIT_BASE + ':' + name], cwd=ROOT).replace(b'\r\n',b'\n'), 'Audit backend source changed')
require(subprocess.run(['git', 'merge-base', '--is-ancestor', BASE, 'HEAD'], cwd=ROOT, capture_output=True).returncode == 0, 'Exact approved base ancestry required')
endpoint = subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
require(endpoint.startswith(('unix://', 'npipe://')) and (not os.environ.get('DOCKER_HOST') or os.environ['DOCKER_HOST'].startswith(('unix://', 'npipe://'))), 'Local Docker socket required')
for key in ('SUPABASE_URL', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'PGHOST'):
    require(not os.environ.get(key), 'External database configuration is not permitted')
sources = ROOT / 'app/supabase/migrations'
historical = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASE, '--', 'app/supabase/migrations'], cwd=ROOT, text=True).splitlines()
require(len(historical) == 41 and sorted(p.name for p in sources.glob('*.sql')) == sorted([p.split('/')[-1] for p in historical] + [MIGRATION]), 'Exact historical41 plus discovery migration required')
for name in historical:
    require((ROOT / name).read_bytes().replace(b'\r\n',b'\n') == subprocess.check_output(['git', 'show', BASE + ':' + name], cwd=ROOT).replace(b'\r\n',b'\n'), 'Historical migration changed')
subprocess.run(['docker', 'image', 'inspect', IMAGE], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
NAME = 'slm-public-discovery-' + uuid.uuid4().hex[:12]
passed = 0


def sql(query, expected=None):
    r = subprocess.run(['docker', 'exec', '-i', NAME, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input=query, text=True, capture_output=True)
    if expected:
        require(r.returncode != 0 and any(code in r.stderr for code in expected.split('|')), 'Expected SQL denial: ' + expected)
        return None
    if r.returncode:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()


def lit(value):
    return "'" + str(value).replace("'", "''") + "'"


def rpc(i, module, action, body=None, expected=None):
    result = sql('begin;set local role service_role;select public.slm_' + module + '_dispatch(' + ','.join([
        lit(users[i]), lit(sessions[i]), lit(action), lit(json.dumps(body or {})) + '::jsonb']) + ');commit;', expected)
    return json.loads(result) if result else None


def write(i, module, action, **body):
    return rpc(i, module, action, dict(body, request_id=str(uuid.uuid4())))


def feed(i=1, **body):
    return rpc(i, 'matches', 'list', dict(period='upcoming', **body))


def ids(value):
    return [x['id'] for x in value['events']]


def check(value, label):
    global passed
    require(value, label)
    passed += 1
    print('PASS ' + label, flush=True)


users = [str(uuid.uuid4()) for _ in range(5)]
sessions = [str(uuid.uuid4()) for _ in users]
started = False
try:
    subprocess.run(['docker', 'run', '--detach', '--pull=never', '--name', NAME, '--network', 'none', '--label', 'slm.fixture=public-discovery',
                    '--memory=1g', '--cpus=2', '--pids-limit=512', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE], check=True, stdout=subprocess.DEVNULL)
    started = True
    print('New retained isolated fixture: ' + NAME, flush=True)
    for _ in range(100):
        ready = subprocess.run(['docker', 'exec', NAME, 'pg_isready', '-U', 'postgres'], capture_output=True)
        logs = subprocess.run(['docker', 'logs', NAME], capture_output=True)
        if ready.returncode == 0 and b'init process complete' in logs.stdout:
            break
        time.sleep(.2)
    else:
        raise RuntimeError('Fresh PostgreSQL unavailable')
    sql((ROOT / 'app/supabase/tests/support/profile_contract_bootstrap.sql').read_text())
    sql("alter table auth.users add column aud text,add column role text,add column raw_user_meta_data jsonb default '{}'::jsonb,add column deleted_at timestamptz,add column raw_app_meta_data jsonb default '{}'::jsonb;")
    for name in historical:
        sql((ROOT / name).read_text())
    before = sql("select pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure)")
    untouched = sql("select string_agg(pg_get_functiondef(p.oid),E'\\n' order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','slm_private') and (p.proname like '%finance%' or p.proname like '%account%' or p.proname like '%groups%' or p.proname like '%lineup%')")
    catalog = sql("select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p")
    broken = (sources / MIGRATION).read_text().replace("if p_action='list' then", "if p_action='UNREVIEWED' then", 1)
    sql(broken, expected='match_list_contract_changed')
    check(sql("select to_regprocedure('slm_private.match_discovery_list(uuid,uuid,jsonb)') is null") == 't' and sql("select pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure)") == before, 'migration mismatch rolls back atomically, no partial helper or dispatcher')
    sql((sources / MIGRATION).read_text())
    check(sql("select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p") == catalog, 'all preexisting RLS policy definitions unchanged')
    check(sql("select string_agg(pg_get_functiondef(p.oid),E'\\n' order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','slm_private') and (p.proname like '%finance%' or p.proname like '%account%' or p.proname like '%groups%' or p.proname like '%lineup%')") == untouched, 'Auth/group/finance/lineup functions unchanged by migration42')
    after = sql("select pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure)")
    a = before.index(" if p_action='list' then\n"); b = before.index(" if p_action<>'create' then", a)
    replacement = " if p_action='list' then\n  return slm_private.match_discovery_list(p_user,p_session,p_body);\n end if;\n"
    check(after.replace(replacement, before[a:b]) == before, 'only list branch changed; every mutation/detail byte preserved')
    sql((ROOT / 'app/supabase/tests/public_match_discovery.sql').read_text())
    check(True, 'service-only invoker ACL/RLS/search_path and no Auth18')
    for i, (user, session) in enumerate(zip(users, sessions)):
        sql(f"insert into auth.users(id,email) values('{user}','{user}@fixture.invalid');select public.slm_account_provision('{user}','Discovery_{i:03d}','+48930000{i:03d}','{user}@fixture.invalid',null,null,false);update public.slm_account_security set must_change_password=false where user_id='{user}';insert into auth.sessions(id,user_id) values('{session}','{user}');select public.slm_account_accept_session('{user}','{session}',1);")
    ga = write(0, 'groups', 'create', name='Alfa grupa fixture', description='PRIVATE DESCRIPTION A')['group_id']
    gc = write(0, 'groups', 'create', name='Gamma grupa fixture')['group_id']
    gb = write(2, 'groups', 'create', name='Orion grupa fixture', description='PRIVATE DESCRIPTION B')['group_id']
    for group, member in [(ga, 1), (gc, 1), (ga, 4)]:
        write(0, 'groups', 'invite', group_id=group, user_id=users[member])
        inv = rpc(member, 'groups', 'inbox')['requests'][0]
        write(member, 'groups', 'decide', id=inv['id'], accept=True)

    def create(i, group, name, visibility='private', **extra):
        body = dict(group_id=group, name=name, visibility=visibility, starts_at='2099-01-01T18:00:00Z',
                    location='Wyłącznie fikcyjne boisko', duration_minutes=90, capacity=15, cost_cents=0)
        body.update(extra)
        return write(i, 'matches', 'create', **body)['event_id']

    own = create(0, ga, 'Własny mecz Alfa')
    own2 = create(0, gc, 'Własny mecz Gamma')
    private = create(2, gb, 'TAJNY ORION MECZ')
    public = create(2, gb, 'Nocne granie', 'public')
    polish = create(0, gc, 'Żółty Orlik 100%_')
    # The latter is public; no account/profile is fabricated by list reads.
    sql(f"update public.slm_matches set visibility='public' where id='{polish}'")
    old = create(2, gb, 'Dawny publiczny', 'public')
    sql(f"update public.slm_matches set starts_at=now()-interval '3 hours' where id='{old}'")
    cancelled = create(2, gb, 'Odwołany publiczny', 'public')
    write(2, 'matches', 'cancel', event_id=cancelled, reason='Fikcyjny test')
    snapshot = feed()
    check(set(ids(snapshot)) == {own, own2, public, polish}, 'default feed is current groups plus future public, no foreign private/history/cancelled')
    check(set(ids(feed(scope='groups'))) == {own, own2, polish}, 'groups scope aggregates actual memberships across two groups')
    check(set(ids(feed(3, scope='groups'))) == set() and set(ids(feed(3))) == {public, polish}, 'new user without groups discovers only future public')
    check(set(ids(feed(scope='public'))) == {public, polish}, 'public scope includes own and foreign public only')
    check(set(ids(feed(scope='group', group_id=gb))) == {public}, 'foreign group UUID cannot expose private rows')
    check(ids(feed(scope='public', query='ORION')) == [public], 'case-insensitive public search by organizing group name')
    check(ids(feed(scope='public', query='nocne')) == [public], 'public search by match name')
    check(ids(feed(scope='public', query='  żółty  ')) == [polish], 'Polish case and outer whitespace handled by server')
    check(ids(feed(scope='public', query='%_')) == [polish] and not ids(feed(scope='public', query="%' OR true --")), 'wildcards and SQL-like input are literal text')
    check(not ids(feed(scope='public', query='TAJNY')) and not ids(feed(scope='public', query='no-such-fixture')), 'private names are not searchable, no-results list is empty')
    check(set(ids(feed(scope='public', query=' '))) == {public, polish}, 'empty search resets to bounded public feed')
    for bad in [{'query': 123}, {'query': None}, {'query': []}, {'query': 'x'*101}, {'scope': 'all', 'query': 'Alfa'},
                {'scope': 'unknown'}, {'period': 'unknown'}, {'offset': -1}, {'offset': 1.5}, {'offset': '100'}, {'offset': 2147483647}, {'user_id': users[2]}]:
        rpc(1, 'matches', 'list', dict(scope='public', period='upcoming', **bad) if 'scope' not in bad and 'period' not in bad else {**dict(scope='public', period='upcoming'), **bad}, expected='invalid_input')
    check(True, 'invalid scopes/query/types/offsets and actor injection fail closed')
    for invalid in ['null', '[]', 'true', '1']:
        sql(f"select public.slm_matches_dispatch('{users[1]}','{sessions[1]}','list','{invalid}'::jsonb);", expected='invalid_input')
    check(True, 'non-object list payloads reject safely')
    sql(f"update public.slm_account_security set active=false where user_id='{users[4]}'")
    rpc(4, 'matches', 'list', expected='session_invalid')
    sql(f"select public.slm_matches_dispatch('{users[1]}','{sessions[2]}','list','{{}}');", expected='session_invalid')
    check(True, 'inactive account and mismatched actor/session denied')
    before_members = sql('select count(*) from public.slm_group_members')
    write(2, 'matches', 'join', event_id=public)
    write(2, 'matches', 'guest', event_id=public, guest_name='Fikcyjny gość', list='registered')
    write(2, 'matches', 'guest', event_id=public, guest_name='Fikcyjna rezerwa', list='reserve')
    card = next(x for x in feed(3, scope='public')['events'] if x['id'] == public)
    check(card['registered_count'] == 2 and card['reserve_count'] == 1 and card['capacity'] == 15, 'counts include registered guest but reserve does not occupy capacity')
    forbidden = {'participants','members','description','contact_phone','guest_phone','email','phone','balance','ledger','payments'}
    check(not forbidden.intersection(card) and 'PRIVATE DESCRIPTION' not in json.dumps(card), 'summary reuses safe DTO without group/private roster/finance details')
    rpc(3, 'groups', 'detail', dict(group_id=gb), expected='forbidden|not_found')
    rpc(3, 'groups', 'profile', dict(group_id=gb, user_id=users[2]), expected='forbidden|not_found')
    rpc(3, 'group_finance', 'detail', dict(group_id=gb, event_id=public), expected='forbidden|not_found')
    rpc(3, 'lineups', 'get', dict(event_id=public), expected='not_found')
    check(True, 'public discovery grants no private group/profile/finance/lineup API access')
    sql('begin;set local role authenticated;select * from public.slm_matches;', expected='permission denied')
    sql(f"begin;set local role authenticated;select public.slm_matches_dispatch('{users[2]}','{sessions[2]}','list','{{}}');", expected='permission denied')
    check(True, 'authenticated SQL client cannot bypass table ACL or forge service RPC actor')
    check(sql('select count(*) from public.slm_group_members') == before_members, 'discovery reads never create group membership')
    ledger = sql("select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.slm_group_ledger x")
    # Seed >100 public and earlier foreign private rows to prove filtering precedes pagination.
    bulk = sql(f"with added as(insert into public.slm_matches(group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents) select '{gb}','{users[2]}','Page fixture '||i,'public','2098-01-01T18:00Z'::timestamptz,'Fixture',90,15,0 from generate_series(1,105)i returning id)select jsonb_agg(id) from added")
    public_ids = set(json.loads(bulk)) | {public, polish}
    sql(f"insert into public.slm_matches(group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents) select '{gb}','{users[2]}','Private page fixture '||i,'private','2097-01-01T18:00Z'::timestamptz,'Fixture',90,15,0 from generate_series(1,120)i")
    p0, p1 = feed(3, scope='public'), feed(3, scope='public', offset=100)
    check(len(ids(p0)) == 100 and p0['has_more'] and p0['next_offset'] == 100 and p0['public_discovery_version'] == 1, 'first page bounded at100 with explicit capability and next offset')
    check(len(ids(p1)) == 7 and not p1['has_more'] and p1['next_offset'] is None and not set(ids(p0)).intersection(ids(p1)) and set(ids(p0)+ids(p1)) == public_ids, 'all public results page without omissions, duplicate IDs or private displacement')
    page_search = feed(3, scope='public', query='Page fixture')
    check(len(ids(page_search)) == 100 and all(x['visibility'] == 'public' for x in page_search['events']) and len(ids(feed(3, scope='public', query='Page fixture', offset=100))) == 5, 'search predicate precedes limit and excludes matching private fixtures')
    check(ids(feed(3, scope='public')) == ids(p0) and ids(feed(3, scope='public', offset=1)) == (ids(p0)+ids(p1))[1:101], 'stable timestamp/UUID ordering across repeated and shifted pages')
    check(not ids(feed(3, scope='public', offset=1000)), 'out-of-range offset yields empty page')
    check(sql("select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.slm_group_ledger x") == ledger, 'read/list operations do not alter finance ledger')
    check(set(ids(rpc(1, 'matches', 'list', {'scope':'groups','period':'history'}))) == set(), 'group history does not include unrelated public history')
    # Discovery is not a promise that any public match accepts registration.
    full = create(2, gb, 'Pełny publiczny fixture', 'public', capacity=10)
    write(2, 'matches', 'join', event_id=full)
    for i in range(9):
        write(2, 'matches', 'guest', event_id=full, guest_name='Pełny gość ' + str(i), list='registered')
    rpc(3, 'matches', 'join', dict(event_id=full, request_id=str(uuid.uuid4())), expected='event_full')
    rpc(3, 'matches', 'join', dict(event_id=old, request_id=str(uuid.uuid4())), expected='registration_closed')
    rpc(3, 'matches', 'join', dict(event_id=cancelled, request_id=str(uuid.uuid4())), expected='event_cancelled')
    check(True, 'unchanged signup API still rejects full, ended and cancelled public matches')
    write(3, 'matches', 'reserve', event_id=full)
    check(sql('select count(*) from public.slm_group_members') == before_members, 'explicit public reserve uses existing rules without group membership')
    rpc(3, 'lineups', 'get', dict(event_id=full), expected='not_found')
    rpc(3, 'groups', 'profile', dict(group_id=gb, user_id=users[2]), expected='forbidden|not_found')
    check(True, 'public participant on reserve still has no private profile or lineup access')
    previous = create(0, ga, 'Własna dawna historia')
    write(1, 'matches', 'join', event_id=previous)
    sql(f"update public.slm_matches set starts_at=now()-interval '3 hours' where id='{previous}'")
    write(1, 'groups', 'leave', group_id=ga)
    check(previous in ids(rpc(1, 'matches', 'list', {'scope':'mine','period':'history'}))
          and previous not in ids(rpc(1, 'matches', 'list', {'scope':'groups','period':'history'})), 'legacy own history survives leaving; groups means current memberships only')
    # Independent audit: closed-world DTO and direct/indirect cross-group probes.
    allowed_card = {'id','group_id','group_name','created_by','name','visibility','starts_at','location','status','access',
                    'duration_minutes','capacity','cost_cents','total_cost','hourly_rate','minimum_players',
                    'registered_count','reserve_count','registration_open','decision_required','approved_at','version',
                    'settlements_active','can_manage','can_edit','current_group_member','own_history','own_participation'}
    check(set(card) == allowed_card and card['can_manage'] is False and card['can_edit'] is False,
          'closed-world public DTO has only existing summary fields, no organizer/finance privilege')
    for scope_body in ({}, {'scope':'all'}, {'scope':'public'}, {'scope':'mine'}, {'scope':'groups'}, {'scope':'group','group_id':gb}):
        check(private not in ids(feed(3, **scope_body)), 'foreign private absent across list scope ' + str(scope_body.get('scope','default')))
    rpc(3, 'matches', 'detail', dict(event_id=private), expected='not_found')
    rpc(3, 'matches', 'join', dict(event_id=private, request_id=str(uuid.uuid4())), expected='forbidden')
    for role in ('anon', 'authenticated'):
        sql(f"begin;set local role {role};select slm_private.match_discovery_list('{users[2]}','{sessions[2]}','{{}}');", expected='permission denied')
    check(True, 'private detail/signup and direct helper ACL reject outsiders and client roles')
    for bad in ({'limit':100000}, {'offset': True}, {'offset': None}, {'scope':None}, {'period':[]},
                {'query':{}}, {'query':'x'*101}, {'group_id':private,'scope':'group','query':'secret'}, {'p_user':users[2]}):
        rpc(3, 'matches', 'list', {**dict(scope='public'), **bad}, expected='invalid_input')
    check(True, 'extra limit, null/boolean/types and forged actor search rejected')
    rpc(0, 'group_finance', 'account', dict(group_id=gb,user_id=users[2]), expected='forbidden')
    rpc(0, 'lineups', 'get', dict(event_id=public), expected='not_found')
    check(True, 'administrator of a different group gains no finance or lineup access')
    sql(f"update public.slm_account_security set must_change_password=true where user_id='{users[3]}'")
    rpc(3, 'matches', 'list', expected='session_invalid')
    sql(f"update public.slm_account_security set must_change_password=false where user_id='{users[3]}';delete from auth.sessions where id='{sessions[3]}'")
    rpc(3, 'matches', 'list', expected='session_invalid')
    sql(f"insert into auth.sessions(id,user_id) values('{sessions[3]}','{users[3]}');select public.slm_account_accept_session('{users[3]}','{sessions[3]}',1)")
    check(True, 'SQL independently denies temporary-password and revoked live sessions')
    closed = create(2, gb, 'Close public fixture', 'public')
    check(closed in ids(feed(3,scope='public',query='Close public fixture')), 'public match initially discoverable')
    sql(f"update public.slm_matches set visibility='private' where id='{closed}'")
    check(not ids(feed(3,scope='public',query='Close public fixture')) and closed not in ids(feed(3)), 'closing public match removes outsider search and default feed immediately')
    rpc(3, 'matches', 'detail', dict(event_id=closed), expected='not_found')
    check(True, 'known event UUID cannot bypass closed visibility')
    write(1, 'groups', 'leave', group_id=gc)
    check(own2 not in ids(feed(1,scope='groups')), 'revoked group membership immediately removes private cards')
    rpc(1, 'matches', 'detail', dict(event_id=own2), expected='not_found')
    check(True, 'revoked member cannot use previous private event UUID')
    sql((ROOT / 'app/supabase/tests/premium_match_visibility.sql').read_text())
    check(True, 'existing visibility/RLS regression still passes')
    print(f'RESULT {passed} PASS: real SQL/RLS on42 source migrations; Auth/Storage fixtures, GoTrue/Edge HTTP and Premium UI NOT TESTED.', flush=True)
finally:
    if started:
        subprocess.run(['docker', 'stop', '--time', '5', NAME], capture_output=True)
        print('Stopped and retained fixture: ' + NAME, flush=True)
