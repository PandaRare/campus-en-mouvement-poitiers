// src/constants/poitiersHubs.js
// Points de rendez-vous normalisés : des coordonnées fixes évitent les imprécisions
// des adresses saisies à la main et permettent de rapprocher deux trajets proches.
// ⚠️ À vérifier sur place (clic droit sur Google Maps → copier les coordonnées).
export const POITIERS_HUBS = [
  {
    id: 'campus-b25',
    name: 'Campus Sud — Sciences (Bât. B25 / SFA)',
    short: 'Campus · Sciences',
    zone: 'Campus Universitaire',
    lat: 46.5681,
    lng: 0.3842
  },
  {
    id: 'campus-ru-rabelais',
    name: 'Campus Sud — RU Rabelais / Droit (A1)',
    short: 'Campus · RU / Droit',
    zone: 'Campus Universitaire',
    lat: 46.5698,
    lng: 0.3795
  },
  {
    id: 'campus-iut',
    name: 'Campus Sud — IUT / Halle des Sports',
    short: 'Campus · IUT',
    zone: 'Campus Universitaire',
    lat: 46.5644,
    lng: 0.3861
  },
  {
    id: 'futuroscope-sp2mi',
    name: 'Futuroscope — Téléport 2 (SP2MI / ENSMA)',
    short: 'Futuroscope',
    zone: 'Technopole Futuroscope',
    lat: 46.6606,
    lng: 0.3614
  },
  {
    id: 'centre-gare',
    name: 'Centre-Ville — Gare SNCF (Pôle Multimodal)',
    short: 'Gare SNCF',
    zone: 'Centre-Ville',
    lat: 46.5821,
    lng: 0.3340
  },
  {
    id: 'centre-notre-dame',
    name: 'Centre-Ville — Place Notre-Dame / Présidence',
    short: 'Notre-Dame',
    zone: 'Centre-Ville',
    lat: 46.5831,
    lng: 0.3444
  },
  {
    id: 'chu-medecine',
    name: 'CHU La Milétrie — Faculté de Médecine & Pharmacie',
    short: 'CHU / Médecine',
    zone: 'Pôle Santé',
    lat: 46.5565,
    lng: 0.3910
  }
];

// Même liste, au format attendu par <AddressInput shortcuts={…} /> : { label, short, lat, lng }
export const HUB_PLACES = POITIERS_HUBS.map(({ name, short, lat, lng }) => ({
  label: name,
  short,
  lat,
  lng,
}));
