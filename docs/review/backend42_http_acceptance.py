"""Real HTTP acceptance via the existing, unmodified network-none fixture runner.

No mocks, Cloud, existing DB mutation, branch spoofing or guard changes.
Run with Python UTF-8 mode and an actual authorized Stage2B checkout whose
entire backend is identical to Stage2C. Secrets remain in fixture memory/config.
"""
import argparse
import base64
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--fixture-repo', required=True, type=Path)
args = parser.parse_args()
repo = args.fixture_repo.resolve()
assert os.environ.get('GITHUB_ACTIONS') != 'true', 'No hosted-context simulation'
assert subprocess.check_output(['git', '-C', str(repo), 'branch', '--show-current'], text=True).strip() == 'feat/public-match-discovery-stage2b'
subprocess.run(['git', '-C', str(repo), 'diff', '--exit-code',
                'e246c514af0fbca79dee892d9aa0e31b937a83c3', '--', 'app/supabase'], check=True)
sys.path.insert(0, str(repo / 'app/scripts'))
spec = importlib.util.spec_from_file_location('backend42_existing_edge', repo / 'app/scripts/test-lineups-edge-local.py')
f = importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)
extra = 0


def check(ok, label):
    global extra
    f.check(ok, 'DISCOVERY HTTP: ' + label)
    extra += 1


