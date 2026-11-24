create or replace function public.kf_export_modular_backup() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.kf_is_admin() then raise insufficient_privilege; end if;
  return jsonb_build_object(
    'format','kim-flora-modular-v1','exported_at',statement_timestamp(),
    'fragments',(select coalesce(jsonb_agg(f order by parent_key,position),'[]') from kf_modular.document_fragments f),
    'labels',(select coalesce(jsonb_agg(l),'[]') from kf_modular.outline_labels l),
    'sections',(select coalesce(jsonb_agg(s),'[]') from kf_modular.lesson_sections s),
    'edits',(select coalesce(jsonb_agg(e),'[]') from kf_modular.lesson_edits e),
    'history',(select coalesce(jsonb_agg(h),'[]') from kf_modular.lesson_history h),
    'snapshot_entries',(select coalesce(jsonb_agg(s),'[]') from kf_modular.snapshot_entries s));
end $$;
revoke all on function public.kf_export_modular_backup() from public,anon;
grant execute on function public.kf_export_modular_backup() to authenticated;