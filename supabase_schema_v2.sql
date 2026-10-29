-- ============================================================
-- Campus en Mouvement — v2 : réservations + chat
-- À exécuter après supabase_schema.sql (table `rides`)
-- Supabase > SQL Editor > New query > Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists public.reservations (
  id         uuid primary key default gen_random_uuid(),
  ride_id    uuid not null references public.rides (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (ride_id, user_id)
);

create index if not exists reservations_ride_idx on public.reservations (ride_id);
create index if not exists reservations_user_idx on public.reservations (user_id);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  ride_id     uuid not null references public.rides (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  text        text not null check (char_length(trim(text)) between 1 and 1000),
  "timestamp" timestamptz not null default now()
);

create index if not exists messages_ride_time_idx on public.messages (ride_id, "timestamp");

-- ------------------------------------------------------------
-- 2. Fonction d'appartenance (SECURITY DEFINER pour éviter
--    toute récursion de policy entre messages et reservations)
-- ------------------------------------------------------------
create or replace function public.is_ride_member(p_ride_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rides r
    where r.id = p_ride_id and r.driver_id = auth.uid()
  ) or exists (
    select 1 from public.reservations res
    where res.ride_id = p_ride_id and res.user_id = auth.uid()
  );
$$;

grant execute on function public.is_ride_member(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. RLS — reservations
-- ------------------------------------------------------------
alter table public.reservations enable row level security;

-- Lecture : ses propres réservations + celles des trajets qu'on conduit
drop policy if exists "reservations_select" on public.reservations;
create policy "reservations_select"
  on public.reservations for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rides r
      where r.id = reservations.ride_id and r.driver_id = auth.uid()
    )
  );

-- Création : uniquement pour soi-même, et pas sur son propre trajet
drop policy if exists "reservations_insert_own" on public.reservations;
create policy "reservations_insert_own"
  on public.reservations for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.rides r
      where r.id = reservations.ride_id and r.driver_id = auth.uid()
    )
  );

-- Annulation : sa propre réservation, ou le conducteur qui retire un passager
drop policy if exists "reservations_delete" on public.reservations;
create policy "reservations_delete"
  on public.reservations for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rides r
      where r.id = reservations.ride_id and r.driver_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. RLS — messages (chat réservé aux membres du trajet)
-- ------------------------------------------------------------
alter table public.messages enable row level security;

drop policy if exists "messages_select_members" on public.messages;
create policy "messages_select_members"
  on public.messages for select
  to authenticated
  using (public.is_ride_member(ride_id));

drop policy if exists "messages_insert_members" on public.messages;
create policy "messages_insert_members"
  on public.messages for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_ride_member(ride_id));

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
  on public.messages for delete
  to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 5. Rejoindre / quitter un trajet de façon atomique
--    (les RLS de `rides` n'autorisent l'UPDATE qu'au conducteur :
--     ces fonctions SECURITY DEFINER décrémentent les places)
-- ------------------------------------------------------------
create or replace function public.join_ride(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select * into v_ride from public.rides where id = p_ride_id for update;

  if not found then
    raise exception 'Trajet introuvable';
  end if;

  if v_ride.driver_id = auth.uid() then
    raise exception 'Vous conduisez déjà ce trajet';
  end if;

  if v_ride.time < now() then
    raise exception 'Ce trajet est déjà passé';
  end if;

  if exists (
    select 1 from public.reservations
    where ride_id = p_ride_id and user_id = auth.uid()
  ) then
    raise exception 'Vous avez déjà rejoint ce trajet';
  end if;

  if v_ride.seats < 1 then
    raise exception 'Plus de place disponible';
  end if;

  insert into public.reservations (ride_id, user_id)
  values (p_ride_id, auth.uid());

  update public.rides
     set seats = seats - 1
   where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;

create or replace function public.leave_ride(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride    public.rides;
  v_deleted int;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select * into v_ride from public.rides where id = p_ride_id for update;

  if not found then
    raise exception 'Trajet introuvable';
  end if;

  delete from public.reservations
   where ride_id = p_ride_id and user_id = auth.uid();

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'Aucune réservation à annuler';
  end if;

  update public.rides
     set seats = seats + 1
   where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;

grant execute on function public.join_ride(uuid)  to authenticated;
grant execute on function public.leave_ride(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. Realtime (chat instantané + compteur de places)
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reservations;
-- `rides` a déjà été ajoutée en v1 ; sinon :
-- alter publication supabase_realtime add table public.rides;
