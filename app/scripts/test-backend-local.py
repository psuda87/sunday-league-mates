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

PREMIUM=os.environ.get("SLM_PREMIUM_REAL_EVENTS")=="1"
READINESS=PREMIUM or os.environ.get("SLM_SECURITY_READINESS")=="1"
CONTAINER = "supabase_db_slm-premium-real-events" if PREMIUM else "supabase_db_slm-online-readiness" if READINESS else "supabase_db_sunday-league-mates"
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
    function = "slm_settlements_dispatch" if finance else "slm_events_dispatch"
    schema="slm_private." if not finance and action=="create" else "public."
    if not finance and action=="create": function="events_dispatch_core"
    query = "begin; set local role service_role; select " + schema + function + "(" + ",".join([
        literal(users[index]), literal(sessions[index]), literal(action), literal(json.dumps(body)) + "::jsonb"]) + ");"
    query += "rollback;" if rollback else "commit;"
    result = sql(query, expected=expected)
    return json.loads(result) if result else None

try:
    branch = subprocess.check_output(["git", "branch", "--show-current"], text=True).strip()
    if PREMIUM:assert branch=="feat/premium-real-events-stage1", "Premium tests require isolated branch"
    assert branch in ("feat/integration","feat/v1-consolidation","feat/premium-b3-groups",*( ["feat/premium-real-events-stage1"] if PREMIUM else ["feat/account-model-foundation"] if READINESS else [])), "Requires reviewed integration/consolidation branch"
    context_host = subprocess.check_output(["docker","context","inspect","--format","{{.Endpoints.docker.Host}}"],text=True).strip()
    docker_host = os.environ.get("DOCKER_HOST") or context_host
    assert docker_host.startswith(("npipe://", "unix://")), "Only a local Docker socket is allowed"
    inspected = subprocess.check_output(["docker", "inspect", "--format", "{{.Name}}", CONTAINER], text=True).strip()
    assert inspected == "/" + CONTAINER
    if PREMIUM:assert json.loads(subprocess.check_output(["docker","inspect",CONTAINER]))[0]["Config"]["Labels"]["com.supabase.cli.project"]=="slm-premium-real-events"
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
    body = dict(date=sql("select ((now() at time zone 'Europe/Warsaw')::date+3)::text"),time="19:00",location="Fixture",duration_minutes=90,hourly_rate=180,total_cost=270,capacity=10)
    rpc(1, "create", body, expected="forbidden")
    check(True, "member cannot create match")
    event = rpc(0, "create", body)["event_id"]
    for i in range(1, 10): rpc(i, "join", {"event_id": event})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        def race(i):
            try: rpc(i, "join", {"event_id": event}); return "joined"
            except RuntimeError as e:
                if "event_full" in str(e): return "full"
                raise
        results = list(pool.map(race, (10, 11)))
    check(sorted(results)==["full","joined"], "parallel last seat: exactly one winner")
    winner = 10 if results[0]=="joined" else 11
    loser = 11 if winner==10 else 10
    rpc(winner,"join",{"event_id":event},expected="event_full")
    check(sql(f"select count(*) from public.slm_event_participants where event_id='{event}' and status='registered'")=="10", "no duplicate or capacity overflow")
    rpc(loser,"guest",dict(event_id=event,request_id=str(uuid.uuid4()),guest_name="Guest",list="registered"),expected="event_full")
    check(True,"guest consumes seat")
    rpc(loser,"reserve",{"event_id":event})
    participant=sql(f"select id from public.slm_event_participants where event_id='{event}' and member_id='{users[1]}'")
    rpc(1,"withdraw",dict(event_id=event,participant_id=participant))
    check(sql(f"select status from public.slm_event_participants where event_id='{event}' and member_id='{users[loser]}'")=="reserve","reserve not promoted")
    rpc(loser,"join",{"event_id":event})
    rpc(loser,"join",{"event_id":event},expected="event_full")
    # Dedicated non-full event tests exact duplicate rejection and guest ownership.
    extra=rpc(0,"create",body)["event_id"]
    rpc(1,"join",{"event_id":extra})
    rpc(1,"join",{"event_id":extra},expected="duplicate_signup")
    guest=rpc(1,"guest",dict(event_id=extra,request_id=str(uuid.uuid4()),guest_name="Guest",list="registered"))["participant_id"]
    rpc(2,"withdraw",dict(event_id=extra,participant_id=guest),expected="forbidden")
    check(True,"duplicates and foreign guest permission")
    # Server password/security-version gates and actual authenticated RLS.
    claims=literal(json.dumps(dict(sub=users[1],role="authenticated",session_id=sessions[1])))
    def own_count():
        return sql(f"begin; select set_config('request.jwt.claims',{claims},true); set local role authenticated; select count(*) from public.slm_events; rollback;").splitlines()[-1]
    check(int(own_count())>0,"valid authenticated session can read events through RLS")
    sql(f"update public.slm_account_security set must_change_password=true where user_id='{users[1]}'")
    check(own_count()=="0","temporary password blocks RLS")
    rpc(1,"list",{},expected="session_invalid")
    sql(f"update public.slm_account_security set must_change_password=false,security_version=2 where user_id='{users[1]}'")
    check(own_count()=="0","old session rejected after security version change")
    sql(f"update public.slm_account_security set security_version=1 where user_id='{users[1]}'")
    sql(f"begin; set local role authenticated; update public.slm_roles set role='admin' where user_id='{users[1]}';",expected="permission denied")
    check(True,"cannot self-promote role")
    sql("begin; set local role anon; select public.slm_events_dispatch(null,null,'list','{}');",expected="permission denied")
    check(True,"anon cannot call service RPC")
    # Register a fictional device so atomicity also covers a real push queue row.
    device=str(uuid.uuid4()); binding=str(uuid.uuid4()); secret=str(uuid.uuid4())+str(uuid.uuid4())
    for action, data in [("prepare_device",dict(device_id=device,device_secret=secret)),
                         ("register",dict(device_id=device,device_secret=secret,binding_id=binding,binding_version=1,token="fictional-token-not-for-delivery",platform="android"))]:
        sql("begin; set local role service_role; select public.slm_notifications_dispatch("+",".join([literal(users[1]),literal(sessions[1]),literal(action),literal(json.dumps(data))+"::jsonb"])+"); commit;")
    # Real finance wrapper -> atomic inbox and outbox, rollback and retries.
    payment=rpc(1,"submit_payment",dict(request_id=str(uuid.uuid4()),amount_cents=100,reason="Fixture"),finance=True)["payment_id"]
    decision=dict(request_id=str(uuid.uuid4()),payment_id=payment,reason="Fixture decision")
    rpc(0,"accept_payment",decision,finance=True,rollback=True)
    check(sql(f"select status from public.slm_payments where id='{payment}'")=="pending" and sql("select count(*) from public.slm_notifications where kind='payment_accepted'")=="0","rollback undoes payment and notification")
    first=rpc(0,"accept_payment",decision,finance=True)
    repeated=rpc(0,"accept_payment",decision,finance=True)
    check(first==repeated and sql("select count(*) from public.slm_notifications where kind='payment_accepted'")=="1","payment accepted notification exactly once on retry")
    check(sql("select count(*) from public.slm_notification_sources where kind='payment_accepted'")=="1","financial source committed with notification")
    check(sql(f"select count(*) from public.slm_finance_ledger where payment_id='{payment}' and kind='payment'")=="1","payment ledger exactly once")
    check(sql("select count(*) from public.slm_push_queue q join public.slm_notifications n on n.id=q.notification_id where n.kind='payment_accepted'")=="1","payment notification and push queue committed together")
    other_claims=literal(json.dumps(dict(sub=users[2],role="authenticated",session_id=sessions[2])))
    hidden=sql(f"begin; select set_config('request.jwt.claims',{other_claims},true); set local role authenticated; select count(*) from public.slm_finance_ledger; rollback;").splitlines()[-1]
    check(hidden=="0","RLS hides another member finance ledger")
    # Two real approved past matches block the same responsible account.
    for day in (4,3):
        past=sql(f"insert into public.slm_events(starts_at,location,capacity,created_by) values(now()-interval '{day} days','Fixture debt',10,'{users[0]}') returning id")
        pid=sql(f"insert into public.slm_event_participants(event_id,member_id,responsible_user_id,status) values('{past}','{users[1]}','{users[1]}','registered') returning id")
        sql(f"insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot) select '{past}','{pid}','{users[0]}','{users[1]}','joined',now()-interval '{day} days',now()-interval '{day} days',false,jsonb_build_object('participant',to_jsonb(p),'previous_status',null) from public.slm_event_participants p where id='{pid}'")
        version=int(sql(f"select version from public.slm_settlements where event_id='{past}'"))
        rpc(0,"approve",dict(request_id=str(uuid.uuid4()),event_id=past,expected_version=version,reason="Fixture approval"),finance=True)
    open_event=rpc(0,"create",body)["event_id"]
    rpc(1,"join",{"event_id":open_event},expected="settlement_blocked")
    rpc(1,"guest",dict(event_id=open_event,request_id=str(uuid.uuid4()),guest_name="Guest",list="registered"),expected="settlement_blocked")
    check(sql("select count(*) from public.slm_notifications where kind='registration_blocked'")=="1","two approved debts block signup and guest and emit block notification")
    pay=rpc(1,"submit_payment",dict(request_id=str(uuid.uuid4()),amount_cents=26901,reason="Fixture FIFO"),finance=True)["payment_id"]
    rpc(0,"accept_payment",dict(request_id=str(uuid.uuid4()),payment_id=pay,reason="Fixture FIFO"),finance=True)
    rpc(1,"join",{"event_id":open_event})
    check(sql("select count(*) from public.slm_notifications where kind='registration_unblocked'")=="1","FIFO partial payment removes one debt and unblocks signup atomically")
    rejected=rpc(1,"submit_payment",dict(request_id=str(uuid.uuid4()),amount_cents=100,reason="Fixture"),finance=True)["payment_id"]
    rpc(0,"reject_payment",dict(request_id=str(uuid.uuid4()),payment_id=rejected,reason="Fixture"),finance=True)
    check(sql("select count(*) from public.slm_notifications where kind='payment_rejected'")=="1","rejected payment notification")
    # Prepared real financial races; must execute against local PostgreSQL.
    def financial_race(actions, same_request=False):
        payment=rpc(1,"submit_payment",dict(request_id=str(uuid.uuid4()),amount_cents=100,reason="Fixture race"),finance=True)["payment_id"]
        request=str(uuid.uuid4())
        def decision(action):
            try:
                rpc(0,action,dict(request_id=request if same_request else str(uuid.uuid4()),payment_id=payment,reason="Fixture race"),finance=True)
                return "committed"
            except RuntimeError as e:
                if "payment_processed" in str(e): return "processed"
                raise
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            outcomes=list(pool.map(decision,actions))
        check(outcomes==["committed","committed"] if same_request else sorted(outcomes)==["committed","processed"],"concurrent "+"/".join(actions)+(" same request" if same_request else ""))
        status=sql(f"select status from public.slm_payments where id='{payment}'")
        ledger=int(sql(f"select count(*) from public.slm_finance_ledger where payment_id='{payment}' and kind='payment'"))
        check(ledger==(1 if status=="accepted" else 0),"race decision and ledger consistent")
    financial_race(("accept_payment","accept_payment"))
    financial_race(("accept_payment","reject_payment"))
    financial_race(("accept_payment","accept_payment"),True)
    rpc(0,"cancel",{"event_id":event})
    rpc(1,"join",{"event_id":event},expected="event_cancelled")
    check(True,"cancel blocks signup")
    sql(f"update public.slm_events set starts_at=now()-interval '1 minute' where id='{extra}'")
    rpc(2,"join",{"event_id":extra},expected="registration_closed")
    check(True,"server closes signup at kickoff")
    print(f"RESULT {passed} PASS; HTTP Auth/Edge and FCM not tested")
finally:
    if created:
        result=command(["dropdb","-U","postgres",DB])
        if result.returncode: raise RuntimeError("Cannot remove own scratch database")
        print("Own scratch database removed; original database untouched")
