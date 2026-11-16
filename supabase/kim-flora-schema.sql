-- Kim Flora: Supabase authorization foundation.
-- Run in a NEW Supabase project via SQL Editor.
-- IMPORTANT: Replace the UUID in the final INSERT with the actual Auth user UUID.
-- This script does not modify any existing GitHub Pages HTML.

create schema if not exists private;

create table if not exists private.kim_flora_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on schema private from public, anon, authenticated;
revoke all on private.kim_flora_admins from public, anon, authenticated;

create or replace function public.kf_is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.kim_flora_admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.kf_is_admin() from public;
grant execute on function public.kf_is_admin() to anon, authenticated;

create table if not exists public.kf_content (
  content_key text primary key,
  content_value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint kf_content_key_limit check (char_length(content_key) between 1 and 240)
);

create index if not exists kf_content_updated_at_idx on public.kf_content(updated_at desc);

alter table public.kf_content enable row level security;
revoke all on public.kf_content from public;
grant select on public.kf_content to anon, authenticated;
grant insert, update, delete on public.kf_content to authenticated;

drop policy if exists "kf_public_read" on public.kf_content;
create policy "kf_public_read" on public.kf_content
  for select to anon, authenticated using (true);

drop policy if exists "kf_admin_insert" on public.kf_content;
create policy "kf_admin_insert" on public.kf_content
  for insert to authenticated
  with check (public.kf_is_admin() and updated_by = (select auth.uid()));

drop policy if exists "kf_admin_update" on public.kf_content;
create policy "kf_admin_update" on public.kf_content
  for update to authenticated
  using (public.kf_is_admin())
  with check (public.kf_is_admin() and updated_by = (select auth.uid()));

drop policy if exists "kf_admin_delete" on public.kf_content;
create policy "kf_admin_delete" on public.kf_content
  for delete to authenticated using (public.kf_is_admin());

-- A public bucket is suitable ONLY for images intentionally visible to guests.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kf-public-images', 'kf-public-images', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "kf_images_public_read" on storage.objects;
create policy "kf_images_public_read" on storage.objects
for select to anon, authenticated
using (bucket_id = 'kf-public-images');

drop policy if exists "kf_images_admin_insert" on storage.objects;
create policy "kf_images_admin_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'kf-public-images' and public.kf_is_admin());

drop policy if exists "kf_images_admin_update" on storage.objects;
create policy "kf_images_admin_update" on storage.objects
for update to authenticated
using (bucket_id = 'kf-public-images' and public.kf_is_admin())
with check (bucket_id = 'kf-public-images' and public.kf_is_admin());

drop policy if exists "kf_images_admin_delete" on storage.objects;
create policy "kf_images_admin_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'kf-public-images' and public.kf_is_admin());

-- After creating the owner's account in Supabase Auth, run once:
-- INSERT INTO private.kim_flora_admins (user_id) VALUES ('PUT-OWNER-AUTH-UUID-HERE');
