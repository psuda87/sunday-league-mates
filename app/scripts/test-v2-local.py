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
    assert branch in ("feat/integration","feat/v1-consolidation","feat/premium-b3-groups"), "Requires reviewed integration/consolidation branch"
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
    # Rebuild only the newly-created scratch application schema from checked-out migrations.
    # A schema-only clone has no bucket rows and is not a reproducible baseline by itself.
    assert created and DB.startswith("slm_backend_test_")
    sql("drop schema public cascade; drop schema slm_private cascade; drop schema if exists slm_auth_proof_private cascade; create schema public; grant usage on schema public to anon,authenticated,service_role; grant all on schema public to postgres,service_role;")
    migrations=sorted((Path(__file__).parents[1]/"supabase/migrations").glob("*.sql"))
    for migration in migrations:sql(migration.read_text(encoding="utf-8"))
    check(len(migrations)==34,"complete checked-out schema replayed in scratch DB")
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
    # Consolidated B2.2: schema/privileges remain private after a full fresh replay.
    check(sql("select (not public and file_size_limit=150000 and allowed_mime_types=array['image/webp']) from storage.buckets where id='slm-profile-photos'")=="t","B2.2 private bucket WebP and size limit")
    check(sql("select relrowsecurity from pg_class where oid='public.slm_profile_photos'::regclass")=="t","B2.2 photo metadata RLS enabled")
    check(sql("select has_table_privilege('authenticated','public.slm_profile_photos','select') or has_table_privilege('anon','public.slm_profile_photos','select')")=="f","B2.2 clients cannot read photo metadata directly")
    check(sql("select has_function_privilege('authenticated','public.slm_profile_number_save(uuid,uuid,integer)','execute') or has_function_privilege('anon','public.slm_profile_photo_commit(uuid,uuid,uuid,text)','execute')")=="f","B2.2 mutation RPCs stay service-only")
    check(sql("select position('shared_profile' in pg_get_expr(polqual,polrelid))>0 from pg_policy where polrelid='public.slm_profiles'::regclass and polname='members_read_profiles'")=="t","main shared-group profile RLS preserved")
    sql("select public.slm_profile_number_save("+literal(users[0])+","+literal(sessions[0])+",27)")
    sql("select public.slm_profile_number_save("+literal(users[1])+","+literal(sessions[1])+",27)")
    check(sql("select count(*) from public.slm_player_profiles where jersey_number=27 and user_id in ("+literal(users[0])+","+literal(users[1])+")")=="2","B2.2 duplicate jerseys allowed using live session gates")
    sql("select public.slm_profile_number_save("+literal(users[0])+","+literal(sessions[0])+",100)",expected="invalid_number")
    check(True,"B2.2 server rejects jersey outside 0-99")
    sql("select public.slm_profile_photo_commit("+literal(users[0])+","+literal(str(uuid.uuid4()))+",null,null)",expected="session_invalid")
    check(True,"B2.2 photo commit rejects an unapproved session")
    fallback_id=str(uuid.uuid4())
    sql(f"insert into auth.users(id,aud,role,email) values('{fallback_id}','authenticated','authenticated','{fallback_id}@fixture.invalid');insert into public.slm_profiles(user_id,full_name,display_as) values('{fallback_id}','Marek HiddenSurname','full_name');")
    check(sql(f"select slm_private.public_player_name('{fallback_id}')")=="Marek","B3 missing nickname falls back only to explicit first-name projection")
    # B3: four independent actors, two new groups; no existing database or real contacts.
    ledger_before=sql("select coalesce(jsonb_agg(to_jsonb(l) order by id),'[]') from public.slm_group_ledger l")
    b3body=dict(name="B3 privacy alpha",description="Public description",request_id=str(uuid.uuid4()))
    ga=rpc(6,"groups:create",b3body)["group_id"]
    check(rpc(6,"groups:create",b3body)["group_id"]==ga,"B3 create retry is idempotent")
    gb=rpc(9,"groups:create",dict(name="B3 privacy beta"))["group_id"]
    check(sql(f"select count(*) from public.slm_group_members where group_id='{ga}'")=="1" and sql(f"select admin_id from public.slm_groups where id='{ga}'")==users[6],"B3 atomic creator membership and group admin")
    public=rpc(8,"groups:search",dict(query="B3 privacy"))["groups"]
    check(len(public)==2 and all(set(row)=={"id","name","description","member_count"} for row in public),"B3 search returns only public projection and actual counts")
    check(not rpc(8,"groups:list",{})["groups"],"B3 search does not create membership")
    rpc(6,"groups:invite",dict(group_id=ga,user_id=users[7]))
    invite=next(r for r in rpc(7,"groups:inbox",{})["requests"] if r["group_id"]==ga)
    rpc(7,"groups:detail",dict(group_id=ga),expected="not_found");check(True,"B3 invitation alone grants no private access")
    rpc(7,"groups:decide",dict(id=invite["id"],accept=True))
    sql(f"update public.slm_profiles set full_name='Adam PrivateSurname',display_as='full_name' where user_id='{users[8]}'")
    rpc(8,"groups:join",dict(group_id=ga))
    request=next(r for r in rpc(6,"groups:detail",dict(group_id=ga))["requests"] if r["kind"]=="join" and r["target_id"]==users[8])
    check(bool(request["contact_phone"]),"B3 admin sees voluntarily requesting user's phone")
    check(not any(r.get("contact_phone") for r in rpc(7,"groups:detail",dict(group_id=ga))["requests"]),"B3 ordinary member cannot see applicant phone")
    rpc(8,"groups:profile",dict(group_id=ga,user_id=users[7]),expected="not_found");check(True,"B3 pending applicant cannot read member profile")
    def raw_profile(viewer,target):
        claims=json.dumps(dict(sub=users[viewer],session_id=sessions[viewer],role="authenticated"))
        return sql("begin;set local role authenticated;select set_config('request.jwt.claims',"+literal(claims)+",true);select count(*) from public.slm_profiles where user_id="+literal(users[target])+";rollback;").splitlines()[-1]
    check(raw_profile(7,8)=="0" and raw_profile(6,8)=="1","B3 raw RLS hides pending private profile from member but permits group admin")
    rpc(6,"groups:decide",dict(id=request["id"],accept=True))
    rpc(6,"groups:decide",dict(id=request["id"],accept=True),expected="request_processed");check(True,"B3 repeated acceptance cannot duplicate membership")
    projection=rpc(7,"groups:profile",dict(group_id=ga,user_id=users[8]))
    check(projection["full_name"] is None and projection["contact_phone"] and projection["nickname"]!="Adam PrivateSurname","B3 accepted member sees phone and public nickname without surname consent")
    check(rpc(6,"groups:profile",dict(group_id=ga,user_id=users[8]))["full_name"]=="Adam PrivateSurname","B3 group admin sees allowed management profile")
    check(raw_profile(7,8)=="0","B3 direct REST-equivalent RLS cannot bypass private surname")
    check("PrivateSurname" not in sql(f"select slm_private.player_name('{users[8]}')"),"B3 unscoped participant label never reveals hidden surname")
    rpc(8,"groups:consent",dict(group_id=ga,share_full_name=True))
    check(rpc(7,"groups:profile",dict(group_id=ga,user_id=users[8]))["full_name"]=="Adam PrivateSurname" and raw_profile(7,8)=="1","B3 explicit group consent permits surname in projection and RLS")
    rpc(8,"groups:consent",dict(group_id=ga,share_full_name=False))
    check(raw_profile(7,8)=="0" and rpc(7,"groups:profile",dict(group_id=ga,user_id=users[8]))["full_name"] is None,"B3 withdrawing consent immediately hides surname")
    rpc(8,"groups:consent",dict(group_id=ga,share_full_name=True,user_id=users[7]),expected="invalid_input");check(True,"B3 cannot change another member's consent")
    rpc(7,"groups:permission",dict(group_id=ga,user_id=users[7],organizer=True),expected="forbidden");check(True,"B3 member cannot grant own permissions")
    rpc(9,"groups:detail",dict(group_id=ga),expected="not_found")
    rpc(9,"groups:profile",dict(group_id=ga,user_id=users[8]),expected="not_found");check(True,"B3 foreign group admin has no profile or member access")
    rpc(6,"groups:remove",dict(group_id=ga,user_id=users[6]),expected="forbidden");check(True,"B3 cannot remove current group admin")
    candidates=rpc(6,"groups:candidates",dict(group_id=ga,query="Fixture"))["players"]
    check(all(set(row)=={"id","name"} for row in candidates),"B3 candidate search never returns private profile fields")
    known=rpc(6,"groups:phone",dict(group_id=ga,phone='+48000000004'))
    unknown=rpc(6,"groups:phone",dict(group_id=ga,phone='+48000000999'))
    check(known==unknown=={"accepted":True},"B3 phone lookup acknowledgements do not enumerate users")
    check(all(r.get("target_id")!=users[4] for r in rpc(6,"groups:detail",dict(group_id=ga))["requests"] if r["kind"]=="invite"),"B3 private invitation target stays undisclosed")
    for actor in (7,8):
        before_phone=len([r for r in rpc(actor,"groups:detail",dict(group_id=ga))["requests"] if r["kind"]=="proposal"])
        for phone in ('+48000000004','+48000000999'):
            rpc(actor,"groups:phone",dict(group_id=ga,phone=phone))
            rpc(actor,"groups:phone",dict(group_id=ga,phone=phone))
        after_phone=len([r for r in rpc(actor,"groups:detail",dict(group_id=ga))["requests"] if r["kind"]=="proposal"])
        check(after_phone-before_phone==2,"B3 repeated phone proposals give equal opaque counts for known/unknown users, actor "+str(actor))
    private_invites=sql(f"select id from public.slm_group_requests where group_id='{ga}' and actor_id='{users[6]}' and private and kind='invite' limit 1")
    check(private_invites not in json.dumps(rpc(6,"groups:detail",dict(group_id=ga))),"B3 sender cannot infer private invitation status from request metadata")

    check(sql("select has_function_privilege('authenticated','public.slm_groups_dispatch(uuid,uuid,text,jsonb)','execute') or has_function_privilege('anon','public.slm_groups_dispatch(uuid,uuid,text,jsonb)','execute')")=="f","B3 group RPC cannot be called directly by client roles")
    check(sql("select has_function_privilege('authenticated','slm_private.group_profile(uuid,uuid,uuid)','execute')")=="f","B3 arbitrary viewer helper is not client callable")
    sql("begin;set local role authenticated;update public.slm_group_members set share_full_name=true;rollback;",expected="permission denied");check(True,"B3 direct membership or consent writes denied")
    rpc(5,"groups:join",dict(group_id=ga));racing=next(r for r in rpc(6,"groups:detail",dict(group_id=ga))["requests"] if r["kind"]=="join" and r["target_id"]==users[5])
    def decide_b3(accept):
        try:rpc(6,"groups:decide",dict(id=racing["id"],accept=accept));return "committed"
        except RuntimeError as e:
            if "request_processed" in str(e):return "processed"
            raise
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:decisions=list(pool.map(decide_b3,[True,False]))
    check(sorted(decisions)==["committed","processed"],"B3 concurrent accept/reject has one winner")
    check(int(sql(f"select count(*) from public.slm_group_members where group_id='{ga}' and user_id='{users[5]}'"))<=1,"B3 concurrent decisions never duplicate member")
    rpc(6,"groups:remove",dict(group_id=ga,user_id=users[8]))
    rpc(8,"groups:detail",dict(group_id=ga),expected="not_found")
    check(raw_profile(8,7)=="0","B3 membership revocation removes API and direct RLS access")
    rpc(8,"groups:join",dict(group_id=ga));out=next(r for r in rpc(8,"groups:inbox",{})["outgoing"] if r["group_id"]==ga and r["state"]=="pending")
    rpc(8,"groups:cancel_request",dict(id=out["id"]))
    check(sql(f"select state from public.slm_group_requests where id='{out['id']}'")=="cancelled","B3 user can cancel own pending join request")
    rpc(8,"groups:join",dict(group_id=ga));rejected=next(r for r in rpc(6,"groups:detail",dict(group_id=ga))["requests"] if r["target_id"]==users[8] and r["state"]=="pending")
    rpc(6,"groups:decide",dict(id=rejected["id"],accept=False))
    check(sql(f"select count(*) from public.slm_group_members where group_id='{ga}' and user_id='{users[8]}'")=="0","B3 rejection does not grant membership")
    rpc(6,"groups:leave",dict(group_id=ga))
    check(sql(f"select admin_id from public.slm_groups where id='{ga}'")==users[7],"B3 leaving admin transfers role to oldest eligible member")
    rpc(9,"groups:leave",dict(group_id=gb))
    check(sql(f"select archived from public.slm_groups where id='{gb}'")=="t","B3 last member archives group without deleting history")
    check(ledger_before==sql("select coalesce(jsonb_agg(to_jsonb(l) order by id),'[]') from public.slm_group_ledger l"),"B3 membership operations preserve every historical ledger row")
    print(f"RESULT {passed} PASS; v2 real PostgreSQL tests")
finally:
    if created:
        result=command(["dropdb","-U","postgres",DB])
        if result.returncode: raise RuntimeError("Cannot remove own scratch database")
        print("Own scratch database removed; original database untouched")
