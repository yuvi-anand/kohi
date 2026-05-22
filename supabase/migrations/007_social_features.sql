-- 007_social_features.sql
-- Features: profile pictures, rating photos, comments/likes on ratings

-- ── 1. Profile pictures ───────────────────────────────────────────────────────
alter table profiles add column if not exists avatar_url text;

-- Storage bucket note: create bucket "avatars" in the Supabase dashboard
-- (Storage → New bucket → name: "avatars", public: true)
-- Then add a storage policy allowing authenticated users to upload to avatars/{userId}:
--   CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT
--     TO authenticated WITH CHECK (bucket_id = 'avatars' AND name = auth.uid()::text);
--   CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT
--     TO public USING (bucket_id = 'avatars');
--   CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE
--     TO authenticated USING (bucket_id = 'avatars' AND name = auth.uid()::text);

-- ── 2. Rating photos ──────────────────────────────────────────────────────────
alter table ratings add column if not exists photo_url text;
alter table ratings add column if not exists drink_type text;

-- Storage bucket note: create bucket "rating-photos" in the Supabase dashboard
-- (Storage → New bucket → name: "rating-photos", public: true)
-- Then add policies:
--   CREATE POLICY "Users upload own rating photos" ON storage.objects FOR INSERT
--     TO authenticated WITH CHECK (bucket_id = 'rating-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
--   CREATE POLICY "Anyone can view rating photos" ON storage.objects FOR SELECT
--     TO public USING (bucket_id = 'rating-photos');

-- Fix ratings unique constraint to include drink_type if it doesn't already
-- (original schema only had unique(user_id, shop_id); the app expects user_id,shop_id,drink_type)
-- This is handled by the app's upsertRating using onConflict: 'user_id,shop_id,drink_type'
-- If you need to fix the constraint manually run:
-- ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_user_id_shop_id_key;
-- ALTER TABLE ratings ADD CONSTRAINT ratings_user_id_shop_id_drink_type_key UNIQUE (user_id, shop_id, drink_type);

-- ── 3. Rating likes ───────────────────────────────────────────────────────────
create table if not exists rating_likes (
  id         uuid primary key default gen_random_uuid(),
  rating_id  uuid references ratings(id) on delete cascade not null,
  user_id    uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  unique (rating_id, user_id)
);

alter table rating_likes enable row level security;

drop policy if exists "Anyone can read rating likes" on rating_likes;
drop policy if exists "Users insert own rating likes" on rating_likes;
drop policy if exists "Users delete own rating likes" on rating_likes;

create policy "Anyone can read rating likes" on rating_likes
  for select using (true);
create policy "Users insert own rating likes" on rating_likes
  for insert with check (auth.uid() = user_id);
create policy "Users delete own rating likes" on rating_likes
  for delete using (auth.uid() = user_id);

-- ── 4. Rating comments ────────────────────────────────────────────────────────
create table if not exists rating_comments (
  id         uuid primary key default gen_random_uuid(),
  rating_id  uuid references ratings(id) on delete cascade not null,
  user_id    uuid references auth.users on delete cascade not null,
  text       text not null,
  created_at timestamptz default now()
);

alter table rating_comments enable row level security;

drop policy if exists "Anyone can read rating comments" on rating_comments;
drop policy if exists "Users insert own rating comments" on rating_comments;

create policy "Anyone can read rating comments" on rating_comments
  for select using (true);
create policy "Users insert own rating comments" on rating_comments
  for insert with check (auth.uid() = user_id);

-- ── 5. Open up ratings RLS so others can read (needed for shop breakdown + likes/comments) ──
-- The original migration only allows users to read their OWN ratings.
-- We need all authenticated users to be able to read ratings for shop detail views.
drop policy if exists "Users manage own ratings" on ratings;
drop policy if exists "Anyone can read ratings" on ratings;
drop policy if exists "Users insert own ratings" on ratings;
drop policy if exists "Users update own ratings" on ratings;
drop policy if exists "Users delete own ratings" on ratings;

create policy "Anyone can read ratings" on ratings
  for select using (true);
create policy "Users insert own ratings" on ratings
  for insert with check (auth.uid() = user_id);
create policy "Users update own ratings" on ratings
  for update using (auth.uid() = user_id);
create policy "Users delete own ratings" on ratings
  for delete using (auth.uid() = user_id);

-- Grant selects on new tables to authenticated and anon roles
grant select on rating_likes to anon, authenticated;
grant select on rating_comments to anon, authenticated;
grant insert, delete on rating_likes to authenticated;
grant insert on rating_comments to authenticated;
