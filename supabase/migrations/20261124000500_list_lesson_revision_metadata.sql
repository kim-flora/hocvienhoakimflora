create function public.kf_list_lesson_revisions(p_key text,p_area text,p_before bigint default null)
returns table(revision bigint, archived_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.kf_is_admin() then raise insufficient_privilege; end if;
 return query select h.revision,h.archived_at from kf_modular.lesson_history h
 where h.lesson_key=p_key and h.area=p_area and (p_before is null or h.revision<p_before)
 order by h.revision desc limit 50;
end $$;
revoke all on function public.kf_list_lesson_revisions(text,text,bigint) from public,anon;
grant execute on function public.kf_list_lesson_revisions(text,text,bigint) to authenticated;