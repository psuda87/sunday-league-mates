-- Private resolver data only; password proof in Edge precedes any provisioning.
begin;
create or replace function public.slm_model_resolve(p_identifier text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare k text; r public.slm_identity_registry; auth_data jsonb; j public.slm_signup_jobs; pending_user uuid;begin
 if not public.slm_model_ready() then raise exception 'model_inactive';end if;
 if position('@' in p_identifier)>0 then
  select * into r from public.slm_identity_registry where email_login=lower(btrim(p_identifier));
 else
  begin k:=slm_private.identity_key(p_identifier);exception when others then return null;end;
  select * into r from public.slm_identity_registry where nickname_key=k;
 end if;
 if r.user_id is null then
  if position('@' in p_identifier)>0 or k is null then return null;end if;
  select * into j from public.slm_signup_jobs where nickname_key=k and completed_user is null;
  if j.request_id is null then return null;end if;
  pending_user:=public.slm_model_signup_user(j.request_id,j.secret_hash);
  if pending_user is null then return null;end if;
  return jsonb_build_object('user_id',pending_user,'technical_email',j.auth_email,'pending',true,'request_id',j.request_id,'secret_hash',j.secret_hash);
 end if;
 auth_data:=slm_private.identity_auth(r.user_id);
 if auth_data is null or not (auth_data->>'confirmed')::boolean or auth_data->>'technical_email' is distinct from r.auth_email then return null;end if;
 return jsonb_build_object('user_id',r.user_id,'technical_email',r.auth_email);
end$$;

commit;
