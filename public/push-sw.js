// Gestion des notifications Web Push.
// Ce fichier est chargé par le service worker généré par vite-plugin-pwa
// (option `workbox.importScripts` dans vite.config.js).

self.addEventListener('push', (event) => {
  let payload
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Campus en Mouvement', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Campus en Mouvement'
  const options = {
    body: payload.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: payload.tag, // un même tag remplace la notification précédente (ex. fil d'un trajet)
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/mes-trajets' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Application déjà ouverte : on la ramène au premier plan sur la bonne page
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.focus().then(() => ('navigate' in client ? client.navigate(target) : undefined))
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
