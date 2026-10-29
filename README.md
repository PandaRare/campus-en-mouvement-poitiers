# Campus en Mouvement — Poitiers

PWA de covoiturage entre étudiants de l'Université de Poitiers.
React + Vite · Tailwind CSS 4 · Supabase (Auth, Postgres, Realtime, Edge Functions) · React-Leaflet · TanStack Query.

## Démarrer

```bash
npm install
cp .env.example .env.local     # puis renseigner les valeurs
npm run dev
```

Base de données : exécuter dans l'ordre `supabase_schema.sql`, `supabase_schema_v2.sql` (réservations, messages),
`supabase_migration_v2.sql`, puis `supabase_migration_v3.sql` (voir `docs/INTEGRATION_V3.md`).

Test PWA / hors-ligne / notifications (le service worker ne tourne qu'en build) :

```bash
npm run build && npm run preview
```

## Documentation

- `docs/INTEGRATION_V3.md` — mise en place de la v3, étape par étape
