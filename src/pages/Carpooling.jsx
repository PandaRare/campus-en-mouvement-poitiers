import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight, Users, MapPin, LocateFixed, X, Flag, Navigation } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AddressInput from '../components/AddressInput'
import RidesMap from '../components/RidesMap'
import { CAMPUS, distanceToRoute, fetchRoute, formatDistance, hasRoute } from '../lib/geo'

const RADIUS_OPTIONS = [500, 1000, 2000, 5000]

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const emptyForm = {
  origin: '',
  originPlace: null,
  destination: '',
  destPlace: null,
  meeting: '',
  meetingPlace: null,
  time: '',
  seats: 2,
}

// Comparaison insensible à la casse et aux accents
const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export default function Carpooling({ session }) {
  const [rides, setRides] = useState([])
  const [query, setQuery] = useState('')
  const [point, setPoint] = useState(null) // lieu cherché { label, lat, lng }
  const [radius, setRadius] = useState(1000)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const mapRef = useRef(null)

  const userId = session.user.id

  const loadRides = useCallback(async () => {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .gte('time', new Date().toISOString())
      .order('time', { ascending: true })

    if (error) setError(error.message)
    else setRides(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRides()
    const channel = supabase
      .channel('rides-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, loadRides)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadRides])

  function locateMe() {
    if (!navigator.geolocation) {
      setError('La géolocalisation n’est pas disponible sur cet appareil.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setError(null)
        setPoint({ label: 'Ma position', lat: pos.coords.latitude, lng: pos.coords.longitude })
        setQuery('Ma position')
      },
      () => setError('Position introuvable : vérifiez l’autorisation de localisation du navigateur.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function publishRide(e) {
    e.preventDefault()
    setError(null)

    if (!form.originPlace || !form.destPlace) {
      setError('Choisissez le départ et l’arrivée dans la liste de suggestions pour les placer sur la carte.')
      return
    }
    if (form.meeting.trim() && !form.meetingPlace) {
      setError('Choisissez le point de rendez-vous dans la liste de suggestions, ou videz le champ.')
      return
    }

    setBusy(true)
    const { originPlace: o, destPlace: d, meetingPlace: m } = form
    const { route, distance_m } = await fetchRoute([o.lat, o.lng], [d.lat, d.lng])

    const { error } = await supabase.from('rides').insert({
      driver_id: userId,
      origin: o.label,
      destination: d.label,
      time: new Date(form.time).toISOString(),
      seats: Number(form.seats),
      origin_lat: o.lat,
      origin_lng: o.lng,
      dest_lat: d.lat,
      dest_lng: d.lng,
      meeting_label: m ? m.label : null,
      meeting_lat: m ? m.lat : null,
      meeting_lng: m ? m.lng : null,
      route,
      distance_m,
    })

    if (error) {
      setError(error.message)
    } else {
      setForm(emptyForm)
      setShowForm(false)
    }
    setBusy(false)
  }

  const minDateTime = useMemo(() => new Date().toISOString().slice(0, 16), [])
  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const pt = useMemo(() => (point ? [point.lat, point.lng] : null), [point])

  // Mode « adresse » : trajets dont le tracé passe à moins de `radius` mètres du point.
  // Mode « texte » : filtre sur les noms de départ / arrivée.
  const results = useMemo(() => {
    if (pt) {
      return rides
        .map((ride) => ({
          ...ride,
          near: hasRoute(ride) ? distanceToRoute(pt, ride.route) : Infinity,
        }))
        .filter((ride) => ride.near <= radius)
    }
    const q = normalize(query)
    if (!q) return rides
    return rides.filter(
      (ride) =>
        normalize(ride.origin).includes(q) || normalize(ride.destination).includes(q),
    )
  }, [rides, pt, radius, query])

  const mapRides = useMemo(() => results.filter(hasRoute), [results])
  const selected = results.find((ride) => ride.id === selectedId) ?? null

  function showOnMap(id) {
    setSelectedId(id)
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Trajets du campus</h1>
        <p className="text-pine-700 text-sm">{session.user.email}</p>
      </header>

      <div className="mb-2 flex gap-2">
        <div className="min-w-0 flex-1">
          <AddressInput
            value={query}
            onChange={setQuery}
            selected={point}
            onSelect={setPoint}
            LeftIcon={Search}
            ariaLabel="Rechercher une adresse ou une ville"
            placeholder="Ville, adresse, lieu…"
          />
        </div>
        <button
          type="button"
          onClick={locateMe}
          aria-label="Utiliser ma position"
          className="border-pine-100 text-pine-700 shrink-0 rounded-xl border bg-white px-3.5"
        >
          <LocateFixed size={20} />
        </button>
      </div>

      {point ? (
        <div className="mb-4">
          <p className="text-pine-700 mb-2 text-sm">
            Trajets qui passent près de <strong>{point.label}</strong>
          </p>
          <div className="flex gap-2">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  radius === r
                    ? 'bg-pine-900 border-pine-900 text-white'
                    : 'border-pine-100 text-pine-700 bg-white'
                }`}
              >
                {r < 1000 ? `${r} m` : `${r / 1000} km`}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-pine-500 mb-4 text-xs">
          Choisissez une adresse dans les suggestions pour voir les trajets qui passent près de
          vous, ou tapez une ville pour filtrer la liste.
        </p>
      )}

      <div ref={mapRef} className="mb-3 scroll-mt-4">
        <RidesMap
          rides={mapRides}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          point={pt}
          radius={point ? radius : null}
          height={300}
        />
      </div>

      {selected ? (
        <section className="border-pine-100 mb-6 rounded-2xl border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">
                {selected.origin} → {selected.destination}
              </p>
              <p className="text-pine-700 mt-1 text-sm">
                {dateFormat.format(new Date(selected.time))} · {selected.seats} place
                {selected.seats > 1 ? 's' : ''}
                {selected.distance_m ? ` · ${formatDistance(selected.distance_m)}` : ''}
              </p>
              {selected.near != null && selected.near !== Infinity && (
                <p className="text-pine-500 mt-1 text-xs">
                  Passe à {formatDistance(selected.near)} de {point.label}
                </p>
              )}
              {selected.meeting_label && (
                <p className="text-pine-700 mt-1 flex items-start gap-1 text-sm">
                  <Flag size={14} className="text-pine-500 mt-0.5 shrink-0" />
                  RDV : {selected.meeting_label}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Fermer"
              className="text-pine-500 p-1"
            >
              <X size={18} />
            </button>
          </div>
          <Link
            to={`/trajets/${selected.id}`}
            className="bg-pine-900 mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-white"
          >
            <Navigation size={16} /> Voir le trajet
          </Link>
        </section>
      ) : (
        mapRides.length > 0 && (
          <p className="text-pine-500 mb-6 text-center text-xs">
            Touchez un trajet sur la carte pour voir ses détails.
          </p>
        )
      )}

      <section className="border-pine-100 mb-6 rounded-2xl border bg-white p-4">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex w-full items-center justify-between font-medium"
          aria-expanded={showForm}
        >
          Proposer un trajet
          <ChevronRight
            size={20}
            className={`text-pine-500 transition-transform ${showForm ? 'rotate-90' : ''}`}
          />
        </button>

        {showForm && (
          <form onSubmit={publishRide} className="mt-4 space-y-3">
            <AddressInput
              required
              value={form.origin}
              onChange={setField('origin')}
              selected={form.originPlace}
              onSelect={setField('originPlace')}
              shortcuts={[CAMPUS]}
              ariaLabel="Départ"
              placeholder="Départ (ex. Gare de Poitiers)"
            />
            <AddressInput
              required
              value={form.destination}
              onChange={setField('destination')}
              selected={form.destPlace}
              onSelect={setField('destPlace')}
              shortcuts={[CAMPUS]}
              ariaLabel="Arrivée"
              placeholder="Arrivée (ex. Campus)"
            />
            <AddressInput
              value={form.meeting}
              onChange={setField('meeting')}
              selected={form.meetingPlace}
              onSelect={setField('meetingPlace')}
              LeftIcon={Flag}
              ariaLabel="Point de rendez-vous"
              placeholder="Point de rendez-vous (optionnel)"
            />
            <div className="flex gap-3">
              <input
                required
                type="datetime-local"
                min={minDateTime}
                value={form.time}
                onChange={(e) => setField('time')(e.target.value)}
                className="border-pine-100 focus:border-pine-500 w-full rounded-xl border px-3 py-3 outline-none"
              />
              <select
                value={form.seats}
                onChange={(e) => setField('seats')(e.target.value)}
                className="border-pine-100 focus:border-pine-500 rounded-xl border px-3 py-3 outline-none"
                aria-label="Places disponibles"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} place{n > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="bg-pine-900 w-full rounded-xl py-3.5 font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Calcul du trajet…' : 'Publier le trajet'}
            </button>
          </form>
        )}
      </section>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <section>
        <h2 className="mb-3 font-medium">
          À venir{' '}
          {!loading && <span className="text-pine-500">({results.length})</span>}
        </h2>

        {loading && <p className="text-pine-700 text-sm">Chargement des trajets…</p>}

        {!loading && results.length === 0 && (
          <p className="border-pine-100 text-pine-700 rounded-2xl border border-dashed p-6 text-center text-sm">
            {point
              ? `Aucun trajet ne passe à moins de ${radius < 1000 ? `${radius} m` : `${radius / 1000} km`} de cette adresse. Élargissez le rayon.`
              : query
                ? `Aucun trajet ne correspond à « ${query} ». Essayez une autre ville.`
                : 'Aucun trajet pour le moment. Publiez le premier.'}
          </p>
        )}

        <ul className="space-y-3">
          {results.map((ride) => (
            <li
              key={ride.id}
              className={`flex items-stretch rounded-2xl border bg-white ${
                ride.id === selected?.id ? 'border-pine-500' : 'border-pine-100'
              }`}
            >
              <Link
                to={`/trajets/${ride.id}`}
                className="active:bg-pine-50 flex min-w-0 flex-1 items-center gap-3 rounded-l-2xl p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {ride.origin} → {ride.destination}
                  </p>
                  <p className="text-pine-700 mt-1 text-sm">
                    {dateFormat.format(new Date(ride.time))}
                    {ride.near != null && ride.near !== Infinity && (
                      <span className="text-pine-500"> · à {formatDistance(ride.near)}</span>
                    )}
                  </p>
                  {ride.driver_id === userId && (
                    <p className="text-pine-500 mt-1 text-xs">Vous conduisez ce trajet</p>
                  )}
                </div>
                <span className="bg-signal flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium">
                  <Users size={14} />
                  {ride.seats}
                </span>
              </Link>
              {hasRoute(ride) ? (
                <button
                  type="button"
                  onClick={() => showOnMap(ride.id)}
                  aria-label="Voir sur la carte"
                  className="text-pine-500 border-pine-100 active:bg-pine-50 shrink-0 rounded-r-2xl border-l px-3.5"
                >
                  <MapPin size={18} />
                </button>
              ) : (
                <span className="px-2" />
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
