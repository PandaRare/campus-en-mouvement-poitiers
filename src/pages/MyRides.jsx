import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function RideList({ rides, emptyLabel }) {
  if (rides.length === 0) {
    return (
      <p className="border-pine-100 text-pine-700 rounded-2xl border border-dashed p-6 text-center text-sm">
        {emptyLabel}
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {rides.map((ride) => (
        <li key={ride.id}>
          <Link
            to={`/trajets/${ride.id}`}
            className="border-pine-100 active:bg-pine-50 flex items-center gap-3 rounded-2xl border bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {ride.origin} → {ride.destination}
              </p>
              <p className="text-pine-700 mt-1 text-sm">
                {dateFormat.format(new Date(ride.time))}
              </p>
              {new Date(ride.time) < new Date() && (
                <p className="text-pine-500 mt-1 text-xs">Terminé</p>
              )}
            </div>
            <span className="bg-signal flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium">
              <Users size={14} />
              {ride.seats}
            </span>
            <ChevronRight size={18} className="text-pine-500 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function MyRides({ session }) {
  const userId = session.user.id
  const [driving, setDriving] = useState([])
  const [joined, setJoined] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const [driven, booked] = await Promise.all([
      supabase
        .from('rides')
        .select('*')
        .eq('driver_id', userId)
        .order('time', { ascending: true }),
      supabase
        .from('reservations')
        .select('id, created_at, rides (*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ])

    if (driven.error || booked.error) {
      setError((driven.error ?? booked.error).message)
    } else {
      setError(null)
      setDriving(driven.data ?? [])
      setJoined(
        (booked.data ?? [])
          .map((row) => row.rides)
          .filter(Boolean)
          .sort((a, b) => new Date(a.time) - new Date(b.time)),
      )
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('my-rides-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      <h1 className="mb-5 text-2xl font-semibold">Mes trajets</h1>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {loading ? (
        <p className="text-pine-700 text-sm">Chargement…</p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 font-medium">
              Je conduis <span className="text-pine-500">({driving.length})</span>
            </h2>
            <RideList
              rides={driving}
              emptyLabel="Vous n'avez publié aucun trajet. Proposez-en un depuis l'accueil."
            />
          </section>

          <section>
            <h2 className="mb-3 font-medium">
              J'ai rejoint <span className="text-pine-500">({joined.length})</span>
            </h2>
            <RideList
              rides={joined}
              emptyLabel="Vous n'avez rejoint aucun trajet pour l'instant."
            />
          </section>
        </>
      )}
    </main>
  )
}
