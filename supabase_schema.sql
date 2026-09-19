-- ============================================================
-- Campus en Mouvement — table `rides` + RLS
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists public.rides (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references auth.users (id) on delete cascade,
  origin      text not null check (char_length(trim(origin)) between 2 and 120),
  destination text not null check (char_length(trim(destination)) between 2 and 120),
  time        timestamptz not null,
  seats       smallint not null check (seats between 1 and 8),
  created_at  timestamptz not null default now()
);

create index if not exists rides_time_idx      on public.rides (time);
create index if not exists rides_driver_id_idx on public.rides (driver_id);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.rides enable row level security;

-- Lecture : tout étudiant connecté voit les trajets à venir
drop policy if exists "rides_select_authenticated" on public.rides;
create policy "rides_select_authenticated"
  on public.rides for select
  to authenticated
  using (true);

-- Création : on ne peut publier un trajet qu'en son propre nom
drop policy if exists "rides_insert_own" on public.rides;
create policy "rides_insert_own"
  on public.rides for insert
  to authenticated
  with check (auth.uid() = driver_id);

-- Modification : uniquement ses propres trajets
drop policy if exists "rides_update_own" on public.rides;
create policy "rides_update_own"
  on public.rides for update
  to authenticated
  using (auth.uid() = driver_id)
  with check (auth.uid() = driver_id);

-- Suppression : uniquement ses propres trajets
drop policy if exists "rides_delete_own" on public.rides;
create policy "rides_delete_own"
  on public.rides for delete
  to authenticated
  using (auth.uid() = driver_id);

-- Optionnel : purge automatique des trajets passés (pg_cron)
-- select cron.schedule('purge_rides', '0 3 * * *',
--   $$delete from public.rides where time < now() - interval '1 day'$$);
