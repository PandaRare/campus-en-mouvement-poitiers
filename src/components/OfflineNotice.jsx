import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

// Bandeau affiché tant que l'appareil n'a plus de connexion
export default function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )

  if (online) return null

  return (
    <p
      role="status"
      className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <WifiOff size={16} className="mt-0.5 shrink-0" />
      Hors connexion : vous voyez les dernières données chargées. Les messages et réservations
      reprendront dès que le réseau revient.
    </p>
  )
}
