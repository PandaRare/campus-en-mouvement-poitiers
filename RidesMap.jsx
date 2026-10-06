import { Fragment, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Circle, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { CAMPUS } from '../lib/geo'

// Fond de carte CARTO « Voyager » (données © OpenStreetMap) : plus lisible que le fond OSM standard
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const dot = (color, size = 18) =>
  L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })

const ICONS = {
  small: dot('#2f7d63', 14),
  origin: dot('#2f7d63', 20),
  dest: dot('#123b31', 20),
  meeting: dot('#f4c04a', 22),
  me: dot('#2563eb', 20),
}

// Recadre la carte quand la liste de points change
function FitTo({ boundsKey }) {
  const map = useMap()
  useEffect(() => {
    if (!boundsKey) return
    const points = JSON.parse(boundsKey)
    if (points.length === 1) map.setView(points[0], 15)
    else map.fitBounds(points, { padding: [28, 28], maxZoom: 16 })
  }, [map, boundsKey])
  return null
}

const last = (arr) => arr[arr.length - 1]

export default function RidesMap({
  rides,
  selectedId = null,
  onSelect,
  point = null,
  radius = null,
  height = 288,
}) {
  const selected = rides.find((r) => r.id === selectedId) ?? null

  const boundsKey = useMemo(() => {
    const pts = []
    if (selected) {
      pts.push(...selected.route)
      if (selected.meeting_lat != null) pts.push([selected.meeting_lat, selected.meeting_lng])
    } else {
      rides.forEach((r) => pts.push(r.route[0], last(r.route)))
    }
    if (point) {
      if (radius) {
        const b = L.latLng(point).toBounds(radius * 2)
        pts.push([b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()])
      } else {
        pts.push(point)
      }
    }
    return pts.length ? JSON.stringify(pts) : ''
  }, [selected, rides, point, radius])

  // Le trajet sélectionné est dessiné en dernier pour rester au-dessus
  const ordered = [...rides].sort((a, b) => (a.id === selectedId) - (b.id === selectedId))
  const toggle = (id) => onSelect?.(id === selectedId ? null : id)

  return (
    <MapContainer
      center={[CAMPUS.lat, CAMPUS.lng]}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height }}
    >
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} subdomains="abcd" maxZoom={19} />
      <FitTo boundsKey={boundsKey} />

      {ordered.map((ride) => {
        const isSelected = ride.id === selectedId
        return (
          <Fragment key={ride.id}>
            <Polyline
              positions={ride.route}
              pathOptions={{
                color: isSelected ? '#123b31' : '#2f7d63',
                weight: isSelected ? 6 : 4,
                opacity: isSelected ? 0.95 : 0.55,
              }}
            />
            {/* Ligne invisible plus épaisse : zone de clic facile au doigt */}
            {onSelect && (
              <Polyline
                positions={ride.route}
                pathOptions={{ color: '#000', weight: 24, opacity: 0 }}
                eventHandlers={{ click: () => toggle(ride.id) }}
              />
            )}
            {onSelect && !isSelected && (
              <Marker
                position={ride.route[0]}
                icon={ICONS.small}
                eventHandlers={{ click: () => toggle(ride.id) }}
              />
            )}
          </Fragment>
        )
      })}

      {selected && (
        <>
          <Marker position={selected.route[0]} icon={ICONS.origin}>
            <Tooltip permanent direction="top" offset={[0, -10]} className="pin-tip">
              Départ
            </Tooltip>
          </Marker>
          <Marker position={last(selected.route)} icon={ICONS.dest}>
            <Tooltip permanent direction="top" offset={[0, -10]} className="pin-tip">
              Arrivée
            </Tooltip>
          </Marker>
          {selected.meeting_lat != null && (
            <Marker position={[selected.meeting_lat, selected.meeting_lng]} icon={ICONS.meeting}>
              <Tooltip permanent direction="top" offset={[0, -11]} className="pin-tip">
                Rendez-vous
              </Tooltip>
            </Marker>
          )}
        </>
      )}

      {point && (
        <>
          <Marker position={point} icon={ICONS.me}>
            <Tooltip permanent direction="top" offset={[0, -10]} className="pin-tip">
              Vous
            </Tooltip>
          </Marker>
          {radius && (
            <Circle
              center={point}
              radius={radius}
              pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.08 }}
            />
          )}
        </>
      )}
    </MapContainer>
  )
}
