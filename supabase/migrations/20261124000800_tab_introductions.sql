-- Independent editable introductory content for each existing subject tab.
with pages as (select child_key as page, position from kf_modular.document_fragments where parent_key='root' and child_key is not null)
insert into kf_modular.document_fragments(parent_key,position,child_key,markup)
select '@introductions',position,page||'/intro',null from pages
union all select page||'/intro',0,null,'<div class="kf-tab-introduction"></div>' from pages;