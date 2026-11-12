// Gestion des notifications Web Push.
// Ce fichier est chargé par le service worker généré par vite-plugin-pwa
// (option `workbox.importScripts` dans vite.config.js).

const IS_IOS = /iPad|iPhone|iPod/.test(self.navigator.userAgent)

// Faut-il afficher la notification ? Non si la personne regarde déjà cette page
// (le message apparaît alors directement dans l'application). Sur iPhone on affiche toujours :
// Safari retire l'abonnement d'un site dont les notifications push ne sont pas affichées.
async function userIsLookingAt(path) {
  if (IS_IOS) return false
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  return windows.some(
    (client) =>
      client.visibilityState === 'visible' &&
      client.focused &&
      new URL(client.url).pathname === path,
  )
}

self.addEventListener('push', (event) => {
  let payload
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Campus en Mouvement', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Campus en Mouvement'
  const url = payload.url || '/notifications'
  const options = {
    body: payload.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: payload.tag || undefined, // un même tag remplace la notification précédente (ex. fil d'un trajet)
    renotify: Boolean(payload.tag), // …mais la personne est quand même alertée
    data: { url },
  }

  event.waitUntil(
    userIsLookingAt(new URL(url, self.location.origin).pathname).then((looking) =>
      looking && payload.tag !== 'test' ? undefined : self.registration.showNotification(title, options),
    ),
  )
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
