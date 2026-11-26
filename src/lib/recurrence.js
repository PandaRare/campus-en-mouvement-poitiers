// Constantes et utilitaires de la récurrence (partagés par le formulaire et la page d'accueil)
export const MAX_RECURRENCE_DAYS = 180 // limite côté serveur : 6 mois

export const emptyRecurrence = { enabled: false, days: [1, 2, 3, 4, 5], endDate: '' }

// "AAAA-MM-JJ" + n jours → "AAAA-MM-JJ"
export function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + n)
  const pad = (v) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
