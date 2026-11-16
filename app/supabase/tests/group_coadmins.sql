-- Run only inside a disposable scratch database or a rolled-back dry run, never committed on Cloud.
begin;
do $$
declare a uuid:='92000000-0000-4000-8000-00000000000a'; b uuid:='92000000-0000-4000-8000-00000000000b';
 c uuid:='92000000-0000-4000-8000-00000000000c'; d uuid:='92000000-0000-4000-8000-00000000000d';
 sa uuid:='93000000-0000-4000-8000-00000000000a'; sb uuid:='93000000-0000-4000-8000-00000000000b';
 sc uuid:='93000000-0000-4000-8000-00000000000c'; sd uuid:='93000000-0000-4000-8000-00000000000d';
 g uuid; r jsonb; r2 jsonb; who uuid; ses uuid; k int:=0;
begin
 foreach who in array array[a,b,c,d] loop
  k:=k+1; ses:=(array[sa,sb,sc,sd])[k];
  insert into auth.users(id,email) values(who,'coadmin-'||k||'@fixture.invalid');
  insert into auth.sessions(id,user_id) values(ses,who);
  insert into public.slm_account_security(user_id,must_change_password,security_version,active) values(who,false,1,true)
   on conflict(user_id) do update set must_change_password=false,security_version=1,active=true,operation_id=null;
  insert into public.slm_account_sessions(session_id,user_id,security_version) values(ses,who,1);
  insert into public.slm_roles(user_id,role) values(who,'member') on conflict do nothing;
  insert into public.slm_profiles(user_id,full_name) values(who,'') on conflict do nothing;
 end loop;
 r:=public.slm_groups_dispatch(a,sa,'create',jsonb_build_object('name','Coadmin test','description','','request_id',gen_random_uuid()));
 g:=(r->>'group_id')::uuid;
 insert into public.slm_group_members(group_id,user_id) values(g,b),(g,c),(g,d);

 -- Tylko administrator główny nadaje uprawnienia administratora.
 begin perform public.slm_groups_dispatch(b,sb,'admin_grant',jsonb_build_object('group_id',g,'user_id',c,'request_id',gen_random_uuid()));
  raise exception 'member granted admin';exception when raise_exception then if sqlerrm<>'forbidden' then raise;end if;end;
 r:=jsonb_build_object('group_id',g,'user_id',b,'request_id','94000000-0000-4000-8000-000000000001');
 r2:=public.slm_groups_dispatch(a,sa,'admin_grant',r);
 if not slm_private.group_admin(g,b) or not slm_private.group_finance_admin(g,b) then raise exception 'co-admin lacks admin/finance';end if;
 if public.slm_groups_dispatch(a,sa,'admin_grant',r)<>r2 then raise exception 'grant replay not idempotent';end if;
 if slm_private.group_owner(g,b) then raise exception 'co-admin became owner';end if;

 -- Współadministrator nie nadaje adminów, nie przekazuje grupy, nie usuwa właściciela.
 begin perform public.slm_groups_dispatch(b,sb,'admin_grant',jsonb_build_object('group_id',g,'user_id',c,'request_id',gen_random_uuid()));
  raise exception 'co-admin granted admin';exception when raise_exception then if sqlerrm<>'forbidden' then raise;end if;end;
 begin perform public.slm_groups_dispatch(b,sb,'transfer',jsonb_build_object('group_id',g,'user_id',c,'request_id',gen_random_uuid()));
  raise exception 'co-admin transferred';exception when raise_exception then if sqlerrm<>'forbidden' then raise;end if;end;
 begin perform public.slm_groups_dispatch(b,sb,'remove',jsonb_build_object('group_id',g,'user_id',a,'request_id',gen_random_uuid()));
  raise exception 'co-admin removed owner';exception when raise_exception then if sqlerrm<>'forbidden' then raise;end if;end;

 -- Współadministrator zarządza zwykłymi członkami i nazwą grupy.
 perform public.slm_groups_dispatch(b,sb,'permission',jsonb_build_object('group_id',g,'user_id',c,'organizer',true,'request_id',gen_random_uuid()));
 if not (select organizer from public.slm_group_members where group_id=g and user_id=c) then raise exception 'co-admin permission failed';end if;
 perform public.slm_groups_dispatch(b,sb,'rename',jsonb_build_object('group_id',g,'name','Coadmin test 2'));
 if (select name from public.slm_groups where id=g)<>'Coadmin test 2' then raise exception 'co-admin rename failed';end if;

 -- Innego współadministratora może usunąć tylko administrator główny.
 perform public.slm_groups_dispatch(a,sa,'admin_grant',jsonb_build_object('group_id',g,'user_id',c,'request_id',gen_random_uuid()));
 begin perform public.slm_groups_dispatch(b,sb,'remove',jsonb_build_object('group_id',g,'user_id',c,'request_id',gen_random_uuid()));
  raise exception 'co-admin removed co-admin';exception when raise_exception then if sqlerrm<>'forbidden' then raise;end if;end;
 perform public.slm_groups_dispatch(b,sb,'remove',jsonb_build_object('group_id',g,'user_id',d,'request_id',gen_random_uuid()));
 if slm_private.group_member(g,d) then raise exception 'co-admin could not remove member';end if;

 -- Projekcje: flagi admin/owner w szczegółach i na liście grup.
 r:=public.slm_groups_dispatch(b,sb,'detail',jsonb_build_object('group_id',g));
 if not exists(select 1 from jsonb_array_elements(r->'members') m where m->>'user_id'=b::text and (m->>'admin')::boolean and not (m->>'owner')::boolean)
  or not exists(select 1 from jsonb_array_elements(r->'members') m where m->>'user_id'=a::text and (m->>'owner')::boolean and (m->>'admin')::boolean)
  then raise exception 'detail flags wrong: %',r->'members';end if;
 r:=public.slm_groups_dispatch(b,sb,'list','{}'::jsonb);
 if not exists(select 1 from jsonb_array_elements(r->'groups') x where x->>'id'=g::text and (x->>'admin')::boolean) then raise exception 'list admin flag missing';end if;

 -- Odejście administratora głównego: przejmuje najstarszy współadministrator (b przed c).
 perform public.slm_groups_dispatch(a,sa,'leave',jsonb_build_object('group_id',g,'request_id',gen_random_uuid()));
 if (select admin_id from public.slm_groups where id=g)<>b then raise exception 'succession did not pick oldest co-admin';end if;
 if (select admin from public.slm_group_members where group_id=g and user_id=b) then raise exception 'new owner still flagged co-admin';end if;
 if not slm_private.group_admin(g,c) then raise exception 'other co-admin lost rights';end if;
 perform public.slm_groups_dispatch(b,sb,'admin_revoke',jsonb_build_object('group_id',g,'user_id',c,'request_id',gen_random_uuid()));
 if slm_private.group_admin(g,c) then raise exception 'revoke failed';end if;

 if has_function_privilege('authenticated','slm_private.groups_dispatch_coadmin_base(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('anon','slm_private.group_owner(uuid,uuid)','execute') then raise exception 'new functions exposed';end if;
 raise notice 'PASS group co-admins';
end $$;
rollback;
