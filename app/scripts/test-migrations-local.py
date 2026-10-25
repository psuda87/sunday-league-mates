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
    function = "slm_settlements_dispatch" if finance else "slm_events_dispatch"
    query = "begin; set local role service_role; select public." + function + "(" + ",".join([
        literal(users[index]), literal(sessions[index]), literal(action), literal(json.dumps(body)) + "::jsonb"]) + ");"
    query += "rollback;" if rollback else "commit;"
    result = sql(query, expected=expected)
    return json.loads(result) if result else None

try:
    branch = subprocess.check_output(["git", "branch", "--show-current"], text=True).strip()
    assert branch in ("feat/integration","feat/v1-consolidation"), "Requires reviewed integration/consolidation branch"
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
    # Destroy application schemas ONLY in the newly-created scratch database.
    # Keep Auth/extensions infrastructure copied from the installed local Supabase version.
    cleaned=command(["psql","-X","-q","-U","supabase_admin","-d",DB,"-v","ON_ERROR_STOP=1"],b"drop schema public cascade; drop schema slm_private cascade; drop schema if exists slm_auth_proof_private cascade; create schema public; grant usage on schema public to anon,authenticated,service_role; grant all on schema public to postgres,service_role;")
    if cleaned.returncode: raise RuntimeError(cleaned.stderr.decode())
    migrations=sorted((Path(__file__).parents[1]/"supabase/migrations").glob("*.sql"))
    old=[p for p in migrations if p.name[:14]<"20261019000000"]
    new=[p for p in migrations if p not in old]
    for p in old:sql(p.read_text(encoding="utf-8"))
    check(len(old)==13,"all thirteen historical migrations replay from empty application schema")
    fixture="begin;"
    for i,(u,sid) in enumerate(zip(users[:2],sessions[:2])):
        fixture+=f"insert into auth.users(id,aud,role,email) values('{u}','authenticated','authenticated','{u}@fixture.invalid');"
        fixture+=f"select public.slm_account_provision('{u}','Fixture_{i:03d}','+48000000{i:03d}','{u}@fixture.invalid',null,null,{'true' if i==0 else 'false'});"
        fixture+=f"update public.slm_account_security set must_change_password=false where user_id='{u}';insert into auth.sessions(id,user_id) values('{sid}','{u}');select public.slm_account_accept_session('{u}','{sid}',1);"
    sql(fixture+"commit;")
    past=sql(f"insert into public.slm_events(starts_at,location,capacity,created_by) values(now()-interval '4 days','Fixture legacy',10,'{users[0]}') returning id")
    participant=sql(f"insert into public.slm_event_participants(event_id,member_id,responsible_user_id,status) values('{past}','{users[1]}','{users[1]}','registered') returning id")
    sql(f"insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot) select '{past}','{participant}','{users[0]}','{users[1]}','joined',now()-interval '4 days',now()-interval '4 days',false,jsonb_build_object('participant',to_jsonb(p),'previous_status',null) from public.slm_event_participants p where id='{participant}'")
    version=int(sql(f"select version from public.slm_settlements where event_id='{past}'"))
    rpc(0,"approve",dict(event_id=past,request_id=str(uuid.uuid4()),expected_version=version,reason="Fixture historical approval"),finance=True)
    before=sql("select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') from public.slm_finance_ledger l")
    aliases=sql("select jsonb_agg(to_jsonb(a) order by user_id) from public.slm_aliases a")
    dues=sql(f"select outstanding_cents from slm_private.finance_dues('{users[1]}') where event_id='{past}'")
    for p in new:sql(p.read_text(encoding="utf-8"))
    check(before==sql("select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') from public.slm_finance_ledger l"),"new migrations preserve every historical ledger row exactly")
    check(aliases==sql("select jsonb_agg(to_jsonb(a) order by user_id) from public.slm_aliases a"),"new migrations preserve legacy aliases and technical email")
    check(sql("select count(*) from public.slm_group_members")=="2","existing accounts mapped to one preserved legacy group")
    check(sql(f"select outstanding_cents from slm_private.group_dues('{users[1]}') where event_id='{past}'")==dues,"historical outstanding liability visible without recalculation")
    sql("begin;set local role service_role;select public.slm_groups_dispatch("+literal(users[1])+","+literal(sessions[1])+",'list','{}');rollback;")
    check(True,"existing accepted session remains valid for new group RPC")
    group=sql("select group_id from public.slm_legacy_scope")
    def scoped_finance(index,action,body):
        return json.loads(sql("begin;set local role service_role;select public.slm_group_finance_dispatch("+",".join([literal(users[index]),literal(sessions[index]),literal(action),literal(json.dumps(body))+"::jsonb"])+");commit;"))
    account=scoped_finance(1,"account",dict(group_id=group))
    check(account["dues"][0]["legacy"] is True,"legacy liability explicitly marked in new finance DTO")
    scoped_finance(0,"record_payment",dict(group_id=group,user_id=users[1],request_id=str(uuid.uuid4()),amount_cents=100,reason="Fixture legacy group repayment"))
    check(int(sql(f"select outstanding_cents from slm_private.group_dues('{users[1]}') where event_id='{past}'"))==int(dues)-100,"new general group payment reduces historical debt through scoped FIFO")
    check(before==sql("select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') from public.slm_finance_ledger l"),"historical repayment does not rewrite original ledger")
    print(f"RESULT {passed} PASS; replayed {len(migrations)} migrations with fictional legacy data")
finally:
    if created:
        result=command(["dropdb","-U","postgres",DB])
        if result.returncode:raise RuntimeError("Cannot remove own scratch database")
        print("Own scratch database removed; original database untouched")
