-- Fix ratings RLS: allow authenticated users to READ all ratings (for social feed + user profiles)
-- but only write/modify their own

drop policy if exists "Users manage own ratings" on ratings;

create policy "Ratings readable by authenticated users"
  on ratings for select
  using (auth.role() = 'authenticated');

create policy "Users can insert own ratings"
  on ratings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ratings"
  on ratings for update
  using (auth.uid() = user_id);

create policy "Users can delete own ratings"
  on ratings for delete
  using (auth.uid() = user_id);

-- Fix profiles RLS: allow authenticated users to READ all profiles (for user search + profile pages)
drop policy if exists "Users manage own profile" on profiles;

create policy "Profiles readable by authenticated users"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);
