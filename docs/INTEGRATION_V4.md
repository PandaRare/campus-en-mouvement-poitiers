# v4 — « Qui conduit ? »

Chaque trajet affiche maintenant son conducteur : **prénom ou pseudo · licence/formation**, plus une petite pastille **Femme / Homme** si la personne l'a renseigné (rien n'est affiché pour « Non précisé »). Pas de photo.

- Accueil : le conducteur apparaît sur chaque trajet de la liste et dans la fiche ouverte depuis la carte.
- Accueil : un menu **« Formation du conducteur »** filtre la liste et la carte (il se remplit tout seul avec les formations réellement saisies, sans tenir compte des majuscules ni des accents).
- Détail d'un trajet et « Mes trajets » (trajets rejoints) : même affichage.
- Mon compte : choix **Femme / Homme / Non précisé** (par défaut : Non précisé).

## Mise en place (dans cet ordre)

1. **SQL** : Supabase → SQL Editor → coller `supabase_migration_v4.sql` → Run (rejouable sans risque).
2. **Fichiers** à copier dans le projet :
   - nouveaux : `src/lib/drivers.js`, `src/components/DriverTag.jsx`
   - modifiés : `src/lib/queries.js`, `src/pages/Account.jsx`, `src/pages/Carpooling.jsx`, `src/pages/RideDetails.jsx`, `src/pages/MyRides.jsx`
3. `git add . && git commit -m "v4 : qui conduit" && git push` (Vercel redéploie).

Sans l'étape 1, l'enregistrement du profil échoue (colonne `gender` absente) : faites le SQL d'abord.

## Limites volontaires
La formation est un texte libre : « L3 Maths » et « Licence 3 Maths » comptent comme deux formations. Pour des choix fixes, il faudrait une liste de formations.
