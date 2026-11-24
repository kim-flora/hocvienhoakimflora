create table kf_modular.outline_labels (item_key text primary key references kf_modular.document_fragments(child_key),title text not null,revision bigint not null default 1);
alter table kf_modular.outline_labels enable row level security;
revoke all on kf_modular.outline_labels from public,anon,authenticated;
create function public.kf_outline_labels(p_page text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not public.kf_is_admin() then raise insufficient_privilege; end if;
return (select coalesce(jsonb_object_agg(item_key,jsonb_build_object('title',title,'revision',revision)),'{}') from kf_modular.outline_labels where item_key=p_page or split_part(item_key,'/',1)=p_page); end $$;
create function public.kf_edit_outline(p_page text,p_key text,p_title text,p_revision bigint) returns text language plpgsql security definer set search_path='' as $$
declare k text:=p_key; written text;
begin if not public.kf_is_admin() then raise insufficient_privilege; end if;
if not exists(select from kf_modular.document_fragments where parent_key='root' and child_key=p_page) or nullif(trim(p_title),'') is null then raise invalid_parameter_value; end if;
if k is null then k:=p_page||'/added-'||gen_random_uuid()::text;
insert into kf_modular.document_fragments values('@'||k,0,k,null),(k,0,null,'<div class="knowledge-content"></div>');
elsif split_part(k,'/',1)<>p_page then raise invalid_parameter_value; end if;
if p_revision=0 then insert into kf_modular.outline_labels(item_key,title) values(k,trim(p_title)) on conflict do nothing returning item_key into written;
else update kf_modular.outline_labels set title=trim(p_title),revision=revision+1 where item_key=k and revision=p_revision returning item_key into written; end if;
if written is null then raise exception using errcode='40001',message='Tiêu đề đã thay đổi'; end if; return written; end $$;
revoke all on function public.kf_outline_labels(text),public.kf_edit_outline(text,text,text,bigint) from public,anon;
grant execute on function public.kf_outline_labels(text),public.kf_edit_outline(text,text,text,bigint) to authenticated;