import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { disablePush, enablePush, getPushState } from '../lib/push'

// Active / désactive les notifications push sur cet appareil
export default function PushToggle() {
  const [state, setState] = useState(null) // null = vérification en cours
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    getPushState().then((next) => {
      if (active) setState(next)
    })
    return () => {
      active = false
    }
  }, [])

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (state === 'subscribed') await disablePush()
      else await enablePush()
      setState(await getPushState())
    } catch (err) {
      setError(err.message)
      setState(await getPushState())
    } finally {
      setBusy(false)
    }
  }

  if (state === null) return null

  const hint = {
    unsupported:
      'Votre navigateur ne gère pas les notifications. Sur iPhone, installez d’abord l’application sur l’écran d’accueil.',
    unconfigured: 'Les notifications ne sont pas encore configurées sur ce site.',
    denied: 'Notifications bloquées : autorisez-les dans les réglages du navigateur, puis revenez ici.',
    idle: 'Soyez prévenu d’un nouveau message, d’un passager ou d’un désistement, même application fermée.',
    subscribed: 'Activées sur cet appareil.',
  }[state]

  const disabled = busy || ['unsupported', 'unconfigured', 'denied'].includes(state)

  return (
    <section className="border-pine-100 mt-6 rounded-2xl border bg-white p-4">
      <h2 className="font-medium">Notifications</h2>
      <p className="text-pine-700 mt-1 text-sm">{hint}</p>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium disabled:opacity-50 ${
          state === 'subscribed'
            ? 'border-pine-100 border bg-white'
            : 'bg-pine-900 text-white'
        }`}
      >
        {state === 'subscribed' ? <BellOff size={18} /> : <Bell size={18} />}
        {busy
          ? 'Un instant…'
          : state === 'subscribed'
            ? 'Désactiver les notifications'
            : 'Activer les notifications'}
      </button>
    </section>
  )
}
