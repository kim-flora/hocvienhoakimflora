# Kim Flora — Supabase authorization setup (not deployed)

## Scope
This branch adds database/server-enforced authorization only. It **does not** replace or alter the existing `index.html`, tabs, lessons, styles, or browser-stored content. The GitHub Pages site is unchanged until a separately reviewed frontend migration is completed.

## Required manual steps
1. Create a Supabase project that you own. Enable email/password sign-in under Authentication; disable open sign-ups if only one admin is intended.
2. In Supabase SQL Editor run `supabase/kim-flora-schema.sql` in the new project.
3. Create your owner user in Supabase Auth; copy that user's UUID from Authentication → Users.
4. In SQL Editor run `insert into private.kim_flora_admins (user_id) values ('YOUR-AUTH-USER-UUID');` with the real UUID.
5. Collect the Supabase **Project URL** and **publishable/anon key** (these are client-side public values). Never share or commit a `service_role` key or account password.
6. Only then integrate the frontend: guest read + search by default, admin login/logout and password change through Supabase Auth, and every mutation through `kf_content` or `kf-public-images`.
7. Before moving any browser data, export/backup `localStorage` and `IndexedDB` contents for the relevant origin. Existing browser data does **not** automatically migrate.
8. Test guest direct REST INSERT/UPDATE/DELETE (must fail), admin writes (must pass), and multi-device reload before deployment.

## Storage model
- `public.kf_content`: keyed JSON documents; readable by guests and admins; writes restricted by RLS to allowlisted admins. Never store secrets or private documents in this public table.
- `private.kim_flora_admins`: admin allowlist managed only in SQL Editor by privileged operators.
- `storage` bucket `kf-public-images`: public images (not private assets), with writes restricted to admins.

## Important cautions
- Hiding editing buttons is a usability measure, **not** authorization. Database Row Level Security is the write barrier.
- GitHub Pages remains a static public host and cannot itself secure any password embedded in HTML.
- Source code and any content bundled directly into a publicly served HTML file remain publicly retrievable.
- The schema is a foundation, **not a completed deployed authentication system**. Do not claim that guests are protected until login, content persistence, migration and tests are wired up.
