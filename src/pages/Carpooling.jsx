import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet'
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { Search, X, ChevronRight, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Correctif des icônes Leaflet avec un bundler
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

const CAMPUS = [46.58, 0.34]

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const emptyForm = { origin: '', destination: '', time: '', seats: 2 }

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
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

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

  async function publishRide(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const { error } = await supabase.from('rides').insert({
      driver_id: userId,
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      time: new Date(form.time).toISOString(),
      seats: Number(form.seats),
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
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const filtered = useMemo(() => {
    const q = normalize(query)
    if (!q) return rides
    return rides.filter(
      (ride) =>
        normalize(ride.origin).includes(q) || normalize(ride.destination).includes(q),
    )
  }, [rides, query])

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Trajets du campus</h1>
        <p className="text-pine-700 text-sm">{session.user.email}</p>
      </header>

      <div className="relative mb-5">
        <Search
          size={18}
          className="text-pine-500 pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une ville de départ ou d'arrivée"
          className="border-pine-100 focus:border-pine-500 w-full rounded-xl border bg-white py-3 pr-11 pl-11 text-base outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Effacer la recherche"
            className="text-pine-500 absolute top-1/2 right-3 -translate-y-1/2 p-1"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <MapContainer center={CAMPUS} zoom={14} scrollWheelZoom={false} className="mb-6">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        <Circle center={CAMPUS} radius={700} pathOptions={{ color: '#2f7d63', weight: 1 }} />
        <Marker position={CAMPUS}>
          <Popup>Campus — point de rendez-vous</Popup>
        </Marker>
      </MapContainer>

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
            <input
              required
              value={form.origin}
              onChange={set('origin')}
              placeholder="Départ (ex. Gare de Poitiers)"
              className="border-pine-100 focus:border-pine-500 w-full rounded-xl border px-4 py-3 outline-none"
            />
            <input
              required
              value={form.destination}
              onChange={set('destination')}
              placeholder="Arrivée (ex. Campus)"
              className="border-pine-100 focus:border-pine-500 w-full rounded-xl border px-4 py-3 outline-none"
            />
            <div className="flex gap-3">
              <input
                required
                type="datetime-local"
                min={minDateTime}
                value={form.time}
                onChange={set('time')}
                className="border-pine-100 focus:border-pine-500 w-full rounded-xl border px-3 py-3 outline-none"
              />
              <select
                value={form.seats}
                onChange={set('seats')}
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
              {busy ? 'Publication…' : 'Publier le trajet'}
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
          {!loading && <span className="text-pine-500">({filtered.length})</span>}
        </h2>

        {loading && <p className="text-pine-700 text-sm">Chargement des trajets…</p>}

        {!loading && filtered.length === 0 && (
          <p className="border-pine-100 text-pine-700 rounded-2xl border border-dashed p-6 text-center text-sm">
            {query
              ? `Aucun trajet ne correspond à « ${query} ». Essayez une autre ville.`
              : 'Aucun trajet pour le moment. Publiez le premier.'}
          </p>
        )}

        <ul className="space-y-3">
          {filtered.map((ride) => (
            <li key={ride.id}>
              <Link
                to={`/trajets/${ride.id}`}
                className="border-pine-100 active:bg-pine-50 flex items-center gap-3 rounded-2xl border bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {ride.origin} → {ride.destination}
                  </p>
                  <p className="text-pine-700 mt-1 text-sm">
                    {dateFormat.format(new Date(ride.time))}
                  </p>
                  {ride.driver_id === userId && (
                    <p className="text-pine-500 mt-1 text-xs">Vous conduisez ce trajet</p>
                  )}
                </div>
                <span className="bg-signal flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium">
                  <Users size={14} />
                  {ride.seats}
                </span>
                <ChevronRight size={18} className="text-pine-500 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
