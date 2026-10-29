import { Check, X } from 'lucide-react'
import { useMyAttendance, useProfiles, useReportAttendance } from '../lib/queries'

// Bouton Oui / Non : plein quand c'est la réponse enregistrée
function Choice({ selected, tone, onClick, disabled, children }) {
  const palette =
    selected && tone === 'ok'
      ? 'bg-pine-900 border-pine-900 text-white'
      : selected && tone === 'ko'
        ? 'bg-red-700 border-red-700 text-white'
        : 'border-pine-100 text-pine-700 bg-white'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium disabled:opacity-50 ${palette}`}
    >
      {children}
    </button>
  )
}

// Confirmation « le trajet a bien eu lieu » une fois l'heure de départ passée.
//   · le passager dit si le conducteur était au rendez-vous ;
//   · le conducteur dit, pour chaque passager, s'il était présent.
// Le score de fiabilité est recalculé côté serveur (fonction SQL report_attendance).
export default function AttendancePanel({ ride, isDriver, reservations }) {
  const mine = useMyAttendance(ride.id, true)
  const report = useReportAttendance(ride.id)

  const passengerIds = isDriver ? reservations.map((r) => r.user_id) : []
  const profiles = useProfiles(passengerIds)

  const answers = new Map((mine.data ?? []).map((row) => [row.user_id, row.attended]))
  const nameOf = (id) =>
    profiles.data?.find((p) => p.id === id)?.full_name || `Passager ${id.slice(0, 4)}`

  const send = (userId, attended) => report.mutate({ userId, attended })
  const pending = report.isPending

  const everyoneAnswered = isDriver && passengerIds.every((id) => answers.has(id))

  return (
    <section className="border-pine-100 mt-6 rounded-2xl border bg-white p-5">
      <h2 className="font-medium">
        {isDriver ? 'Qui était présent ?' : 'Le trajet a-t-il eu lieu ?'}
      </h2>
      <p className="text-pine-700 mt-1 text-sm">
        {isDriver
          ? 'Votre réponse met à jour le taux de trajets honorés de vos passagers.'
          : 'Votre réponse met à jour le taux de trajets honorés du conducteur.'}
      </p>

      {report.error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {report.error.message}
        </p>
      )}

      {isDriver ? (
        reservations.length === 0 ? (
          <p className="text-pine-500 mt-3 text-sm">Aucun passager sur ce trajet.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {passengerIds.map((id) => (
                <li key={id}>
                  <p className="mb-1.5 text-sm font-medium">{nameOf(id)}</p>
                  <div className="flex gap-2">
                    <Choice
                      tone="ok"
                      selected={answers.get(id) === true}
                      disabled={pending}
                      onClick={() => send(id, true)}
                    >
                      <Check size={16} /> Présent
                    </Choice>
                    <Choice
                      tone="ko"
                      selected={answers.get(id) === false}
                      disabled={pending}
                      onClick={() => send(id, false)}
                    >
                      <X size={16} /> Absent
                    </Choice>
                  </div>
                </li>
              ))}
            </ul>

            {passengerIds.length > 1 && !everyoneAnswered && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  passengerIds
                    .filter((id) => !answers.has(id))
                    .forEach((id) => report.mutate({ userId: id, attended: true }))
                }
                className="bg-pine-900 mt-4 w-full rounded-xl py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                Tous présents
              </button>
            )}
          </>
        )
      ) : (
        <div className="mt-4 flex gap-2">
          <Choice
            tone="ok"
            selected={answers.get(ride.driver_id) === true}
            disabled={pending}
            onClick={() => send(ride.driver_id, true)}
          >
            <Check size={16} /> Oui, trajet effectué
          </Choice>
          <Choice
            tone="ko"
            selected={answers.get(ride.driver_id) === false}
            disabled={pending}
            onClick={() => send(ride.driver_id, false)}
          >
            <X size={16} /> Conducteur absent
          </Choice>
        </div>
      )}

      <p className="text-pine-500 mt-3 text-xs">
        Confirmation possible pendant 7 jours après le départ. Vous pouvez modifier votre réponse
        pendant ce délai.
      </p>
    </section>
  )
}
