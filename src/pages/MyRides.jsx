import { Link } from 'react-router-dom'
import { ChevronRight, Repeat, Users } from 'lucide-react'
import OfflineNotice from '../components/OfflineNotice'
import { useMyRides } from '../lib/queries'

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
      {rides.map((ride) => {
        const done = new Date(ride.time) < new Date()
        return (
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
                {ride.meeting_label && !done && (
                  <p className="text-pine-500 mt-1 truncate text-xs">RDV : {ride.meeting_label}</p>
                )}
                {(done || ride.recurrence_group_id) && (
                  <p className="text-pine-500 mt-1 flex items-center gap-1 text-xs">
                    {done && 'Terminé'}
                    {done && ride.recurrence_group_id && ' · '}
                    {ride.recurrence_group_id && (
                      <>
                        <Repeat size={12} /> Hebdomadaire
                      </>
                    )}
                  </p>
                )}
              </div>
              <span className="bg-signal flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium">
                <Users size={14} />
                {ride.seats}
              </span>
              <ChevronRight size={18} className="text-pine-500 shrink-0" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default function MyRides({ session }) {
  const { data, isPending, error } = useMyRides(session.user.id)
  const driving = data?.driving ?? []
  const joined = data?.joined ?? []

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      <h1 className="mb-5 text-2xl font-semibold">Mes trajets</h1>

      <OfflineNotice />

      {error && !data && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error.message}</p>
      )}

      {isPending ? (
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