def verify(users, group):
    admin, member, second, outsider = users
    tag = uuid.uuid4().hex[:8]
    bulk = 'Acceptance bulk ' + tag
    special = 'Łódź %_ [A] ' + tag
    private = f.write(member, 'matches_create', group_id=group, name=bulk + ' PRIVATE',
                      visibility='private', date='2099-01-02', time='18:00', location='Fixture',
                      duration_minutes=90, capacity=15, cost_cents=0)['event_id']
    public = f.write(member, 'matches_create', group_id=group, name=special,
                     visibility='public', date='2099-01-03', time='18:00', location='Fixture',
                     duration_minutes=90, capacity=15, cost_cents=0)['event_id']
    # Synthetic data is added ONLY to the new fixture owned by the runner.
    for source, count in ((private, 120), (public, 105)):
        f.sql("insert into public.slm_matches select (jsonb_populate_record(null::public.slm_matches,"
              "to_jsonb(e)||jsonb_build_object('id',gen_random_uuid(),'name','" + bulk + " '||n))).* "
              "from public.slm_matches e cross join generate_series(1," + str(count) + ") n where e.id='" + source + "'")

    def feed(user=outsider, **body):
        return f.account(user, 'matches_list', **dict({'scope': 'public', 'period': 'upcoming'}, **body))

    for user in (member, outsider):
        a, b = feed(user, query=bulk, offset=0), feed(user, query=bulk, offset=100)
        check(a['public_discovery_version'] == 1 and len(a['events']) == 100 and a['has_more']
              and a['next_offset'] == 100, 'marker/page100 after privacy filtering')
        check(len(b['events']) == 5 and not b['has_more'] and b['next_offset'] is None,
              'page5 and end metadata')
        ids = [e['id'] for e in a['events'] + b['events']]
        check(len(set(ids)) == 105 and all(e['visibility'] == 'public' for e in a['events'] + b['events']),
              '105 unique public rows; 120 earlier matching private rows excluded')
    check(not feed(query='PRIVATE')['events'], 'private name not searchable')
    check(len(feed(query=special)['events']) == 1 and len(feed(query='%_')['events']) == 1,
          'Polish Unicode and wildcard characters searched literally')
    check(not feed(query="%' OR true --")['events'], 'SQL-like query remains literal')
    check(len(feed(query='')['events']) <= 100, 'empty query remains bounded')
    check(not feed(scope='groups')['events'], 'no-group client gets no groups results')
    for scope in ('all', 'mine', 'group'):
        body = {'scope': scope}
        if scope == 'group':
            body['group_id'] = group
        rows = feed(**body)['events']
        check(private not in [e['id'] for e in rows] and all(e['visibility'] == 'public' for e in rows),
              'foreign private rows absent in scope ' + scope)
    for body in ({'query': 'x' * 101}, {'query': 'nonempty', 'scope': 'all'},
                 {'offset': -1}, {'offset': True}, {'query': []}, {'limit': 100000}):
        # Unknown limit is whitelisted away by Edge; it must never enlarge a page.
        if 'limit' in body:
            check(len(feed(**body)['events']) <= 100, 'client cannot enlarge page using limit')
        else:
            f.account(outsider, 'matches_list', expected=400, **dict({'scope': 'public'}, **body))
            check(True, 'invalid query/scope/type/offset rejected')
    f.account(outsider, 'matches_detail', expected=404, event_id=private)
    f.account(outsider, 'lineups_get', expected=404, event_id=public)
    f.account(outsider, 'group_finance_account', expected=404, group_id=group)
    check(not f.account(outsider, 'groups_list')['groups'], 'search grants no membership, private detail, lineup or finance access')
    status, rows, _ = f.http(3000, '/slm_matches?select=id', token=outsider['token'])
    check(status in (401, 403, 404) or status == 200 and private not in [r['id'] for r in rows],
          'direct REST cannot reveal foreign private match')

    # A correctly signed expired copy of a REAL GoTrue token is verified by
    # real GoTrue/Edge, not a mocked JWT decoder. Do not log either token.
    header, payload, _ = outsider['token'].split('.')
    claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
    claims['exp'] = int(time.time()) - 120
    claims['iat'] = claims['exp'] - 3600
    encoded = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b'=').decode()
    signed = header + '.' + encoded
    signature = base64.urlsafe_b64encode(hmac.new(f.SECRET.encode(), signed.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    expired = {**outsider, 'token': signed + '.' + signature}
    expired_status, expired_body, _ = f.http(9999, '/user', token=expired['token'])
    expiry_explained = 'expir' in json.dumps(expired_body).lower()
    print('GoTrue expiry probe: HTTP ' + str(expired_status) + ', expiry reason=' + str(expiry_explained), flush=True)
    check(expired_status in (401, 403) and expiry_explained,
          'real GoTrue explicitly rejects expired signed-token negative fixture')
    f.account(expired, 'matches_list', expected=401, scope='public')
    check(feed()['public_discovery_version'] == 1, 'expired-token denial does not rely on revoking original live session')

    probe = f.write(admin, 'groups_create', name='Access probe ' + tag)['group_id']

    def invite():
        f.write(admin, 'groups_invite', group_id=probe, user_id=outsider['id'])
        request = next(r for r in f.account(outsider, 'groups_inbox')['requests'] if r['group_id'] == probe and r['state'] == 'pending')
        f.write(outsider, 'groups_decide', id=request['id'], accept=True)

    invite()
    secret = f.write(admin, 'matches_create', group_id=probe, name='Membership sentinel ' + tag,
                     visibility='private', date='2099-02-01', time='18:00', location='Fixture',
                     duration_minutes=90, capacity=15, cost_cents=0)['event_id']
    check(secret in [e['id'] for e in feed(scope='groups')['events']], 'accepted member sees own private match')
    f.write(outsider, 'groups_leave', group_id=probe)
    f.account(outsider, 'matches_detail', expected=404, event_id=secret)
    check(not feed(scope='groups')['events'] and f.http(9999, '/user', token=outsider['token'])[0] == 200,
          'leave removes private discovery/detail while original GoTrue token stays valid')
    invite()
    f.write(admin, 'groups_remove', group_id=probe, user_id=outsider['id'])
    f.account(outsider, 'matches_detail', expected=404, event_id=secret)
    check(not feed(scope='groups')['events'] and not f.account(outsider, 'groups_list')['groups'],
          'admin membership revoke removes access without client relogin')

    # Distinguish application-session revocation from JWT expiry/GoTrue logout.
    session_id = claims['session_id']
    f.sql("delete from public.slm_account_sessions where user_id='" + outsider['id'] + "' and session_id='" + session_id + "'")
    check(f.http(9999, '/user', token=outsider['token'])[0] == 200, 'GoTrue token still valid after fixture application-session revoke')
    f.account(outsider, 'matches_list', expected=401, scope='public')
    check(True, 'revoked application session cannot search using a still-valid GoTrue JWT')

    # Separate synthetic account for actual logout, leaving core harness users
    # member/second intact so its final leave/revoke assertions execute as well.
    email, password = str(uuid.uuid4()) + '@fixture.invalid', f.secrets.token_urlsafe(24) + 'Aa7!'
    status, user, _ = f.http(9999, '/admin/users', {'email': email, 'password': password, 'email_confirm': True}, f.jwt('service_role'))
    assert status in (200, 201)
    login = f.account(None, 'login', identifier=email, password=password)
    actor = {'id': user['id'], 'token': login['access_token'], 'session': login}
    check(feed(actor)['public_discovery_version'] == 1, 'new real login can discover without membership')
    f.account(actor, 'logout')
    f.account(actor, 'matches_list', expected=401, scope='public')
    check(True, 'real logout prevents further public search with the old token')
    print('Discovery callback complete; HTTP only; browser NOT RUN.', flush=True)


try:
    print('Real backend42 acceptance: unmodified core runner plus HTTP-only callback; no browser.', flush=True)
    f.main(verify)
    print(f'ACCEPTANCE PASS: {extra} discovery/security checks + {f.passed-extra} existing core checks; browser NOT RUN.', flush=True)
finally:
    for name in reversed(f.started):
        subprocess.run(['docker', 'stop', '--timeout', '5', name], capture_output=True, timeout=25)
    if f.started:
        print('Stopped/retained only NEW fixture: ' + ', '.join(f.started), flush=True)
