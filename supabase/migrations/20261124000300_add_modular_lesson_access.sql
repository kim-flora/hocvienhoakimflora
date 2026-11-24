create function public.kf_read_page_fragment(p_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 if not public.kf_is_admin() then raise insufficient_privilege; end if;
 select jsonb_agg(case when child_key is null then jsonb_build_object('html',markup)
 else jsonb_build_object('child',child_key) end order by position) into result
 from kf_modular.document_fragments where parent_key=p_key;
 if result is null then raise no_data_found; end if;
 return result;
end $$;
revoke all on function public.kf_read_page_fragment(text) from public, anon;
grant execute on function public.kf_read_page_fragment(text) to authenticated;

-- Preserve separate edited versions and reject stale writes atomically.
create table kf_modular.lesson_edits (
 lesson_key text not null references kf_modular.document_fragments(child_key),
 area text not null check (area in ('local','indexed')),
 body jsonb not null, revision bigint not null default 1,
 primary key (lesson_key,area)
);
alter table kf_modular.lesson_edits enable row level security;
revoke all on kf_modular.lesson_edits from public,anon,authenticated;
insert into kf_modular.lesson_edits(lesson_key,area,body)
select f.child_key,e.area,e.entry_value from kf_modular.document_fragments f
join kf_modular.snapshot_entries e on e.entry_key='kimflora_knowledge_edit_v1:'||replace(f.child_key,'/',':')
where strpos(f.child_key,'/')>0;

create function public.kf_read_lesson_edit(p_key text,p_area text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.kf_is_admin() then raise insufficient_privilege; end if;
 return (select jsonb_build_object('body',body,'revision',revision)
 from kf_modular.lesson_edits where lesson_key=p_key and area=p_area);
end $$;
create function public.kf_save_lesson_edit(p_key text,p_area text,p_revision bigint,p_body jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare saved bigint;
begin
 if not public.kf_is_admin() then raise insufficient_privilege; end if;
 if strpos(p_key,'/')=0 or jsonb_typeof(p_body) is distinct from 'string' then raise invalid_parameter_value; end if;
 if p_revision=0 then
  insert into kf_modular.lesson_edits(lesson_key,area,body) values(p_key,p_area,p_body)
  on conflict do nothing returning revision into saved;
 else
  update kf_modular.lesson_edits set body=p_body,revision=revision+1
  where lesson_key=p_key and area=p_area and revision=p_revision returning revision into saved;
 end if;
 if saved is null then raise exception using errcode='40001',message='Lesson changed since it was opened'; end if;
 return saved;
end $$;
revoke all on function public.kf_read_lesson_edit(text,text), public.kf_save_lesson_edit(text,text,bigint,jsonb) from public,anon;
grant execute on function public.kf_read_lesson_edit(text,text), public.kf_save_lesson_edit(text,text,bigint,jsonb) to authenticated;