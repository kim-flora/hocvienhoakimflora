-- Seed an isolated working copy. The legacy site continues to own published data.
create table kf_modular.lesson_sections (
  area text not null,
  entry_key text not null,
  section_id text not null,
  position bigint not null,
  metadata jsonb not null,
  body jsonb not null,
  revision bigint not null default 1,
  primary key (area, entry_key, section_id),
  unique (area, entry_key, position)
);
alter table kf_modular.lesson_sections enable row level security;
revoke all on kf_modular.lesson_sections from public, anon, authenticated;

insert into kf_modular.lesson_sections (area, entry_key, section_id, position, metadata, body)
select e.area, e.entry_key, item->>'id', ord, item - 'content', item->'content'
from kf_modular.snapshot_entries e
cross join lateral jsonb_array_elements(case when e.entry_key like 'kimflora_knowledge_extra_sections_v1:%' then (e.entry_value #>> '{}')::jsonb else '[]'::jsonb end)
with ordinality as parts(item, ord);

-- Abort the migration if even one section field or its order changed.
do $verify$
begin
  if exists (
    select 1 from kf_modular.snapshot_entries e
    where e.entry_key like 'kimflora_knowledge_extra_sections_v1:%'
    and (e.entry_value #>> '{}')::jsonb is distinct from (
      select coalesce(jsonb_agg(s.metadata || jsonb_build_object('content', s.body) order by s.position), '[]'::jsonb)
      from kf_modular.lesson_sections s where (s.area,s.entry_key) = (e.area,e.entry_key)
    )
  ) then raise exception 'Section round-trip mismatch'; end if;
end
$verify$;