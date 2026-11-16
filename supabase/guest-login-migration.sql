-- Run AFTER the initial Kim Flora schema.
-- Require Supabase Auth login to read. Only admins can write.
begin;
revoke select on public.kf_content from anon;
drop policy if exists "kf_public_read" on public.kf_content;
create policy "kf_authenticated_read" on public.kf_content
  for select to authenticated using (true);

-- Storage bucket must no longer be publicly readable.
update storage.buckets set public=false where id='kf-public-images';
drop policy if exists "kf_images_public_read" on storage.objects;
create policy "kf_images_authenticated_read" on storage.objects
  for select to authenticated using (bucket_id='kf-public-images');
commit;
-- DO NOT assume this hides existing material embedded in public GitHub HTML.
-- Existing public image URLs may already have been cached externally.
