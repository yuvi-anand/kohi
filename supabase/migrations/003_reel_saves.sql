create table if not exists reel_saves (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users on delete cascade not null,
  url           text not null,
  platform      text,
  shop_id       text references coffee_shops(id),
  extracted_name text,
  extracted_summary text,
  source_caption text,
  thumbnail_url text,
  status        text default 'processed',
  created_at    timestamptz default now()
);

alter table reel_saves enable row level security;
create policy "Users manage own reel saves" on reel_saves
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
