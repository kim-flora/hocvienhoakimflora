create function public.kf_open_lesson(p_key text,p_area text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item kf_modular.lesson_edits%rowtype; parts jsonb; wrapper text; tag text;
begin
 if not public.kf_is_admin() then raise insufficient_privilege; end if;
 if p_area not in ('local','indexed') or p_area is null or strpos(p_key,'/')=0 then raise invalid_parameter_value; end if;
 parts:=public.kf_read_page_fragment(p_key);
 select * into item from kf_modular.lesson_edits where lesson_key=p_key and (area=p_area or p_area='local' and area='indexed')
 order by (area=p_area) desc limit 1;
 if found and jsonb_array_length(parts)=1 then
   wrapper:=parts->0->>'html';
   tag:=substring(wrapper from '^<div(?:[^>"'']|"[^"]*"|''[^'']*'')*>');
   if tag is not null and right(lower(wrapper),6)='</div>' then parts:=jsonb_build_array(jsonb_build_object('html',tag||'</div>')); end if;
 end if;
 return jsonb_build_object('key',p_key,'area',coalesce(item.area,p_area),'original',parts,'body',item.body,'revision',coalesce(item.revision,0));
end $$;
revoke all on function public.kf_open_lesson(text,text) from public,anon;
grant execute on function public.kf_open_lesson(text,text) to authenticated;