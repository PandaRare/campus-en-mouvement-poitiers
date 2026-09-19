# Installation — Campus en Mouvement

```bash
# 1. Projet Vite + React
npm create vite@latest campus-en-mouvement -- --template react
cd campus-en-mouvement
npm install

# 2. Tailwind CSS v4 (plugin Vite, pas de tailwind.config.js nécessaire)
npm install tailwindcss @tailwindcss/vite

# 3. Supabase, Router, Leaflet
npm install @supabase/supabase-js react-router-dom leaflet react-leaflet

# 4. PWA
npm install -D vite-plugin-pwa

# 5. Variables d'environnement
printf 'VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ...\n' > .env.local

# 6. Lancer
npm run dev
```

Arborescence attendue :

```
src/
  lib/supabase.js
  pages/Auth.jsx
  pages/Carpooling.jsx
  App.jsx
  main.jsx
  index.css
vite.config.js
```

Test PWA (le service worker ne tourne qu'en build) :

```bash
npm run build && npm run preview
```
