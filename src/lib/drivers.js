// Outils « qui conduit ? » : genre affiché et regroupement des formations.
import { Mars, Venus } from 'lucide-react'

export const GENDERS = [
  { value: 'non_precise', label: 'Non précisé' },
  { value: 'femme', label: 'Femme', Icon: Venus },
  { value: 'homme', label: 'Homme', Icon: Mars },
]

// Comparaison insensible à la casse et aux accents (« l3 maths » = « L3 Maths »)
export const normalizeText = (value) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

// Liste des formations présentes parmi les conducteurs : [{ key, label }], triée.
export function formationOptions(profiles) {
  const seen = new Map()
  for (const p of profiles) {
    const label = p.study?.trim()
    if (!label) continue
    const key = normalizeText(label)
    if (!seen.has(key)) seen.set(key, label)
  }
  return [...seen].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
}

export const profileMap = (profiles = []) => new Map(profiles.map((p) => [p.id, p]))
