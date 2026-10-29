import { QueryClient } from '@tanstack/react-query'

// Cache partagé par toute l'application : passer d'une page à l'autre
// (Accueil → détail d'un trajet → retour) réutilise les données en mémoire
// au lieu de tout recharger.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // données « fraîches » pendant 30 s : pas de requête inutile
      gcTime: 10 * 60_000, // gardées 10 min en mémoire après le dernier usage
      retry: 1,
      refetchOnWindowFocus: true,
      // « offlineFirst » : on tente quand même la requête hors-ligne, ce qui laisse
      // le service worker (Workbox NetworkFirst) répondre avec son cache.
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'online', // une écriture hors-ligne échoue tout de suite, avec un message clair
    },
  },
})
