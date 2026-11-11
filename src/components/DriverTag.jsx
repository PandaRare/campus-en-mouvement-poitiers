import { User } from 'lucide-react'
import { GENDERS } from '../lib/drivers'
import { RatingSummary } from './StarRating'

// « Qui conduit ? » : prénom / pseudo, formation et genre (si renseigné).
//   profile : ligne de la table profiles (peut être absente : profil jamais rempli)
//   id      : identifiant du conducteur, pour l'affichage de secours
export default function DriverTag({ profile, id = '', isMe = false }) {
  const name = isMe ? 'Vous' : profile?.full_name?.trim() || `Conducteur ${id.slice(0, 4)}`
  const study = profile?.study?.trim()
  const gender = GENDERS.find((g) => g.value === profile?.gender && g.Icon)

  return (
    <span className="text-pine-700 inline-flex min-w-0 items-center gap-1.5 text-xs">
      <User size={13} className="text-pine-500 shrink-0" />
      <span className="truncate">
        <strong className="text-pine-900 font-medium">{name}</strong>
        {study && <> · {study}</>}
      </span>
      <RatingSummary avg={profile?.rating_avg} count={profile?.rating_count} />
      {gender && (
        <span className="bg-pine-100 text-pine-700 inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px]">
          <gender.Icon size={11} />
          {gender.label}
        </span>
      )}
    </span>
  )
}
