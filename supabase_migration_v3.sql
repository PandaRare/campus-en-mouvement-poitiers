-- ============================================================
-- Campus en Mouvement — migration v3
--   · trajets récurrents (emploi du temps)
--   · score de fiabilité / ponctualité
--   · inscription réservée aux adresses de l'Université de Poitiers
--   · notifications Web Push (abonnements)
--
-- À coller dans Supabase > SQL Editor > New query > Run.
-- Idempotent : peut être relancé plusieurs fois sans rien casser.
--
-- Prérequis déjà exécutés : supabase_schema.sql, supabase_schema_v2.sql
-- (reservations, messages, join_ride, leave_ride) et supabase_migration_v2.sql
-- (colonnes géo de rides + table profiles).
--
-- Convention du projet : rides.seats = nombre de places RESTANTES
-- (join_ride le décrémente, leave_ride l'incrémente). La colonne
-- « available_seats » de votre premier brouillon n'est donc pas utilisée.
-- ============================================================


-- ------------------------------------------------------------
-- 0. Retrait de vos premières fonctions (failles de sécurité)
--    · create_recurring_rides(p_driver_id …) : n'importe qui pouvait publier
--      des trajets au nom d'un autre utilisateur, sans limite de durée.
--    · record_user_attendance(p_user_id, p_attended) : n'importe qui pouvait
--      fixer le score de n'importe qui.
--    Elles sont remplacées plus bas par des versions qui lisent auth.uid().
-- ------------------------------------------------------------
drop function if exists public.create_recurring_rides(
  uuid, text, text,
  double precision, double precision, double precision, double precision,
  text, double precision, double precision,
  date, date, time, integer[], integer, integer, jsonb
);
drop function if exists public.record_user_attendance(uuid, boolean);


-- ------------------------------------------------------------
-- 1. Colonnes
-- ------------------------------------------------------------
alter table public.rides
  add column if not exists recurrence_group_id uuid;

create index if not exists rides_recurrence_group_idx
  on public.rides (recurrence_group_id)
  where recurrence_group_id is not null;

alter table public.profiles
  add column if not exists completed_rides_count integer not null default 0,
  add column if not exists total_scheduled_rides integer not null default 0,
  add column if not exists reliability_score     numeric(5,2) not null default 100.00;


-- ------------------------------------------------------------
-- 2. Profils : le score n'est modifiable que par le serveur
--    (sans ça, la policy « profiles_update_own » laisserait chacun
--    s'attribuer 100 % de fiabilité depuis la console du navigateur).
-- ------------------------------------------------------------
revoke insert, update on public.profiles from anon, authenticated;
grant  insert (id, full_name, study, updated_at) on public.profiles to authenticated;
grant  update (id, full_name, study, updated_at) on public.profiles to authenticated;


-- ------------------------------------------------------------
-- 3. Trajets : on ne peut plus supprimer un trajet déjà parti
--    (sinon un conducteur absent effacerait le trajet avant que
--    les passagers ne le signalent).
-- ------------------------------------------------------------
drop policy if exists "rides_delete_own" on public.rides;
create policy "rides_delete_own"
  on public.rides for delete
  to authenticated
  using (auth.uid() = driver_id and time > now());


-- ------------------------------------------------------------
-- 4. leave_ride : impossible de quitter un trajet déjà passé
--    (un passager absent ne doit pas pouvoir effacer sa réservation
--    avant que le conducteur ne le signale).
-- ------------------------------------------------------------
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

  if v_ride.time < now() then
    raise exception 'Ce trajet est déjà passé';
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


-- ------------------------------------------------------------
-- 5. Trajets récurrents
--    Le conducteur est TOUJOURS l'utilisateur connecté (auth.uid()).
--    Jours : format ISO, 1 = lundi … 7 = dimanche.
--    Garde-fous : 180 jours maximum, occurrences passées ignorées.
-- ------------------------------------------------------------
create or replace function public.create_recurring_rides(
  p_origin         text,
  p_destination    text,
  p_origin_lat     double precision,
  p_origin_lng     double precision,
  p_dest_lat       double precision,
  p_dest_lng       double precision,
  p_meeting_label  text,
  p_meeting_lat    double precision,
  p_meeting_lng    double precision,
  p_start_date     date,
  p_end_date       date,
  p_time           time,
  p_days_of_week   integer[],
  p_seats          integer,
  p_distance_m     integer default null,
  p_route          jsonb   default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_day   date := p_start_date;
  v_group uuid := gen_random_uuid();
  v_count integer := 0;
  v_ts    timestamptz;
begin
  if v_me is null then
    raise exception 'Authentification requise';
  end if;

  if p_origin is null or char_length(trim(p_origin)) not between 2 and 120
     or p_destination is null or char_length(trim(p_destination)) not between 2 and 120 then
    raise exception 'Départ et arrivée doivent faire entre 2 et 120 caractères.';
  end if;

  if p_seats is null or p_seats not between 1 and 8 then
    raise exception 'Le nombre de places doit être compris entre 1 et 8.';
  end if;

  if p_start_date is null or p_end_date is null or p_time is null then
    raise exception 'Dates et heure obligatoires.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'La date de fin doit être postérieure à la date de début.';
  end if;

  if p_end_date - p_start_date > 180 then
    raise exception 'La récurrence est limitée à 6 mois.';
  end if;

  if p_days_of_week is null
     or cardinality(p_days_of_week) = 0
     or exists (select 1 from unnest(p_days_of_week) as d where d not between 1 and 7) then
    raise exception 'Choisissez au moins un jour de la semaine.';
  end if;

  while v_day <= p_end_date loop
    if extract(isodow from v_day)::integer = any (p_days_of_week) then
      -- Heure locale de Poitiers, gérée correctement lors du changement d'heure
      v_ts := (v_day + p_time) at time zone 'Europe/Paris';

      if v_ts > now() then
        insert into public.rides (
          driver_id, origin, destination,
          origin_lat, origin_lng, dest_lat, dest_lng,
          meeting_label, meeting_lat, meeting_lng,
          time, seats, distance_m, route, recurrence_group_id
        ) values (
          v_me, trim(p_origin), trim(p_destination),
          p_origin_lat, p_origin_lng, p_dest_lat, p_dest_lng,
          nullif(trim(p_meeting_label), ''), p_meeting_lat, p_meeting_lng,
          v_ts, p_seats, p_distance_m, p_route, v_group
        );
        v_count := v_count + 1;
      end if;
    end if;
    v_day := v_day + 1;
  end loop;

  return v_count;
end;
$$;

-- Annule toutes les occurrences À VENIR de la série d'un trajet.
-- (« security invoker » : la policy rides_delete_own s'applique.)
create or replace function public.cancel_ride_series(p_ride_id uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_group   uuid;
  v_deleted integer;
begin
  select recurrence_group_id into v_group
    from public.rides
   where id = p_ride_id and driver_id = auth.uid();

  if v_group is null then
    raise exception 'Ce trajet ne fait pas partie d''une série que vous conduisez.';
  end if;

  delete from public.rides
   where recurrence_group_id = v_group
     and driver_id = auth.uid()
     and time > now();

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;


-- ------------------------------------------------------------
-- 6. Fiabilité / ponctualité
--    Après le départ, les participants se confirment mutuellement :
--      · le conducteur signale chaque passager présent / absent ;
--      · chaque passager signale si le conducteur était au rendez-vous.
--    Personne ne peut s'attribuer de points à lui-même.
--    Le score est RECALCULÉ à partir des signalements (jamais incrémenté
--    à la main) : rejouer ou corriger un signalement ne fausse rien.
-- ------------------------------------------------------------
create table if not exists public.ride_attendance (
  ride_id     uuid not null,   -- pas de FK : l'historique survit à la purge des vieux trajets
  user_id     uuid not null references auth.users (id) on delete cascade,  -- personne évaluée
  reporter_id uuid not null references auth.users (id) on delete cascade,  -- personne qui signale
  attended    boolean not null,
  created_at  timestamptz not null default now(),
  primary key (ride_id, user_id, reporter_id),
  check (user_id <> reporter_id)
);

create index if not exists ride_attendance_user_idx on public.ride_attendance (user_id);

alter table public.ride_attendance enable row level security;

-- Chacun voit seulement ses propres signalements (pas qui l'a signalé).
-- Aucune policy d'écriture : tout passe par report_attendance().
drop policy if exists "attendance_select_own_reports" on public.ride_attendance;
create policy "attendance_select_own_reports"
  on public.ride_attendance for select
  to authenticated
  using (reporter_id = auth.uid());

-- Recalcul interne (non appelable depuis l'application)
create or replace function public.refresh_reliability(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_ok    integer;
begin
  -- Un trajet est « honoré » si les signalements positifs égalent ou dépassent les négatifs
  with per_ride as (
    select ride_id,
           sum(case when attended then 1 else -1 end) as balance
      from public.ride_attendance
     where user_id = p_user_id
     group by ride_id
  )
  select count(*), count(*) filter (where balance >= 0)
    into v_total, v_ok
    from per_ride;

  insert into public.profiles (id, completed_rides_count, total_scheduled_rides, reliability_score)
  values (
    p_user_id, v_ok, v_total,
    case when v_total = 0 then 100 else round(100.0 * v_ok / v_total, 1) end
  )
  on conflict (id) do update set
    completed_rides_count = excluded.completed_rides_count,
    total_scheduled_rides = excluded.total_scheduled_rides,
    reliability_score     = excluded.reliability_score;
end;
$$;

create or replace function public.report_attendance(
  p_ride_id  uuid,
  p_user_id  uuid,
  p_attended boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      uuid := auth.uid();
  v_ride    public.rides;
  v_allowed boolean;
begin
  if v_me is null then
    raise exception 'Authentification requise';
  end if;

  if p_user_id = v_me then
    raise exception 'Vous ne pouvez pas confirmer votre propre présence.';
  end if;

  select * into v_ride from public.rides where id = p_ride_id;

  if not found then
    raise exception 'Trajet introuvable';
  end if;

  if v_ride.time > now() then
    raise exception 'Ce trajet n''a pas encore eu lieu.';
  end if;

  if v_ride.time < now() - interval '7 days' then
    raise exception 'Le délai de confirmation (7 jours) est dépassé.';
  end if;

  v_allowed :=
    -- le conducteur évalue l'un de ses passagers
    (v_ride.driver_id = v_me and exists (
       select 1 from public.reservations r
        where r.ride_id = p_ride_id and r.user_id = p_user_id))
    or
    -- un passager évalue le conducteur
    (p_user_id = v_ride.driver_id and exists (
       select 1 from public.reservations r
        where r.ride_id = p_ride_id and r.user_id = v_me));

  if not v_allowed then
    raise exception 'Vous ne pouvez pas évaluer cette personne pour ce trajet.';
  end if;

  insert into public.ride_attendance (ride_id, user_id, reporter_id, attended)
  values (p_ride_id, p_user_id, v_me, p_attended)
  on conflict (ride_id, user_id, reporter_id)
  do update set attended = excluded.attended, created_at = now();

  perform public.refresh_reliability(p_user_id);
end;
$$;


-- ------------------------------------------------------------
-- 7. Inscription réservée à l'Université de Poitiers
--    Rejette toute création de compte (ou changement d'e-mail) hors de
--    @etu.univ-poitiers.fr / @univ-poitiers.fr. Les comptes existants
--    (autres domaines) continuent de pouvoir se connecter.
--    ⚠️ Dans Authentication > Providers > Email, laissez « Confirm email »
--    activé : sinon on pourrait s'inscrire avec l'adresse d'un autre.
--    Pour créer un compte de test hors domaine : drop trigger enforce_univ_email on auth.users;
-- ------------------------------------------------------------
create or replace function public.enforce_univ_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Mise à jour qui ne touche pas à l'adresse : on laisse passer
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then
    return new;
  end if;

  if new.email is null
     or lower(new.email) !~ '^[^@\s]+@(etu\.)?univ-poitiers\.fr$' then
    raise exception 'Inscription réservée aux adresses @etu.univ-poitiers.fr et @univ-poitiers.fr'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_univ_email on auth.users;
create trigger enforce_univ_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_univ_email();


-- ------------------------------------------------------------
-- 8. Notifications Web Push : abonnements des appareils
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

-- Enregistrement via RPC : si l'appareil était lié à un autre compte
-- (téléphone partagé), l'abonnement change de propriétaire.
create or replace function public.register_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth_key   text,
  p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'Abonnement invalide';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth_key, left(p_user_agent, 200))
  on conflict (endpoint) do update set
    user_id    = auth.uid(),
    p256dh     = excluded.p256dh,
    auth_key   = excluded.auth_key,
    user_agent = excluded.user_agent,
    created_at = now();
end;
$$;


-- ------------------------------------------------------------
-- 9. Droits d'exécution : seuls les utilisateurs connectés appellent les RPC
--    (par défaut Postgres donne EXECUTE à tout le monde, anonymes compris)
-- ------------------------------------------------------------
revoke execute on function public.refresh_reliability(uuid)                          from public, anon, authenticated;
revoke execute on function public.report_attendance(uuid, uuid, boolean)            from public, anon;
revoke execute on function public.leave_ride(uuid)                                   from public, anon;
revoke execute on function public.cancel_ride_series(uuid)                           from public, anon;
revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.create_recurring_rides(
  text, text, double precision, double precision, double precision, double precision,
  text, double precision, double precision, date, date, time, integer[], integer, integer, jsonb
) from public, anon;

grant execute on function public.report_attendance(uuid, uuid, boolean)             to authenticated;
grant execute on function public.leave_ride(uuid)                                    to authenticated;
grant execute on function public.cancel_ride_series(uuid)                            to authenticated;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.create_recurring_rides(
  text, text, double precision, double precision, double precision, double precision,
  text, double precision, double precision, date, date, time, integer[], integer, integer, jsonb
) to authenticated;
