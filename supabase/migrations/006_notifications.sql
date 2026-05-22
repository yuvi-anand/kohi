-- Notifications table
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,   -- recipient
  type        text not null,                          -- 'follow' for now
  actor_id    uuid references auth.users,             -- who triggered it
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "Users read own notifications" on notifications;
create policy "Users read own notifications" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on notifications;
create policy "Users update own notifications" on notifications
  for update using (auth.uid() = user_id);

drop policy if exists "Authenticated insert notifications" on notifications;
create policy "Authenticated insert notifications" on notifications
  for insert with check (auth.role() = 'authenticated');
