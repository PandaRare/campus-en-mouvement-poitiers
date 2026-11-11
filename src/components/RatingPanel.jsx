import { StarPicker } from './StarRating'
import { useMyRatings, useProfiles, useRateUser } from '../lib/queries'

// Notes (1 à 5 étoiles) une fois le trajet passé.
//   · le passager note le conducteur ;
//   · le conducteur note chacun de ses passagers.
// La moyenne est calculée côté serveur (fonction SQL rate_user).
export default function RatingPanel({ ride, isDriver, reservations }) {
  const mine = useMyRatings(ride.id, true)
  const rate = useRateUser(ride.id)

  const targetIds = isDriver ? reservations.map((r) => r.user_id) : [ride.driver_id]
  const profiles = useProfiles(targetIds)

  const given = new Map((mine.data ?? []).map((row) => [row.ratee_id, row.stars]))
  const nameOf = (id) =>
    profiles.data?.find((p) => p.id === id)?.full_name ||
    `${id === ride.driver_id ? 'Conducteur' : 'Passager'} ${id.slice(0, 4)}`

  if (targetIds.length === 0) return null

  return (
    <section className="border-pine-100 mt-6 rounded-2xl border bg-white p-5">
      <h2 className="font-medium">{isDriver ? 'Notez vos passagers' : 'Notez le conducteur'}</h2>
      <p className="text-pine-700 mt-1 text-sm">
        1 étoile : mauvaise expérience, 5 étoiles : parfait. La note est visible sous forme de
        moyenne, jamais avec votre nom.
      </p>

      {rate.error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{rate.error.message}</p>
      )}

      <ul className="mt-4 space-y-4">
        {targetIds.map((id) => (
          <li key={id}>
            <p className="mb-1 text-sm font-medium">
              {nameOf(id)}
              {given.has(id) && <span className="text-pine-500 font-normal"> · noté</span>}
            </p>
            <StarPicker
              label={`Note pour ${nameOf(id)}`}
              value={given.get(id) ?? 0}
              disabled={rate.isPending}
              onChange={(stars) => rate.mutate({ userId: id, stars })}
            />
          </li>
        ))}
      </ul>

      <p className="text-pine-500 mt-3 text-xs">
        Notation possible pendant 7 jours après le départ. Vous pouvez modifier votre note pendant
        ce délai.
      </p>
    </section>
  )
}
