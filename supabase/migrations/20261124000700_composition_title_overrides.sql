create function public.kf_composition_titles() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare titles jsonb;
begin
 if not public.kf_is_admin() then raise insufficient_privilege; end if;
 select coalesce(jsonb_object_agg(split_part(entry_key,':',4),entry_value),'{}'::jsonb) into titles from
 (select distinct on(entry_key) entry_key,entry_value from kf_modular.snapshot_entries
 where entry_key ~ '^kimflora_knowledge_title_v1:kimflora_knowledge_edit_v1:compositionKnowledgePage:[0-9]+$'
 order by entry_key,(area='local') desc) t;
 return titles;
end $$;
revoke all on function public.kf_composition_titles() from public,anon;
grant execute on function public.kf_composition_titles() to authenticated;