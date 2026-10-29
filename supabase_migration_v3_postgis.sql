-- ============================================================
-- Campus en Mouvement — migration v3 (OPTIONNELLE) : recherche par rayon PostGIS
--
-- À exécuter APRÈS supabase_migration_v3.sql. Séparée exprès : si PostGIS
-- n'est pas activable sur votre projet, le reste de l'application fonctionne.
--
-- Utilité : la recherche de l'écran d'accueil est faite côté navigateur sur le
-- TRACÉ complet des trajets (plus précis). Cette fonction est la version
-- serveur, sur le point de DÉPART uniquement : utile le jour où il y aura trop
-- de trajets pour tout charger.
--   select * from search_rides_within_radius(46.5821, 0.3340, 1500);
-- ============================================================

create extension if not exists postgis with schema extensions;

-- Index géographique (accélère ST_DWithin sur le point de départ)
create index if not exists rides_origin_geog_idx
  on public.rides
  using gist ((st_setsrid(st_makepoint(origin_lng, origin_lat), 4326)::geography))
  where origin_lat is not null and origin_lng is not null;

create or replace function public.search_rides_within_radius(
  p_lat           double precision,
  p_lng           double precision,
  p_radius_meters double precision default 1500
) returns setof public.rides
language sql
stable
set search_path = public, extensions
as $$
  select *
    from public.rides
   where seats > 0                       -- seats = places restantes
     and time > now()
     and origin_lat is not null
     and origin_lng is not null
     and st_dwithin(
           st_setsrid(st_makepoint(origin_lng, origin_lat), 4326)::geography,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
           p_radius_meters
         )
   order by time asc;
$$;

revoke execute on function public.search_rides_within_radius(double precision, double precision, double precision) from public, anon;
grant  execute on function public.search_rides_within_radius(double precision, double precision, double precision) to authenticated;
