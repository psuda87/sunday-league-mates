"""READ ONLY local account audit. Only anonymous IDs/categories reach stdout/report."""
from pathlib import Path
import subprocess, json, secrets
ROOT=Path(__file__).resolve().parents[2]
host=subprocess.check_output(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
assert host.startswith(('npipe://','unix://'))
cache=ROOT/'.cache';cache.mkdir(exist_ok=True)
saltfile=cache/'account-audit-salt';salt=saltfile.read_text() if saltfile.exists() else secrets.token_hex(24)
saltfile.write_text(salt)
query=r"""begin read only;
select coalesce(jsonb_agg(to_jsonb(report)),'[]'::jsonb) from (
select 'acct-'||substr(md5(u.id::text||'SALT'),1,12) id,
 case when n.nickname is not null then 'name-'||substr(md5(lower(normalize(btrim(n.nickname),NFC))||'SALT'),1,12) end nickname_group,
 array_remove(array[
 case when p.user_id is null then 'missing_profile' end,
 case when n.user_id is null or btrim(n.nickname)='' then 'missing_nickname' end,
 case when n.nickname is not null and normalize(btrim(n.nickname),NFC)!~'^[[:alpha:]][[:alnum:]_.-]{2,31}$' then 'invalid_nickname_format' end,
 case when n.nickname is not null and (select count(*) from public.slm_player_profiles x where lower(normalize(btrim(x.nickname),NFC))=lower(normalize(btrim(n.nickname),NFC)))>1 then 'duplicate_nickname' end,
 case when n.nickname is not null and exists(select 1 from public.slm_aliases x where x.user_id<>u.id and lower(normalize(btrim(x.login),NFC))=lower(normalize(btrim(n.nickname),NFC))) then 'old_login_collision' end,
 case when s.user_id is null or r.user_id is null then 'missing_security_or_role' end,
 case when s.operation_id is not null then 'operation_pending' end,
 case when n.email_account and a.user_id is not null then 'mixed_account_kind' end,
 case when a.user_id is not null and a.technical_email is distinct from u.email then 'auth_email_mismatch' end,
 case when a.phone is not null and a.phone!~'^\+48[0-9]{9}$' then 'foreign_legacy_contact_requires_decision' end,
 case when a.phone is not null and n.contact_phone is not null and a.phone<>n.contact_phone then 'contact_mismatch' end,
 case when u.email is null then 'missing_internal_auth_email' end,
 case when u.email_confirmed_at is null then 'unconfirmed_auth_email' end,
 case when a.user_id is not null then 'personal_email_absent_expected' end
 ],null) flags
from auth.users u left join public.slm_profiles p on p.user_id=u.id
left join public.slm_player_profiles n on n.user_id=u.id left join public.slm_aliases a on a.user_id=u.id
left join public.slm_account_security s on s.user_id=u.id left join public.slm_roles r on r.user_id=u.id order by 1)report;
rollback;""".replace('SALT',salt)
results={}
for label,name in [('developer','supabase_db_sunday-league-mates'),('pr16','supabase_db_slm-pr16-review'),('foundation','supabase_db_slm-account-foundation')]:
 r=subprocess.run(['docker','exec','-i',name,'psql','-X','-At','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True)
 if r.returncode:
  results[label]={'unavailable':True};print(label,'UNAVAILABLE; no writes attempted');continue
 rows=json.loads(next((x for x in r.stdout.splitlines() if x.startswith('[')),'[]'));counts={}
 for row in rows:
  for flag in row['flags']:counts[flag]=counts.get(flag,0)+1
 results[label]={'accounts':len(rows),'counts':counts,'issues':[x for x in rows if any(y!='personal_email_absent_expected' for y in x['flags'])]}
 print(label,len(rows),counts)
(cache/'account-migration-audit.json').write_text(json.dumps(results,indent=2),encoding='utf8')
