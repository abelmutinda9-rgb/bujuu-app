-- BUJUU Cinema Device Library Storage
-- Enables anonymous, account-free sync for watchlist, continue-watching, and history across devices

create table if not exists public.device_library (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_id text not null,
  tmdb_id integer not null,
  media_type text not null,
  item_kind text not null default 'history', -- 'watchlist', 'continue_watching', 'history'
  title text not null,
  poster_path text,
  backdrop_path text,
  season integer default 1,
  episode integer default 1,
  progress_seconds integer default 0,
  duration_seconds integer,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint device_media_unique unique(owner_id, tmdb_id, media_type, item_kind)
);

create index if not exists idx_device_library_lookup on public.device_library(owner_id, item_kind);
create index if not exists idx_device_library_updated on public.device_library(owner_id, updated_at desc);

alter table public.device_library enable row level security;

-- Each installation receives a hidden anonymous Supabase identity; users do not see a login screen.
-- Rows are isolated to that identity instead of being publicly readable or writable.
create policy "Users can read their device library"
  on public.device_library for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Users can insert their device library"
  on public.device_library for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Users can update their device library"
  on public.device_library for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their device library"
  on public.device_library for delete
  to authenticated
  using (auth.uid() = owner_id);
