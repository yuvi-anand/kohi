-- Run this in your Supabase SQL editor to set up the Kōhī schema.

create extension if not exists "uuid-ossp";

-- Coffee shops (cached / user-submitted)
create table if not exists coffee_shops (
  id              text primary key,
  google_place_id text unique,
  name            text not null,
  address         text,
  neighborhood    text,
  lat             double precision,
  lng             double precision,
  photo_url       text,
  price_level     int check (price_level between 1 and 4),
  website         text,
  phone           text,
  created_at      timestamptz default now()
);

-- User ratings (one per user per shop)
create table if not exists ratings (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references auth.users not null,
  shop_id           text references coffee_shops(id) not null,
  coffee_quality    int not null check (coffee_quality between 1 and 10),
  vibes             int not null check (vibes between 1 and 10),
  seating           int not null check (seating between 1 and 5),
  wifi_quality      int not null check (wifi_quality between 1 and 5),
  work_friendliness int not null check (work_friendliness between 1 and 5),
  laptop_friendly   boolean not null default false,
  overall           numeric(4,1) not null check (overall between 1 and 10),
  notes             text,
  visited_at        timestamptz,
  created_at        timestamptz default now(),
  unique (user_id, shop_id)
);

-- Bookmarks
create table if not exists bookmarks (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users not null,
  shop_id    text references coffee_shops(id) not null,
  created_at timestamptz default now(),
  unique (user_id, shop_id)
);

-- Row-level security
alter table coffee_shops enable row level security;
alter table ratings enable row level security;
alter table bookmarks enable row level security;

-- coffee_shops: anyone can read, authenticated users can insert
create policy "Anyone can read shops" on coffee_shops for select using (true);
create policy "Auth users can insert shops" on coffee_shops for insert with check (auth.role() = 'authenticated');
create policy "Auth users can update shops" on coffee_shops for update using (auth.role() = 'authenticated');

-- ratings: users can only read/write their own
create policy "Users manage own ratings" on ratings
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- bookmarks: users can only read/write their own
create policy "Users manage own bookmarks" on bookmarks
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
