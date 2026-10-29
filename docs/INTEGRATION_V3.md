# Intégration v3 — pas à pas

Ce guide applique la v3 à la main, **dans cet ordre** (la base d'abord, le code ensuite).
Chaque étape peut être vérifiée avant de passer à la suivante.

Nouveautés : hubs du campus · trajets récurrents · score de fiabilité · inscription réservée à
l'Université de Poitiers · cache hors-ligne de « Mes trajets » · TanStack Query · notifications Web Push.

> Raccourci : `git apply campus-en-mouvement-v3.patch` applique tous les changements de code d'un coup
> (étapes 3 à 6). Les étapes 1, 2, 7 et 8 (Supabase, clés, fonction, webhooks) restent manuelles.

---

## Avant de commencer — ce qui a été corrigé dans vos premières fonctions SQL

| Votre version | Problème | Version v3 |
|---|---|---|
| `create_recurring_rides(p_driver_id, …)` | n'importe quel utilisateur pouvait publier des trajets **au nom d'un autre**, sur n'importe quelle durée | le conducteur est toujours `auth.uid()` ; 180 jours max ; occurrences passées ignorées |
| `record_user_attendance(p_user_id, p_attended)` | n'importe qui pouvait **fixer le score de n'importe qui** | `report_attendance()` : confirmations croisées conducteur ↔ passagers, score recalculé |
| colonnes de score sur `profiles` | la policy « modifier son profil » permettait de s'attribuer 100 % | seuls `full_name`, `study` sont modifiables par l'utilisateur |
| `available_seats` | colonne absente du schéma du dépôt | inutilisée : `rides.seats` = places **restantes** (comme dans tout le code) |
| `search_rides_within_radius` | dépendait de `available_seats` | corrigée, dans un fichier **optionnel** (étape 1b) |

Garde-fous ajoutés : on ne peut plus supprimer un trajet déjà parti, ni quitter un trajet passé
(sinon un absent effacerait la preuve avant d'être signalé).

---

## 1. Base de données (Supabase → SQL Editor → New query)

**1a.** Collez tout `supabase_migration_v3.sql` puis **Run**. Il est rejouable sans risque.
Il crée : colonnes de récurrence et de fiabilité, table `ride_attendance`, fonctions
`create_recurring_rides`, `cancel_ride_series`, `report_attendance`, `register_push_subscription`,
le trigger de restriction de domaine, la table `push_subscriptions`.

**1b. (optionnel)** `supabase_migration_v3_postgis.sql` : recherche par rayon côté serveur.
L'appli n'en a pas besoin (la recherche de l'accueil se fait sur le tracé complet, plus précis).

**1c.** Authentication → Providers → Email : laissez **« Confirm email » activé**. Sans cela, on pourrait
s'inscrire avec l'adresse universitaire de quelqu'un d'autre.

✅ Vérifier : `select proname from pg_proc where proname in ('report_attendance','create_recurring_rides','record_user_attendance');`
→ `record_user_attendance` ne doit **plus** apparaître.

⚠️ Les comptes existants hors domaine (ex. Gmail) continuent de se connecter. Pour créer un compte de test
hors domaine : `drop trigger enforce_univ_email on auth.users;` (à recréer ensuite avec la migration).

---

## 2. Clés VAPID (notifications push)

```bash
npx web-push generate-vapid-keys
```

- La clé **publique** va dans `.env.local` (et dans les variables d'environnement Vercel) : `VITE_VAPID_PUBLIC_KEY=…`
- La clé **privée** ne va **que** dans les secrets Supabase (étape 7). Ne la commitez jamais.

Créez `.env.local` à partir de `.env.example` (nouveau fichier).

---

## 3. Dépendance

```bash
npm install @tanstack/react-query
```

---

## 4. Fichiers à CRÉER (copier tels quels)

| Fichier | Rôle |
|---|---|
| `src/lib/queryClient.js` | configuration du cache TanStack Query |
| `src/lib/queries.js` | tous les appels Supabase en hooks + canal temps réel unique |
| `src/lib/recurrence.js` | constantes de la récurrence |
| `src/lib/push.js` | abonnement Web Push côté navigateur |
| `src/components/AttendancePanel.jsx` | confirmation « le trajet a eu lieu » |
| `src/components/RecurrenceFields.jsx` | jours + date de fin dans le formulaire |
| `src/components/PushToggle.jsx` | bouton d'activation des notifications |
| `src/components/OfflineNotice.jsx` | bandeau « hors connexion » |
| `public/push-sw.js` | réception des notifications dans le service worker |
| `supabase/functions/send-push/index.ts` | Edge Function d'envoi |
| `.env.example` | modèle des variables d'environnement |

## 5. Fichiers à REMPLACER (un par un)

| Fichier | Ce qui change |
|---|---|
| `src/main.jsx` | enveloppe l'app dans `QueryClientProvider` |
| `src/App.jsx` | canal temps réel unique ; vide les caches à la déconnexion (3 petits ajouts) |
| `src/pages/Carpooling.jsx` | requêtes en cache ; **hubs** en raccourcis ; **récurrence** dans le formulaire ; correction du `min` de l'heure (UTC → heure locale) |
| `src/pages/RideDetails.jsx` | requêtes en cache ; badge de fiabilité du conducteur ; panneau de confirmation ; « Annuler la série » ; l'annulation vérifie qu'elle a réussi |
| `src/pages/MyRides.jsx` | requêtes en cache ; bandeau hors-ligne ; RDV et marqueur « hebdomadaire » |
| `src/pages/Account.jsx` | profil via cache ; badge de fiabilité ; bouton de notifications |
| `src/pages/Co2.jsx` | chargement via `useCo2Rides` (cache) au lieu d'un `useEffect` |
| `src/pages/Auth.jsx` | refus côté formulaire des adresses hors domaine + message clair quand le serveur refuse |
| `src/components/AddressInput.jsx` | raccourcis sur une ligne défilante (7 hubs sur 4 champs) |
| `src/components/ReliabilityBadge.jsx` | aux couleurs de l'appli, « 98 % de trajets honorés » |
| `src/constants/poitiersHubs.js` | ajout de `short` et de `HUB_PLACES` |
| `vite.config.js` | cache hors-ligne **NetworkFirst** ciblé + `importScripts` du service worker push |
| `index.html` | `theme-color`, icône iOS (nécessaire pour les notifications sur iPhone) |

## 6. Fichiers à SUPPRIMER

| Fichier | Pourquoi |
|---|---|
| `src/components/CreateRideForm.jsx` | jamais utilisé ; écrit pour des colonnes qui n'existent pas (`departure`, `departure_hub_id`…) |
| `src/src/hooks/useCachedRides.js` | jamais utilisé, mauvais dossier (`src/src`) et mauvaises colonnes (`departure_time`) ; remplacé par TanStack Query |
| `RidesMap.jsx` (à la racine) | doublon de `src/components/RidesMap.jsx` |
| `src/components/pwaInstall.js` | doublon de `src/lib/pwaInstall.js` |

✅ Vérifier : `npm run lint && npm run build` → aucune erreur.

---

## 7. Edge Function d'envoi

```bash
npx supabase login
npx supabase init                      # seulement si le dossier supabase/ n'a pas de config.toml
npx supabase link --project-ref <ref>  # <ref> = l'identifiant dans l'URL de votre projet

openssl rand -hex 32                   # génère le WEBHOOK_SECRET (copiez le résultat)

npx supabase secrets set \
  VAPID_PUBLIC_KEY="<clé publique>" \
  VAPID_PRIVATE_KEY="<clé privée>" \
  VAPID_SUBJECT="mailto:vous@etu.univ-poitiers.fr" \
  WEBHOOK_SECRET="<le secret généré>"

npx supabase functions deploy send-push --no-verify-jwt
```

`--no-verify-jwt` : la fonction est appelée par un webhook, pas par un utilisateur ; elle se protège
avec l'en-tête secret `x-webhook-secret`.

## 8. Database Webhooks (Supabase → Database → Webhooks → Create a new hook)

| | Webhook 1 | Webhook 2 |
|---|---|---|
| Name | `push_messages` | `push_reservations` |
| Table | `public.messages` | `public.reservations` |
| Events | **Insert** | **Insert** et **Delete** |
| Type | Supabase Edge Functions → `send-push` (POST) | idem |
| HTTP Headers | ajouter `x-webhook-secret` = votre `WEBHOOK_SECRET` | idem |

(Votre document parlait d'une table `bookings` : dans ce projet elle s'appelle `reservations`.)

Qui est prévenu : nouveau message → tous les membres du trajet **sauf l'auteur** ; passager qui rejoint ou
quitte → le conducteur. Les messages d'un même trajet se remplacent dans la barre de notifications.

---

## 9. Vérifications

1. **Domaine** : inscription avec une adresse Gmail → « réservée aux adresses @etu.univ-poitiers.fr… ».
2. **Hubs** : « Proposer un trajet » → pastilles de hubs sous Départ / Arrivée / RDV (ligne défilante).
3. **Récurrence** : cochez « Répéter chaque semaine », jours + date de fin → « N trajets publiés ».
   Dans le détail d'un trajet : « Annuler toute la série à venir ».
4. **Hors-ligne** (sur le site déployé en HTTPS, ou `npm run build && npm run preview`) : ouvrez « Mes trajets » et
   un trajet, puis DevTools → Network → **Offline** → rechargez : les données déjà vues s'affichent.
5. **Fiabilité** : après l'heure de départ, le détail du trajet affiche « Qui était présent ? » (conducteur)
   ou « Le trajet a-t-il eu lieu ? » (passager). Pour tester sans attendre :
   ```sql
   update rides set time = now() - interval '1 hour' where id = '<id du trajet>';
   ```
6. **Push** : Compte → « Activer les notifications » ; fermez l'appli ; envoyez un message depuis un autre compte.
   Journaux : Edge Functions → `send-push` → Logs.

## 10. Publier

```bash
git add -A
git commit -m "v3 : hubs, récurrence, fiabilité, domaine univ, cache hors-ligne, TanStack Query, push"
git push
```

Ajoutez `VITE_VAPID_PUBLIC_KEY` dans Vercel (Settings → Environment Variables), puis redéployez.

---

## Limites à connaître

- **iPhone** : les notifications push ne fonctionnent que si l'appli est **installée sur l'écran d'accueil** (iOS 16.4 ou plus).
- **Coordonnées des hubs** : reprises de votre fichier, non vérifiées sur le terrain. Un hub mal placé fausse le tracé et la recherche : contrôlez-les sur une carte.
- **Annulation d'un trajet par le conducteur** : les passagers ne reçoivent pas de notification (les réservations sont supprimées avec le trajet avant que la fonction ne puisse les lire). Le chat reste le canal pour prévenir.
- **Testé** : migration SQL sur un Postgres de test (62 vérifications, dont les refus de sécurité) ; `npm run lint` et `npm run build`.
  **Non testé en conditions réelles** : l'Edge Function, les webhooks et la réception d'une notification sur un vrai téléphone.
