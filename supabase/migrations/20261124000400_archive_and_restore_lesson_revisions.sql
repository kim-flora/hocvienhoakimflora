-- Preserve the exact revision replaced by each modular edit.
create table kf_modular.lesson_history (
 lesson_key text not null, area text not null, revision bigint not null,
 body jsonb not null, archived_at timestamptz not null default now(),
 primary key(lesson_key,area,revision)
);
alter table kf_modular.lesson_history enable row level security;
revoke all on kf_modular.lesson_history from public,anon,authenticated;
create function kf_modular.archive_lesson_revision() returns trigger
language plpgsql set search_path='' as $$
begin
 insert into kf_modular.lesson_history(lesson_key,area,revision,body)
 values(old.lesson_key,old.area,old.revision,old.body);
 return new;
end $$;
create trigger archive_lesson_revision before update on kf_modular.lesson_edits
for each row execute function kf_modular.archive_lesson_revision();

create function public.kf_restore_lesson_revision(p_key text,p_area text,p_saved_revision bigint,p_current_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare prior jsonb;
begin
 if not public.kf_is_admin() then raise insufficient_privilege; end if;
 select body into strict prior from kf_modular.lesson_history
 where lesson_key=p_key and area=p_area and revision=p_saved_revision;
 return public.kf_save_lesson_edit(p_key,p_area,p_current_revision,prior);
end $$;
revoke all on function public.kf_restore_lesson_revision(text,text,bigint,bigint) from public,anon;
grant execute on function public.kf_restore_lesson_revision(text,text,bigint,bigint) to authenticated;