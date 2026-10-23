"""Real PostgreSQL RPC/RLS/concurrency. No HTTP/Auth or remote connection.
Creates a NEW schema-only scratch database in the exact local Supabase container,
drops ONLY that database in finally. No existing database is reset or deleted.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import uuid

CONTAINER = "supabase_db_sunday-league-mates"
DB = "slm_backend_test_" + uuid.uuid4().hex
created = False
passed = 0

def command(args, data=None):
    return subprocess.run(["docker", "exec", "-i", CONTAINER, *args], input=data, capture_output=True)

def sql(query, database=DB, expected=None):
    result = command(["psql", "-X", "-qAt", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"], query.encode())
    if expected:
        assert result.returncode != 0 and expected in result.stderr.decode(), "Expected SQL rejection: " + expected
        return ""
    if result.returncode:
        raise RuntimeError(result.stderr.decode())
    return result.stdout.decode().strip()

def check(value, name):
    global passed
    assert value, name
    passed += 1
    print("PASS", name)

def literal(value):
    return "'" + str(value).replace("'", "''") + "'"

users = [str(uuid.uuid4()) for _ in range(12)]
sessions = [str(uuid.uuid4()) for _ in users]
def rpc(index, action, body, finance=False, expected=None, rollback=False):
    function = "slm_group_finance_dispatch" if finance else "slm_matches_dispatch"
    if action.startswith("groups:"): function="slm_groups_dispatch"; action=action[7:]
    body=dict(body)
    if action not in ("list","search","detail","inbox","account","pending"): body.setdefault("request_id",str(uuid.uuid4()))
    query = "begin; set local role service_role; select public." + function + "(" + ",".join([
        literal(users[index]), literal(sessions[index]), literal(action), literal(json.dumps(body)) + "::jsonb"]) + ");"
    query += "rollback;" if rollback else "commit;"
    result = sql(query, expected=expected)
    return json.loads(result) if result else None

try:
    branch = subprocess.check_output(["git", "branch", "--show-current"], text=True).strip()
    assert branch in ("feat/integration", "feat/premium318-live"), "Requires approved local integration branch"
    context_host = subprocess.check_output(["docker","context","inspect","--format","{{.Endpoints.docker.Host}}"],text=True).strip()
    docker_host = os.environ.get("DOCKER_HOST") or context_host
    assert docker_host.startswith(("npipe://", "unix://")), "Only a local Docker socket is allowed"
    inspected = subprocess.check_output(["docker", "inspect", "--format", "{{.Name}}", CONTAINER], text=True).strip()
    assert inspected == "/" + CONTAINER
    assert command(["createdb", "-U", "postgres", "-T", "template0", DB]).returncode == 0
    created = True
    dump = command(["pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only"])
    assert dump.returncode == 0
    restored = command(["psql", "-X", "-q", "-U", "supabase_admin", "-d", DB, "-v", "ON_ERROR_STOP=1"], dump.stdout)
    if restored.returncode: raise RuntimeError(restored.stderr.decode())
    for file in ("settlements.sql", "notifications.sql", "integration-contracts.sql"):
        sql((Path(__file__).parents[1] / "supabase" / "tests" / file).read_text(encoding="utf-8"))
        check(True, file)
    fixture = "begin;"
    for i, (u, sid) in enumerate(zip(users, sessions)):
        fixture += f"insert into auth.users(id,aud,role,email) values('{u}','authenticated','authenticated','{u}@fixture.invalid');"
        fixture += f"select public.slm_account_provision('{u}','Fixture_{i:03d}','+48000000{i:03d}','{u}@fixture.invalid',null,null,{'true' if i==0 else 'false'});"
        fixture += f"update public.slm_account_security set must_change_password=false where user_id='{u}';"
        fixture += f"insert into auth.sessions(id,user_id) values('{sid}','{u}'); select public.slm_account_accept_session('{u}','{sid}',1);"
    sql(fixture + "commit;")
    a=rpc(0,"groups:create",dict(name="Fixture A"))["group_id"]
    b=rpc(1,"groups:create",dict(name="Fixture B"))["group_id"]
    rpc(2,"groups:detail",dict(group_id=a),expected="not_found")
    check(True,"group membership privacy")
    rpc(0,"groups:invite",dict(group_id=a,user_id=users[2]))
    inbox=rpc(2,"groups:inbox",{})["requests"]
    check(len(inbox)==1,"nonmember can see own invitation")
    rpc(2,"groups:decide",dict(id=inbox[0]["id"],accept=True))
    rpc(1,"groups:invite",dict(group_id=b,user_id=users[2]))
    invite=rpc(2,"groups:inbox",{})["requests"][0]
    rpc(2,"groups:decide",dict(id=invite["id"],accept=True))
    check(len(rpc(2,"groups:list",{})["groups"])==2,"one player in two groups")
    body=dict(group_id=a,name="Fixture match",visibility="private",starts_at=sql("select (now()+interval '3 days')::text"),location="Fixture",duration_minutes=90,capacity=10,cost_cents=24500)
    rpc(2,"create",body,expected="forbidden")
    event=rpc(0,"create",body)["event_id"]
    rpc(2,"join",dict(event_id=event))
    for i in range(9): rpc(2,"guest",dict(event_id=event,guest_name="Fictional guest "+str(i)))
    rpc(2,"guest",dict(event_id=event,guest_name="Overflow"),expected="event_full")
    check(True,"guests consume capacity")
    sql(f"update public.slm_matches set starts_at=now()-interval '3 hours' where id='{event}'")
    version=int(sql(f"select version from public.slm_matches where id='{event}'"))
    rpc(0,"approve",dict(event_id=event,expected_version=version,reason="Fixture approval"),finance=True)
    check(sql(f"select sum(amount_cents) from slm_private.group_preview('{event}')")=="25000","ceil whole PLN: 245 PLN / 10 becomes 25 PLN each")
    check(sql(f"select assessed_cents||':'||received_cents from public.slm_group_surplus where event_id='{event}'")=="500:0","assessed surplus separate from actual receipts")
    rpc(1,"account",dict(group_id=a,user_id=users[2]),finance=True,expected="forbidden")
    check(True,"other group admin cannot read finances")
    payment=rpc(2,"submit_payment",dict(group_id=a,event_id=event,amount_cents=25000),finance=True)["payment_id"]
    check(sql(f"select received_cents from public.slm_group_surplus where event_id='{event}'")=="0","pending payment is not cash received")
    rpc(0,"accept_payment",dict(payment_id=payment,reason="Fixture acceptance"),finance=True)
    check(sql(f"select received_cents from public.slm_group_surplus where event_id='{event}'")=="500","received surplus only after confirmed receipts exceed cost")
    check(rpc(2,"account",dict(group_id=a),finance=True)["surplus"] is None,"player cannot view surplus")
    check(sql("select count(*) from public.slm_group_ledger where kind='payment'")=="1","one ledger entry for accepted receipt")
    # Create two ended obligations in different groups using real approval RPC.
    def ended(owner,group,existing=None):
        payload=dict(body,group_id=group)
        match=existing or rpc(owner,"create",payload)["event_id"]
        if not existing: rpc(2,"join",dict(event_id=match))
        sql(f"update public.slm_matches set starts_at=now()-interval '4 hours' where id='{match}'")
        v=int(sql(f"select version from public.slm_matches where id='{match}'"))
        rpc(owner,"approve",dict(event_id=match,expected_version=v,reason="Fixture approval"),finance=True)
        return match
    pending_newer=rpc(0,"create",body)["event_id"]
    check(rpc(0,"detail",dict(event_id=event))["event"]["id"] == event,
          "summary preserves first requested match with multiple rows")
    check(rpc(0,"detail",dict(event_id=pending_newer))["event"]["id"] == pending_newer,
          "summary preserves second requested match with multiple rows")
    check(sql(f"select slm_private.match_summary('00000000-0000-0000-0000-000000000000','{users[0]}') is null") == "t",
          "unknown summary never falls back to a different match")
    rpc(2,"join",dict(event_id=pending_newer))
    debt_a=ended(0,a);debt_b=ended(1,b)
    check(sql(f"select slm_private.registration_allowed('{users[2]}',1)")=="f","one unpaid match in each group causes global paid block")
    check(sql(f"select slm_private.registration_allowed('{users[2]}',0)")=="t","global debt block permits free matches")
    future=rpc(0,"create",body)["event_id"]
    rpc(2,"join",dict(event_id=future),expected="registration_blocked")
    free=rpc(0,"create",dict(body,cost_cents=0))["event_id"]
    rpc(2,"join",dict(event_id=free))
    check(True,"actual free signup allowed while paid signup rejected")
    # Paying the newer targeted event must not consume the older debt in this group.
    newer=ended(0,a,pending_newer)
    rpc(0,"record_payment",dict(event_id=newer,user_id=users[2],amount_cents=24500,reason="Fixture targeted payment"),finance=True)
    check(sql(f"select outstanding_cents from slm_private.group_dues('{users[2]}') where event_id='{newer}'")=="0","targeted payment settles selected event")
    check(sql(f"select outstanding_cents from slm_private.group_dues('{users[2]}') where event_id='{debt_a}'")=="24500","targeted payment does not consume older debt")
    check(sql(f"select outstanding_cents from slm_private.group_dues('{users[2]}') where event_id='{debt_b}'")=="24500","payment in A cannot settle B")
    general=dict(group_id=a,user_id=users[2],amount_cents=24500,reason="Fixture FIFO",request_id=str(uuid.uuid4()))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _: rpc(0,"record_payment",general,finance=True),range(2)))
    check(results[0]==results[1],"concurrent identical payment returns one idempotent result")
    check(sql(f"select count(*) from public.slm_group_ledger where payment_id='{general['request_id']}'")=="1","concurrent receipt creates one ledger entry")
    check(sql(f"select outstanding_cents from slm_private.group_dues('{users[2]}') where event_id='{debt_a}'")=="0","general payment settles oldest group debt")
    check(sql(f"select slm_private.registration_allowed('{users[2]}',1)")=="t","settlement removes global block")
    # Global application administrator (user zero) has no automatic power in B.
    rpc(0,"detail",dict(event_id=debt_b),finance=True,expected="forbidden")
    check(True,"global application admin has no foreign group finance power")
    # Group organizer may manage only events they actually created.
    rpc(0,"groups:permission",dict(group_id=a,user_id=users[2],organizer=True))
    own=rpc(2,"create",body)["event_id"]
    rpc(2,"detail",dict(event_id=own),finance=True)
    rpc(2,"detail",dict(event_id=event),finance=True,expected="forbidden")
    rpc(2,"record_payment",dict(group_id=a,user_id=users[2],amount_cents=100,reason="Forbidden general payment"),finance=True,expected="forbidden")
    check(True,"organizer limited to own event, no general group receipts")
    # A removed member sees only their participation, never other participant counts.
    rpc(0,"groups:remove",dict(group_id=a,user_id=users[2]))
    retained=rpc(2,"detail",dict(event_id=event))
    check(retained["event"]["registered_count"] is None and retained["event"]["reserve_count"] is None,"former member cannot infer participant counts")
    # Real RLS checks use the fixture session, not service-role response filtering.
    claims=json.dumps(dict(sub=users[1],session_id=sessions[1],role="authenticated"))
    visible=sql("begin; set local role authenticated; select set_config('request.jwt.claims',"+literal(claims)+",true); select count(*) from public.slm_groups where id="+literal(a)+"; rollback;").splitlines()[-1]
    check(visible=="0","RLS hides foreign group rows")
    public_event=rpc(0,"create",dict(body,visibility="public"))["event_id"]
    rpc(0,"join",dict(event_id=public_event,user_id=users[4]),expected="forbidden")
    rpc(0,"guest",dict(event_id=public_event,user_id=users[4],guest_name="Unsolicited"),expected="forbidden")
    check(True,"public event organizer cannot assign unsolicited debt to unrelated account")
    for i in range(1,10):rpc(i,"join",dict(event_id=public_event))
    def last_seat(i):
        try:rpc(i,"join",dict(event_id=public_event));return "joined"
        except RuntimeError as error:
            if "event_full" in str(error):return "full"
            raise
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(last_seat,(10,11)))
    check(sorted(results)==["full","joined"],"v2 concurrent last seat: exactly one winner")
    loser=11 if results[0]=="joined" else 10
    rpc(loser,"reserve",dict(event_id=public_event))
    device=str(uuid.uuid4());binding=str(uuid.uuid4());device_secret=str(uuid.uuid4())+str(uuid.uuid4())
    for action,data in [("prepare_device",dict(device_id=device,device_secret=device_secret)),("register",dict(device_id=device,device_secret=device_secret,binding_id=binding,binding_version=1,token="fictional-token-not-for-delivery",platform="android"))]:
        sql("begin;set local role service_role;select public.slm_notifications_dispatch("+",".join([literal(users[loser]),literal(sessions[loser]),literal(action),literal(json.dumps(data))+"::jsonb"])+");commit;")

    entry=sql(f"select id from public.slm_match_entries where event_id='{public_event}' and member_id='{users[1]}'")
    rpc(1,"withdraw",dict(event_id=public_event,participant_id=entry))
    check(sql(f"select status from public.slm_match_entries where event_id='{public_event}' and member_id='{users[loser]}'")=="reserve","v2 vacancy never automatically promotes reserve")
    check(sql(f"select count(*) from public.slm_notifications where match_id='{public_event}' and user_id='{users[loser]}' and kind='vacancy'")=="1","v2 reserve receives real vacancy inbox notification")
    check(all(p["contact_phone"] is None for p in rpc(loser,"detail",dict(event_id=public_event))["participants"] if p["responsible_user_id"]!=users[loser]),"public outsider cannot read group phone numbers")
    claimed=json.loads(sql("begin;set local role service_role;select public.slm_push_claim(20);commit;"))
    check(any(job["kind"]=="vacancy" for job in claimed),"v2 vacancy inbox and real push queue committed together")
    rpc(loser,"join",dict(event_id=public_event))
    check(sql(f"select slm_private.push_deliverable(n,d) from public.slm_notifications n cross join public.slm_push_devices d where n.match_id='{public_event}' and n.kind='vacancy' and n.user_id='{users[loser]}' and d.id='{device}'")=="f","v2 worker rechecks vacancy after last place is filled")

    rpc(loser,"join",dict(event_id=public_event),expected="event_full")
    check(sql(f"select count(*) from public.slm_match_entries where event_id='{public_event}' and status='registered'")=="10","v2 capacity and duplicate safety after vacancy")
    rpc(0,"cancel",dict(event_id=public_event,reason="Fixture cancellation"))
    rpc(1,"join",dict(event_id=public_event),expected="event_cancelled")
    check(sql(f"select count(*)>0 from public.slm_notifications where match_id='{public_event}' and kind='match_cancelled'")=="t","v2 cancellation notifies participants and blocks signup")
    late=rpc(0,"create",dict(body,visibility="public"))["event_id"]
    sql(f"update public.slm_matches set starts_at=clock_timestamp()+interval '5 minutes' where id='{late}'")
    # Keep kickoff shortly ahead: a two-hour offset crossed midnight after 22:00
    # and moved the match cutoff to tomorrow. Use the actual server/match day.
    after_cutoff=sql(f"select (now() at time zone 'Europe/Warsaw')::time>=time '17:00' and (starts_at at time zone 'Europe/Warsaw')::date=(now() at time zone 'Europe/Warsaw')::date from public.slm_matches where id='{late}'")=="t"
    for i in range(1,11):rpc(i,"join",dict(event_id=late))
    entries=[sql(f"select id from public.slm_match_entries where event_id='{late}' and member_id='{users[i]}'") for i in (1,2)]
    for i,entry in zip((1,2),entries):rpc(i,"withdraw",dict(event_id=late,participant_id=entry))
    if after_cutoff:
        rpc(11,"join",dict(event_id=late))
        check(sql(f"select replacement_id is not null from public.slm_match_entries where id='{entries[0]}'")=="t" and sql(f"select replacement_id is null from public.slm_match_entries where id='{entries[1]}'")=="t","v2 late withdrawal replacement uses server-ordered FIFO")
    else:print("NOT TESTED late cutoff FIFO: server time before cutoff or kickoff crosses midnight; do not fake RPC clock")
    sql(f"update public.slm_matches set starts_at=now()-interval '1 minute' where id='{late}'")
    rpc(1,"join",dict(event_id=late),expected="registration_closed")
    check(True,"v2 signup closes at server kickoff time")
    check(rpc(2,"detail",dict(event_id=event))["event"]["own_participation"] is True,"own filter includes retained participation after leaving group")
    check(rpc(0,"detail",dict(event_id=future))["event"]["own_participation"] is False,"creating event does not invent personal signup")
    # A failure in the transactional notification adapter must roll back receipt and ledger.
    rollback_payment=rpc(2,"submit_payment",dict(group_id=b,event_id=debt_b,amount_cents=100),finance=True)["payment_id"]
    sql("create function public.fixture_reject_notification() returns trigger language plpgsql as $$ begin raise exception 'fixture_notification_failure';end $$; create trigger fixture_reject before insert on public.slm_notifications for each row execute function public.fixture_reject_notification();")
    rpc(1,"accept_payment",dict(payment_id=rollback_payment,reason="Fixture atomicity"),finance=True,expected="fixture_notification_failure")
    check(sql(f"select status from public.slm_group_payments where id='{rollback_payment}'")=="pending","notification failure rolls back payment acceptance")
    check(sql(f"select count(*) from public.slm_group_ledger where payment_id='{rollback_payment}'")=="0","notification failure rolls back financial ledger")
    sql("drop trigger fixture_reject on public.slm_notifications; drop function public.fixture_reject_notification();")
    # Independent concurrent decision/correction requests serialize on real SQL locks.
    racing=rpc(2,"submit_payment",dict(group_id=b,event_id=debt_b,amount_cents=100),finance=True)["payment_id"]
    def decide(action):
        try:rpc(1,action,dict(payment_id=racing,reason="Fixture race"),finance=True);return "accepted" if action=="accept_payment" else "rejected"
        except RuntimeError as error:
            if "payment_processed" in str(error):return "processed"
            raise
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:decisions=list(pool.map(decide,("accept_payment","reject_payment")))
    status=sql(f"select status from public.slm_group_payments where id='{racing}'")
    check(decisions.count("processed")==1 and status in decisions,"v2 accept/reject race has one consistent winner")
    check(int(sql(f"select count(*) from public.slm_group_ledger where payment_id='{racing}' and kind='payment'"))==(1 if status=="accepted" else 0),"v2 raced decision and ledger agree")
    accepted=rpc(1,"record_payment",dict(group_id=b,event_id=debt_b,user_id=users[2],amount_cents=100,reason="Fixture correction source"),finance=True)["payment_id"]
    def correction(amount):
        try:rpc(1,"correct_payment",dict(payment_id=accepted,amount_cents=amount,expected_amount_cents=100,reason="Fixture correction race"),finance=True);return "corrected"
        except RuntimeError as error:
            if "stale_version" in str(error):return "stale"
            raise
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:corrections=list(pool.map(correction,(0,50)))
    check(sorted(corrections)==["corrected","stale"],"v2 concurrent corrections require original expected amount")
    check(sql(f"select sum(amount_cents)=(select corrected_amount_cents from public.slm_group_payments where id='{accepted}') from public.slm_group_ledger where payment_id='{accepted}'")=="t","v2 correction retains original receipt and consistent delta")
    # Refund projection and cancellation retain receipts, while eligibility changes atomically.
    rpc(0,"correct_payment",dict(payment_id=payment,amount_cents=24000,expected_amount_cents=25000,reason="Fixture partial refund"),finance=True)
    check(sql(f"select received_cents from public.slm_group_surplus where event_id='{event}'")=="0","partial refund reduces received surplus without changing assessed amount")
    check(sql(f"select amount_cents from public.slm_group_payments where id='{payment}'")=="25000","refund preserves immutable original receipt amount")
    before_unblock=int(sql(f"select count(*) from public.slm_notifications where user_id='{users[2]}' and kind='registration_unblocked'"))
    rpc(0,"cancel",dict(event_id=event,reason="Fixture approved cancellation"))
    check(sql(f"select assessed_cents||':'||received_cents from public.slm_group_surplus where event_id='{event}'")=="0:0","approved cancellation reverses assessed and received surplus projections")
    check(int(sql(f"select count(*) from public.slm_notifications where user_id='{users[2]}' and kind='registration_unblocked'"))==before_unblock+1,"approved cancellation atomically notifies global unblocking")
    # Confirmed fictional email account: no alias, no automatic group/admin membership.
    fresh=str(uuid.uuid4())
    sql(f"insert into auth.users(id,aud,role,email,raw_user_meta_data) values('{fresh}','authenticated','authenticated','{fresh}@fixture.invalid','{{\"role\":\"admin\"}}');")
    check(sql(f"select public.slm_email_identity('{fresh}@fixture.invalid') is null")=="t","unconfirmed email cannot provision application access")
    sql(f"update auth.users set email_confirmed_at=now() where id='{fresh}'")
    sql(f"select public.slm_email_identity('{fresh}@fixture.invalid')")
    check(sql(f"select role from public.slm_roles where user_id='{fresh}'")=="member","email metadata cannot grant admin")
    check(sql(f"select count(*) from public.slm_aliases where user_id='{fresh}'")=="0","email account has no invented phone or login alias")
    check(sql(f"select count(*) from public.slm_group_members where user_id='{fresh}'")=="0","email account does not join groups automatically")
    print(f"RESULT {passed} PASS; v2 real PostgreSQL tests")
finally:
    if created:
        result=command(["dropdb","-U","postgres",DB])
        if result.returncode: raise RuntimeError("Cannot remove own scratch database")
        print("Own scratch database removed; original database untouched")
