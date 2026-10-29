import { Repeat } from 'lucide-react'
import { MAX_RECURRENCE_DAYS, addDays } from '../lib/recurrence'

// Jours au format ISO : 1 = lundi … 7 = dimanche (identique à la fonction SQL)
const DAYS = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mer' },
  { id: 4, label: 'Jeu' },
  { id: 5, label: 'Ven' },
  { id: 6, label: 'Sam' },
  { id: 7, label: 'Dim' },
]

// value : { enabled, days, endDate } — startDate : date du premier trajet ("AAAA-MM-JJ")
export default function RecurrenceFields({ value, onChange, startDate }) {
  const set = (patch) => onChange({ ...value, ...patch })

  const toggleDay = (id) =>
    set({
      days: value.days.includes(id) ? value.days.filter((d) => d !== id) : [...value.days, id],
    })

  return (
    <div className="border-pine-100 rounded-xl border p-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
          className="accent-pine-500 h-4 w-4"
        />
        <Repeat size={16} className="text-pine-500" />
        Répéter chaque semaine (emploi du temps)
      </label>

      {value.enabled && (
        <div className="mt-3 space-y-3">
          <div>
            <span className="text-pine-700 mb-1.5 block text-xs">Jours du trajet</span>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((day) => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  aria-pressed={value.days.includes(day.id)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    value.days.includes(day.id)
                      ? 'bg-pine-900 border-pine-900 text-white'
                      : 'border-pine-100 text-pine-700 bg-white'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-pine-700 mb-1 block text-xs">Répéter jusqu’au</span>
            <input
              type="date"
              required
              value={value.endDate}
              min={startDate || undefined}
              max={startDate ? addDays(startDate, MAX_RECURRENCE_DAYS) : undefined}
              onChange={(e) => set({ endDate: e.target.value })}
              className="border-pine-100 focus:border-pine-500 w-full rounded-xl border bg-white px-3 py-3 outline-none"
            />
          </label>

          <p className="text-pine-500 text-xs">
            Un trajet est créé pour chaque jour choisi, jusqu’à 6 mois. Vous pourrez annuler toute la
            série depuis le détail d’un trajet.
          </p>
        </div>
      )}
    </div>
  )
}
