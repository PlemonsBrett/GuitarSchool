-- Curriculum lives in the app (src/content). The database only stores per-user progress,
-- keyed by track/item slugs. Every table is RLS-protected: users see and change only their own rows.

create table public.user_tracks (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track_slug text not null,
  started_on date not null default current_date,
  primary key (user_id, track_slug)
);

create table public.progress (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track_slug   text not null,
  item_slug    text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, track_slug, item_slug)
);

create table public.practice_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track_slug   text not null,
  practiced_on date not null default current_date,
  minutes      int  not null check (minutes between 1 and 600),
  note         text check (char_length(note) <= 1000),
  created_at   timestamptz not null default now()
);

create index practice_logs_user_day_idx on public.practice_logs (user_id, practiced_on desc);

alter table public.user_tracks   enable row level security;
alter table public.progress      enable row level security;
alter table public.practice_logs enable row level security;

-- (select auth.uid()) lets Postgres evaluate it once per statement instead of per row.
create policy "own rows" on public.user_tracks
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own rows" on public.progress
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own rows" on public.practice_logs
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
