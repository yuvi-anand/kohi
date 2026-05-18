-- Profiles table (may already exist; safe to run)
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique,
  name       text,
  bio        text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Anyone can read profiles') then
    create policy "Anyone can read profiles" on profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='Users manage own profile') then
    create policy "Users manage own profile" on profiles using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end $$;

-- Follows
create table if not exists follows (
  id           uuid primary key default uuid_generate_v4(),
  follower_id  uuid references auth.users on delete cascade not null,
  following_id uuid references auth.users on delete cascade not null,
  created_at   timestamptz default now(),
  unique (follower_id, following_id)
);

alter table follows enable row level security;

create policy "Anyone can see follows" on follows for select using (true);
create policy "Users insert own follows" on follows for insert with check (auth.uid() = follower_id);
create policy "Users delete own follows" on follows for delete using (auth.uid() = follower_id);
