create function public.kf_read_admin_content_part(
  p_key text,
  p_offset integer default 0,
  p_version text default null
) returns jsonb
language sql stable security invoker
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'version', content.updated_at::text,
    'length', pg_catalog.length(payload.value),
    'part', pg_catalog.substr(payload.value, p_offset + 1, 3000000)
  )
  from public.kf_content content
  cross join lateral (select content.content_value::text as value) payload
  where content.content_key = p_key
    and p_key in ('published/main','published/snapshot')
    and p_offset >= 0
    and p_offset % 3000000 = 0
    and (p_version is null or content.updated_at::text = p_version);
$function$;
revoke all on function public.kf_read_admin_content_part(text,integer,text) from public, anon;
grant execute on function public.kf_read_admin_content_part(text,integer,text) to authenticated;
