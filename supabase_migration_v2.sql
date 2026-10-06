-- ============================================================
-- Campus en Mouvement — migration v2
-- (carte réelle, recherche d'adresse, profils)
-- À coller dans Supabase > SQL Editor > New query > Run
-- Sans danger : peut être exécuté plusieurs fois, ne supprime rien.
-- ============================================================

-- 1) Coordonnées, point de rendez-vous, tracé et distance des trajets
alter table public.rides
  add column if not exists origin_lat    double precision,
  add column if not exists origin_lng    double precision,
  add column if not exists dest_lat      double precision,
  add column if not exists dest_lng      double precision,
  add column if not exists meeting_label text,
  add column if not exists meeting_lat   double precision,
  add column if not exists meeting_lng   double precision,
  add column if not exists route         jsonb,      -- [[lat,lng], ...]
  add column if not exists distance_m    integer;

-- 2) Profils (prénom + licence / formation en texte libre)
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text check (full_name is null or char_length(full_name) <= 40),
  study      text check (study is null or char_length(study) <= 80),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
