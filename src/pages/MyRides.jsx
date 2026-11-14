import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Repeat, Users } from 'lucide-react'
import DriverTag from '../components/DriverTag'
import OfflineNotice from '../components/OfflineNotice'
import { profileMap } from '../lib/drivers'
import { useMyRides, useProfiles } from '../lib/queries'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const RATE_WINDOW_MS = 7 * 24 * 3600 * 1000 // même délai que la notation côté SQL
const MAX_PAST = 30

// Un trajet terminé depuis moins de 7 jours peut encore être noté / confirmé
const canStillRate = (ride, now) => {
  const age = now - new Date(ride.time).getTime()
  return age > 0 && age < RATE_WINDOW_MS
}

function RideRow({ ride, drivers, past, highlight, now }) {
  const isDriver = ride.role === 'driver'
  return (
    <li>
      <Link
        to={`/trajets/${ride.id}`}
        className={`active:bg-pine-50 flex items-center gap-3 rounded-2xl border bg-white p-4 ${
          highlight ? 'border-pine-500' : 'border-pine-100'
        } ${past ? 'opacity-70' : ''}`}
      >
        <div className="min-w-0 flex-1">
          {highlight && (
            <p className="text-pine-700 mb-1 text-[11px] font-semibold tracking-wide uppercase">
              Prochain départ
            </p>
          )}
          <p className="truncate font-medium">
            {ride.origin} → {ride.destination}
          </p>
          <p className="text-pine-700 mt-1 text-sm">{dateFormat.format(new Date(ride.time))}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isDriver ? 'bg-pine-900 text-white' : 'bg-pine-100 text-pine-900'
              }`}
            >
              {isDriver ? 'Conducteur' : 'Passager'}
            </span>
            {!isDriver && <DriverTag profile={drivers.get(ride.driver_id)} id={ride.driver_id} />}
            {ride.recurrence_group_id && (
              <span className="text-pine-500 inline-flex items-center gap-1 text-xs">
                <Repeat size={12} /> Hebdomadaire
              </span>
            )}
            {past && canStillRate(ride, now) && (
              <span className="bg-signal rounded-full px-2 py-0.5 text-[11px] font-medium">À noter</span>
            )}
          </div>

          {ride.meeting_label && !past && (
            <p className="text-pine-500 mt-1.5 truncate text-xs">RDV : {ride.meeting_label}</p>
          )}
        </div>

        {isDriver && !past && (
          <span className="bg-signal flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium">
            <Users size={14} />
            {ride.seats}
          </span>
        )}
        <ChevronRight size={18} className="text-pine-500 shrink-0" />
      </Link>
    </li>
  )
}

export default function MyRides({ session }) {
  const { data, isPending, error } = useMyRides(session.user.id)

  const driving = useMemo(() => data?.driving ?? [], [data])
  const joined = useMemo(() => data?.joined ?? [], [data])

  const driverIds = useMemo(() => [...new Set(joined.map((r) => r.driver_id))], [joined])
  const { data: driverProfiles } = useProfiles(driverIds)
  const drivers = useMemo(() => profileMap(driverProfiles), [driverProfiles])

  // Conduits et rejoints dans une seule liste : À VENIR d'abord (le plus proche en haut),
  // les trajets terminés sont repliés plus bas.
  // « Maintenant » se met à jour chaque minute : un trajet qui part passe tout seul dans « terminés »
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const { upcoming, past, pastCount, toRate } = useMemo(() => {
    const all = [
      ...driving.map((r) => ({ ...r, role: 'driver' })),
      ...joined.map((r) => ({ ...r, role: 'passenger' })),
    ]
    const time = (r) => new Date(r.time).getTime()
    const upcomingRides = all.filter((r) => time(r) >= now).sort((a, b) => time(a) - time(b))
    const pastRides = all.filter((r) => time(r) < now).sort((a, b) => time(b) - time(a))
    return {
      upcoming: upcomingRides,
      past: pastRides.slice(0, MAX_PAST),
      pastCount: pastRides.length,
      toRate: pastRides.filter((r) => canStillRate(r, now)).length,
    }
  }, [driving, joined, now])

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
              À venir <span className="text-pine-500">({upcoming.length})</span>
            </h2>

            {upcoming.length === 0 ? (
              <p className="border-pine-100 text-pine-700 rounded-2xl border border-dashed p-6 text-center text-sm">
                Aucun trajet à venir.{' '}
                <Link to="/trajets" className="underline underline-offset-4">
                  Trouver ou proposer un trajet
                </Link>
              </p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((ride, index) => (
                  <RideRow key={ride.id} ride={ride} drivers={drivers} now={now} highlight={index === 0} />
                ))}
              </ul>
            )}
          </section>

          {pastCount > 0 && (
            <details className="group">
              <summary className="text-pine-700 flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <ChevronRight size={16} className="transition-transform group-open:rotate-90" />
                Trajets terminés ({pastCount})
                {toRate > 0 && (
                  <span className="bg-signal rounded-full px-2 py-0.5 text-[11px] font-medium text-black">
                    {toRate} à noter
                  </span>
                )}
              </summary>

              <ul className="mt-3 space-y-3">
                {past.map((ride) => (
                  <RideRow key={ride.id} ride={ride} drivers={drivers} now={now} past />
                ))}
              </ul>
              {pastCount > MAX_PAST && (
                <p className="text-pine-500 mt-3 text-center text-xs">Les {MAX_PAST} plus récents sont affichés.</p>
              )}
            </details>
          )}
        </>
      )}
    </main>
  )
}
