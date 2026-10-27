// src/hooks/useCachedRides.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useCachedRides() {
  const [rides, setRides] = useState(() => {
    const cached = localStorage.getItem('cached_rides');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(!rides.length);

  useEffect(() => {
    async function fetchRides() {
      try {
        const { data, error } = await supabase
          .from('rides')
          .select('*, driver:profiles!driver_id(full_name, reliability_score)')
          .gt('available_seats', 0)
          .gte('departure_time', new Date().toISOString())
          .order('departure_time', { ascending: true });

        if (error) throw error;
        if (data) {
          setRides(data);
          localStorage.setItem('cached_rides', JSON.stringify(data));
        }
      } catch (err) {
        console.warn('Mode hors-ligne : utilisation du cache local.', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRides();
  }, []);

  return { rides, loading };
}
