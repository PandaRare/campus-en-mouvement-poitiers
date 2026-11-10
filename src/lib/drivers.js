// Outils « qui conduit ? » : genre affiché et regroupement des formations.
import { Mars, Venus } from 'lucide-react'

export const GENDERS = [
  { value: 'non_precise', label: 'Non précisé' },
  { value: 'femme', label: 'Femme', Icon: Venus },
  { value: 'homme', label: 'Homme', Icon: Mars },
]

// Valeurs d'un champ (level / discipline) réellement présentes chez les conducteurs,
// dans l'ordre de la liste de référence.
export function presentValues(profiles, field, reference) {
  const present = new Set(profiles.map((p) => p[field]).filter(Boolean))
  return reference.filter((value) => present.has(value))
}

export const profileMap = (profiles = []) => new Map(profiles.map((p) => [p.id, p]))
