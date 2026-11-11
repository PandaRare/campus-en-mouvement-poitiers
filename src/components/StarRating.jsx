import { Star } from 'lucide-react'

const average = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Moyenne d'une personne : « ★ 4,6 (12) ». Rien tant qu'elle n'a pas été notée.
export function RatingSummary({ avg, count }) {
  if (!count) return null
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900"
      title={`${count} note${count > 1 ? 's' : ''}`}
    >
      <Star size={11} className="fill-current" />
      {average.format(Number(avg))}
      <span className="font-normal opacity-70">({count})</span>
    </span>
  )
}

// Cinq étoiles à toucher. value = note enregistrée (0 = pas encore noté).
export function StarPicker({ value = 0, onChange, disabled, label }) {
  return (
    <div className="flex gap-1" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          aria-pressed={value === n}
          className="p-1 disabled:opacity-50"
        >
          <Star
            size={28}
            className={n <= value ? 'fill-amber-400 text-amber-500' : 'text-pine-100'}
            strokeWidth={n <= value ? 1.5 : 2}
          />
        </button>
      ))}
    </div>
  )
}
