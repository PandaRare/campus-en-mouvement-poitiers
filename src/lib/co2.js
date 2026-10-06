// Facteurs d'émission en kg de CO₂ par km et par véhicule.
// ⚠️ Ordres de grandeur arrondis, proches de ceux de la Base Empreinte® de l'ADEME.
// À vérifier / ajuster avant toute communication officielle.
export const VEHICLES = [
  { id: 'essence', label: 'Essence', factor: 0.21 },
  { id: 'diesel', label: 'Diesel', factor: 0.19 },
  { id: 'hybride', label: 'Hybride', factor: 0.12 },
  { id: 'electrique', label: 'Électrique', factor: 0.02 },
]
export const DEFAULT_VEHICLE = 'essence'

// Un arbre absorbe environ 25 kg de CO₂ par an (valeur indicative)
export const TREE_KG_PER_YEAR = 25

// passengers = nombre de passagers (sans le conducteur)
export function tripSavings({ distanceKm, factor, passengers }) {
  const carTotal = distanceKm * factor // émissions de la voiture, quel que soit le nombre d'occupants
  const occupants = passengers + 1
  const perPerson = carTotal / occupants
  return {
    carTotal,
    perPerson,
    savedPerPerson: carTotal - perPerson, // part de CO₂ évitée par occupant vs trajet en solo
    savedTotal: carTotal * passengers, // voitures en moins sur la route
  }
}

export function formatKg(kg) {
  if (kg >= 1000) {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(kg / 1000)} t`
  }
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: kg < 10 ? 1 : 0 }).format(kg)} kg`
}
