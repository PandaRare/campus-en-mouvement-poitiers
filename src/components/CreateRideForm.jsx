// src/components/CreateRideForm.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { POITIERS_HUBS } from '../constants/poitiersHubs';

const DAYS = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mer' },
  { id: 4, label: 'Jeu' },
  { id: 5, label: 'Ven' },
  { id: 6, label: 'Sam' }
];

export default function CreateRideForm({ userId, onSuccess }) {
  const [depHubId, setDepHubId] = useState(POITIERS_HUBS[0].id);
  const [arrHubId, setArrHubId] = useState(POITIERS_HUBS[3].id);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('07:45');
  const [seats, setSeats] = useState(3);
  
  // État pour la récurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  const [loading, setLoading] = useState(false);

  const toggleDay = (dayId) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const depHub = POITIERS_HUBS.find((h) => h.id === depHubId);
    const arrHub = POITIERS_HUBS.find((h) => h.id === arrHubId);

    try {
      if (isRecurring) {
        const { data: count, error } = await supabase.rpc('create_recurring_rides', {
          p_driver_id: userId,
          p_departure: depHub.name,
          p_arrival: arrHub.name,
          p_departure_hub_id: depHub.id,
          p_arrival_hub_id: arrHub.id,
          p_dep_lat: depHub.lat,
          p_dep_lng: depHub.lng,
          p_arr_lat: arrHub.lat,
          p_arr_lng: arrHub.lng,
          p_start_date: date,
          p_end_date: endDate,
          p_time: time,
          p_days_of_week: selectedDays,
          p_seats: Number(seats),
          p_price: 0
        });
        if (error) throw error;
        alert(`${count} trajets récurrents ont été publiés !`);
      } else {
        const departureTimestamp = new Date(`${date}T${time}`).toISOString();
        const { error } = await supabase.from('rides').insert({
          driver_id: userId,
          departure: depHub.name,
          arrival: arrHub.name,
          departure_hub_id: depHub.id,
          arrival_hub_id: arrHub.id,
          departure_lat: depHub.lat,
          departure_lng: depHub.lng,
          arrival_lat: arrHub.lat,
          arrival_lng: arrHub.lng,
          departure_time: departureTimestamp,
          available_seats: Number(seats)
        });
        if (error) throw error;
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Hub de départ</label>
        <select
          value={depHubId}
          onChange={(e) => setDepHubId(e.target.value)}
          className="w-full rounded-lg border-slate-300 p-2.5 text-sm bg-slate-50"
        >
          {POITIERS_HUBS.map((hub) => (
            <option key={hub.id} value={hub.id}>{hub.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Hub d'arrivée</label>
        <select
          value={arrHubId}
          onChange={(e) => setArrHubId(e.target.value)}
          className="w-full rounded-lg border-slate-300 p-2.5 text-sm bg-slate-50"
        >
          {POITIERS_HUBS.map((hub) => (
            <option key={hub.id} value={hub.id}>{hub.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {isRecurring ? 'Date de début' : 'Date du trajet'}
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border-slate-300 p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Heure de départ</label>
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-lg border-slate-300 p-2 text-sm"
          />
        </div>
      </div>

      {/* Activation de la récurrence (Emploi du temps) */}
      <div className="pt-2 border-t border-slate-100">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="rounded text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-slate-800">
            Répéter selon mon emploi du temps hebdomadaire
          </span>
        </label>

        {isRecurring && (
          <div className="mt-3 p-3 bg-emerald-50/60 rounded-lg space-y-3 border border-emerald-100">
            <div>
              <span className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                Jours de récurrence
              </span>
              <div className="flex gap-1.5">
                {DAYS.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => toggleDay(d.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                      selectedDays.includes(d.id)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Répéter jusqu'au
              </label>
              <input
                type="date"
                required={isRecurring}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border-slate-300 p-2 text-sm bg-white"
              />
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition"
      >
        {loading ? 'Publication en cours...' : isRecurring ? 'Générer les trajets récurrents' : 'Publier le trajet'}
      </button>
    </form>
  );
}
