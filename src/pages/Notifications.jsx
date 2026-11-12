import { Link } from 'react-router-dom'
import { Bell, CalendarX, MessageCircle, UserMinus, UserPlus } from 'lucide-react'
import { useMarkNotificationsRead, useNotifications } from '../lib/queries'

const ICONS = {
  message: MessageCircle,
  passenger_joined: UserPlus,
  passenger_left: UserMinus,
  ride_cancelled: CalendarX,
  test: Bell,
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default function Notifications() {
  const { data: notifications = [], isPending, error } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const unread = notifications.filter((n) => !n.read_at)

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {unread.length > 0 && (
          <button
            type="button"
            onClick={() => markRead.mutate(null)}
            disabled={markRead.isPending}
            className="text-pine-700 text-sm underline underline-offset-4 disabled:opacity-50"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error.message}</p>
      )}

      {isPending ? (
        <p className="text-pine-700 text-sm">Chargement…</p>
      ) : notifications.length === 0 ? (
        <p className="border-pine-100 text-pine-700 rounded-2xl border border-dashed p-6 text-center text-sm">
          Rien pour l’instant. Vous serez prévenu ici de chaque message, nouveau passager,
          désistement ou annulation.{' '}
          <Link to="/compte" className="underline underline-offset-4">
            Activer les notifications sur cet appareil
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.kind] ?? Bell
            const isNew = !n.read_at
            return (
              <li key={n.id}>
                <Link
                  to={n.url}
                  onClick={() => isNew && markRead.mutate([n.id])}
                  className={`active:bg-pine-50 flex items-start gap-3 rounded-2xl border p-4 ${
                    isNew ? 'border-pine-500 bg-white' : 'border-pine-100 bg-white/60'
                  }`}
                >
                  <Icon size={18} className={`mt-0.5 shrink-0 ${isNew ? 'text-pine-900' : 'text-pine-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${isNew ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                    {n.body && <p className="text-pine-700 mt-0.5 line-clamp-2 text-sm">{n.body}</p>}
                    <p className="text-pine-500 mt-1 text-xs">{dateFormat.format(new Date(n.created_at))}</p>
                  </div>
                  {isNew && <span className="bg-signal mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" aria-label="Non lue" />}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
