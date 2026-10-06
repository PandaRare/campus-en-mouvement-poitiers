// Utilitaires géographiques : distances, recherche d'adresse (Photon / OpenStreetMap)
// et calcul d'itinéraire (OSRM). Aucun de ces services ne demande de clé d'API.

// ⚠️ À ajuster : coordonnées exactes de ton campus (clic droit sur Google Maps / OSM → copier les coordonnées)
export const CAMPUS = { label: 'Campus', lat: 46.58, lng: 0.34 }

const R = 6371000 // rayon de la Terre en mètres
const toRad = (deg) => (deg * Math.PI) / 180

export const hasRoute = (ride) => Array.isArray(ride?.route) && ride.route.length > 1

// Distance à vol d'oiseau entre deux points [lat, lng], en mètres
export function haversine(a, b) {
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Distance minimale (en mètres) entre un point [lat, lng] et une ligne brisée [[lat, lng], ...]
export function distanceToRoute(point, route) {
  if (!route || route.length === 0) return Infinity
  if (route.length === 1) return haversine(point, route[0])

  const kx = R * Math.cos(toRad(point[0]))
  let min = Infinity
  for (let i = 0; i < route.length - 1; i++) {
    // Coordonnées planes (mètres) avec le point cherché à l'origine
    const ax = toRad(route[i][1] - point[1]) * kx
    const ay = toRad(route[i][0] - point[0]) * R
    const bx = toRad(route[i + 1][1] - point[1]) * kx
    const by = toRad(route[i + 1][0] - point[0]) * R
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
    const d = Math.hypot(ax + t * dx, ay + t * dy)
    if (d < min) min = d
  }
  return min
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(meters / 1000)} km`
}

// ------------------------------------------------------------
// Recherche d'adresses (Photon, basé sur OpenStreetMap)
// ------------------------------------------------------------
export async function searchPlaces(query, signal) {
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}` +
    `&limit=6&lang=fr&lat=${CAMPUS.lat}&lon=${CAMPUS.lng}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Recherche d’adresse indisponible')
  const json = await res.json()

  return (json.features ?? []).map((feature) => {
    const p = feature.properties ?? {}
    const [lng, lat] = feature.geometry.coordinates
    const street = [p.housenumber, p.street].filter(Boolean).join(' ')
    const title = p.name || street || p.city || 'Lieu'
    const details = [
      p.name && street ? street : null,
      p.postcode,
      p.city && p.city !== p.name ? p.city : null,
    ]
      .filter(Boolean)
      .join(', ')
    return { label: [title, details].filter(Boolean).join(', ').slice(0, 120), lat, lng }
  })
}

// ------------------------------------------------------------
// Itinéraire routier (OSRM). En cas d'échec : ligne droite approximative.
// ------------------------------------------------------------
function thin(points, max = 200) {
  const step = Math.max(1, Math.ceil(points.length / max))
  const out = points.filter((_, i) => i % step === 0)
  const last = points[points.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out.map(([lat, lng]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))])
}

export async function fetchRoute(from, to) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('osrm')
    const json = await res.json()
    const best = json.routes?.[0]
    if (!best) throw new Error('osrm')
    return {
      route: thin(best.geometry.coordinates.map(([lng, lat]) => [lat, lng])),
      distance_m: Math.round(best.distance),
      approximate: false,
    }
  } catch {
    return {
      route: [from, to],
      distance_m: Math.round(haversine(from, to) * 1.3),
      approximate: true,
    }
  }
}
