import { useEffect, useMemo, useState } from 'react'
import { Leaf, TreePine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  VEHICLES,
  DEFAULT_VEHICLE,
  TREE_KG_PER_YEAR,
  tripSavings,
  formatKg,
} from '../lib/co2'

const STORAGE_KEY = 'cem-vehicle'

function readVehicle() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return VEHICLES.some((v) => v.id === saved) ? saved : DEFAULT_VEHICLE
  } catch {
    return DEFAULT_VEHICLE
  }
}

const inputClass =
  'border-pine-100 focus:border-pine-500 w-full rounded-xl border bg-white px-3 py-3 outline-none'

const treesLabel = (kg) => {
  const trees = kg / TREE_KG_PER_YEAR
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(trees)} arbre${trees >= 2 ? 's' : ''}`
}

export default function Co2({ session }) {
  const userId = session.user.id
  const [vehicle, setVehicle] = useState(readVehicle)
  const [rides, setRides] = useState(null) // null = chargement
  const [error, setError] = useState(null)
  const [sim, setSim] = useState({ distance: '10', people: 2, perWeek: 4, weeks: 30, roundTrip: true })

  const factor = VEHICLES.find((v) => v.id === vehicle)?.factor ?? 0.2

  function chooseVehicle(id) {
    setVehicle(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  }

  // --- Bilan réel : trajets conduits + trajets rejoints -------------------
  useEffect(() => {
    let active = true
    Promise.all([
      supabase
        .from('rides')
        .select('id, time, distance_m, reservations(count)')
        .eq('driver_id', userId),
      supabase
        .from('reservations')
        .select('id, rides (id, time, distance_m, reservations(count))')
        .eq('user_id', userId),
    ]).then(([driven, booked]) => {
      if (!active) return
      if (driven.error || booked.error) {
        setError((driven.error ?? booked.error).message)
        setRides([])
        return
      }
      const normalize = (r) => ({
        id: r.id,
        time: r.time,
        distance_m: r.distance_m,
        passengers: r.reservations?.[0]?.count ?? 0,
      })
      setRides([
        ...(driven.data ?? []).map(normalize),
        ...(booked.data ?? []).map((row) => row.rides).filter(Boolean).map(normalize),
      ])
    })
    return () => {
      active = false
    }
  }, [userId])

  const stats = useMemo(() => {
    const now = new Date()
    const out = { done: 0, planned: 0, km: 0, count: 0, unknown: 0 }
    for (const ride of rides ?? []) {
      if (!ride.distance_m) {
        out.unknown += 1
        continue
      }
      const km = ride.distance_m / 1000
      const saved = tripSavings({ distanceKm: km, factor, passengers: ride.passengers }).savedPerPerson
      if (new Date(ride.time) < now) {
        out.done += saved
        out.km += km
        out.count += 1
      } else {
        out.planned += saved
      }
    }
    return out
  }, [rides, factor])

  // --- Simulateur ---------------------------------------------------------
  const simResult = useMemo(() => {
    const km = Math.max(0, Number(sim.distance) || 0)
    const passengers = Math.max(1, Number(sim.people) - 1)
    const trip = tripSavings({ distanceKm: km, factor, passengers })
    const trips = Math.max(0, Number(sim.perWeek) || 0) * Math.max(0, Number(sim.weeks) || 0) * (sim.roundTrip ? 2 : 1)
    return {
      ...trip,
      trips,
      share: 1 / (passengers + 1),
      perWeek: trip.savedPerPerson * (Number(sim.perWeek) || 0) * (sim.roundTrip ? 2 : 1),
      period: trip.savedPerPerson * trips,
    }
  }, [sim, factor])

  const setSimField = (key) => (e) => setSim((s) => ({ ...s, [key]: e.target.value }))

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      <h1 className="text-2xl font-semibold">CO₂ économisé</h1>
      <p className="text-pine-700 mt-1 text-sm">
        Chaque voiture partagée, c’est des trajets en solo en moins.
      </p>

      <section className="mt-5">
        <h2 className="text-pine-700 mb-2 text-sm">Type de véhicule utilisé pour le calcul</h2>
        <div className="flex flex-wrap gap-2">
          {VEHICLES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => chooseVehicle(v.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                vehicle === v.id
                  ? 'bg-pine-900 border-pine-900 text-white'
                  : 'border-pine-100 text-pine-700 bg-white'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-pine-900 mt-5 rounded-2xl p-5 text-white">
        <p className="flex items-center gap-2 text-sm opacity-80">
          <Leaf size={16} /> Mon bilan
        </p>
        {rides === null ? (
          <p className="mt-3 text-sm">Chargement…</p>
        ) : (
          <>
            <p className="mt-2 text-4xl font-semibold">{formatKg(stats.done)}</p>
            <p className="mt-1 text-sm opacity-80">
              de CO₂ évités sur {stats.count} trajet{stats.count > 1 ? 's' : ''} réalisé
              {stats.count > 1 ? 's' : ''} ({new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(stats.km)} km)
            </p>
            {stats.done > 0 && (
              <p className="mt-3 flex items-center gap-2 text-sm">
                <TreePine size={16} /> ≈ {treesLabel(stats.done)} pendant un an
              </p>
            )}
            {stats.planned > 0 && (
              <p className="mt-3 text-sm opacity-80">
                + {formatKg(stats.planned)} prévus sur vos trajets à venir
              </p>
            )}
          </>
        )}
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {stats.unknown > 0 && (
        <p className="text-pine-500 mt-2 text-xs">
          {stats.unknown} trajet{stats.unknown > 1 ? 's' : ''} ancien{stats.unknown > 1 ? 's' : ''} sans
          distance enregistrée n’{stats.unknown > 1 ? 'ont' : 'a'} pas été compté{stats.unknown > 1 ? 's' : ''}.
        </p>
      )}

      <section className="border-pine-100 mt-6 rounded-2xl border bg-white p-4">
        <h2 className="font-medium">Simulateur</h2>
        <p className="text-pine-700 mt-1 text-sm">Combien économiseriez-vous en covoiturant régulièrement ?</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-pine-700 mb-1 block text-xs">Distance (km)</span>
            <input type="number" inputMode="decimal" min="0" value={sim.distance} onChange={setSimField('distance')} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-pine-700 mb-1 block text-xs">Personnes dans la voiture</span>
            <select value={sim.people} onChange={setSimField('people')} className={inputClass}>
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} (dont le conducteur)
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-pine-700 mb-1 block text-xs">Trajets par semaine</span>
            <input type="number" inputMode="numeric" min="0" max="14" value={sim.perWeek} onChange={setSimField('perWeek')} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-pine-700 mb-1 block text-xs">Nombre de semaines</span>
            <input type="number" inputMode="numeric" min="0" max="52" value={sim.weeks} onChange={setSimField('weeks')} className={inputClass} />
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sim.roundTrip}
            onChange={(e) => setSim((s) => ({ ...s, roundTrip: e.target.checked }))}
            className="accent-pine-500 h-4 w-4"
          />
          Compter l’aller-retour
        </label>

        <div className="mt-5 space-y-2">
          <div>
            <div className="flex justify-between text-xs">
              <span className="text-pine-700">Seul en voiture</span>
              <span>{formatKg(simResult.carTotal)} / trajet</span>
            </div>
            <div className="bg-pine-100 mt-1 h-2.5 rounded-full">
              <div className="bg-pine-700 h-full w-full rounded-full" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs">
              <span className="text-pine-700">En covoiturant</span>
              <span>{formatKg(simResult.perPerson)} / trajet</span>
            </div>
            <div className="bg-pine-100 mt-1 h-2.5 rounded-full">
              <div className="bg-pine-500 h-full rounded-full" style={{ width: `${simResult.share * 100}%` }} />
            </div>
          </div>
        </div>

        <dl className="border-pine-100 divide-pine-100 mt-5 divide-y rounded-xl border px-3 text-sm">
          <div className="flex justify-between py-2.5">
            <dt className="text-pine-700">Économisé par trajet</dt>
            <dd className="font-medium">{formatKg(simResult.savedPerPerson)}</dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-pine-700">Par semaine</dt>
            <dd className="font-medium">{formatKg(simResult.perWeek)}</dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-pine-700">Sur {sim.weeks || 0} semaines</dt>
            <dd className="text-pine-500 font-semibold">{formatKg(simResult.period)}</dd>
          </div>
        </dl>
        {simResult.period > 0 && (
          <p className="text-pine-700 mt-3 flex items-center gap-2 text-sm">
            <TreePine size={16} className="text-pine-500" /> ≈ {treesLabel(simResult.period)} pendant un an
          </p>
        )}
      </section>

      <p className="text-pine-500 mt-4 text-xs">
        Estimations : {String(factor).replace('.', ',')} kg de CO₂ par km pour une voiture {VEHICLES.find((v) => v.id === vehicle)?.label.toLowerCase()}.
        Le CO₂ économisé par personne correspond à la part des émissions d’un trajet en solo
        qui n’est pas émise grâce au partage de la voiture. Un arbre absorbe environ {TREE_KG_PER_YEAR} kg de CO₂ par an.
      </p>
    </main>
  )
}
