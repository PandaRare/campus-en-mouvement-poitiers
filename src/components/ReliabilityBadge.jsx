import { Check } from 'lucide-react'

const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

// Taux de trajets honorés d'un membre.
//   score       : reliability_score (0–100)
//   totalRides  : total_scheduled_rides (trajets ayant fait l'objet d'une confirmation)
export function ReliabilityBadge({ score = 100, totalRides = 0 }) {
  if (!totalRides) {
    return (
      <span className="bg-pine-100 text-pine-700 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
        Nouveau membre
      </span>
    )
  }

  const value = Number(score)
  const tone =
    value >= 90
      ? 'bg-pine-100 text-pine-900'
      : value >= 75
        ? 'bg-amber-100 text-amber-900'
        : 'bg-red-100 text-red-800'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      <Check size={12} strokeWidth={3} />
      {percent.format(value)} % de trajets honorés
      <span className="font-normal opacity-70">
        ({totalRides} trajet{totalRides > 1 ? 's' : ''})
      </span>
    </span>
  )
}
