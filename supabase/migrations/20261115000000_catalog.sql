-- Catalog: the curriculum now lives in the database so it can be managed from /admin.
-- Public can read published content; only admins can change anything.

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- No policies on purpose: nobody can read or write this table through the API.
-- Add an admin from the SQL editor (see README).

-- SECURITY DEFINER so policies can ask "is the caller an admin?" without exposing the table.
create function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table public.chords (
  id      text primary key check (id ~ '^[A-Za-z0-9#b+-]{1,12}$'),
  name    text not null check (char_length(name) between 1 and 20),
  -- low E to high E. -1 = muted, 0 = open, n = fret
  frets   int[] not null check (cardinality(frets) = 6 and frets <@ array[-1,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]),
  -- finger per string, 0 = none
  fingers int[] not null check (cardinality(fingers) = 6 and fingers <@ array[0,1,2,3,4]),
  barre   jsonb check (barre is null or (barre ? 'fret' and barre ? 'from' and barre ? 'to'))
);

create table public.tracks (
  slug          text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  path          text not null check (path in ('acoustic', 'electric')),
  style         text not null check (char_length(style) between 1 and 40),
  title         text not null check (char_length(title) between 1 and 80),
  blurb         text not null default '' check (char_length(blurb) <= 200),
  tagline       text not null default '' check (char_length(tagline) <= 300),
  -- draft: hidden. coming_soon: listed, no content. published: fully visible.
  status        text not null default 'draft' check (status in ('draft', 'coming_soon', 'published')),
  position      int  not null default 0,
  warmup_slug   text,
  habits        text[] not null default '{}',
  graduation    text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create table public.phases (
  id             uuid primary key default gen_random_uuid(),
  track_slug     text not null references public.tracks (slug) on update cascade on delete cascade,
  slug           text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position       int  not null default 0,
  title          text not null check (char_length(title) between 1 and 80),
  months         text not null default '',
  summary        text not null default '',
  milestone_slug text not null check (milestone_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  milestone_text text not null default '',
  unique (track_slug, slug),
  unique (track_slug, milestone_slug),
  unique (id, track_slug)
);

create table public.items (
  id         uuid primary key default gen_random_uuid(),
  track_slug text not null,
  phase_id   uuid not null,
  slug       text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position   int  not null default 0,
  kind       text not null check (kind in ('drill', 'song')),
  title      text not null check (char_length(title) between 1 and 120),
  detail     text not null default '',
  query      text,
  chords     text[] not null default '{}',
  chord_note text,
  unique (track_slug, slug),
  -- an item's track always matches its phase's track
  foreign key (phase_id, track_slug) references public.phases (id, track_slug) on update cascade on delete cascade
);
create index items_phase_idx on public.items (phase_id, position);

create table public.notations (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references public.items (id) on delete cascade,
  position  int  not null default 0,
  title     text not null check (char_length(title) between 1 and 120),
  caption   text,
  format    text not null check (format in ('alphatex', 'file')),
  tex       text check (char_length(tex) <= 50000),
  file_path text,
  check ((format = 'alphatex' and tex is not null) or (format = 'file' and file_path is not null))
);
create index notations_item_idx on public.notations (item_id, position);
create index phases_track_idx on public.phases (track_slug, position);

alter table public.chords    enable row level security;
alter table public.tracks    enable row level security;
alter table public.phases    enable row level security;
alter table public.items     enable row level security;
alter table public.notations enable row level security;

-- Reads
create policy "read chords" on public.chords for select to anon, authenticated using (true);

create policy "read tracks" on public.tracks for select to anon, authenticated
  using (status in ('published', 'coming_soon') or (select public.is_admin()));

create policy "read phases" on public.phases for select to anon, authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.tracks t where t.slug = phases.track_slug and t.status = 'published'));

create policy "read items" on public.items for select to anon, authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.tracks t where t.slug = items.track_slug and t.status = 'published'));

create policy "read notations" on public.notations for select to anon, authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.items i join public.tracks t on t.slug = i.track_slug
    where i.id = notations.item_id and t.status = 'published'));

-- Writes: admins only
create policy "admin write chords"    on public.chords    for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin write tracks"    on public.tracks    for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin write phases"    on public.phases    for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin write items"     on public.items     for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin write notations" on public.notations for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
