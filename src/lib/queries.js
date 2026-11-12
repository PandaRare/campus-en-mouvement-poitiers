// Toutes les requêtes Supabase de l'application, en hooks TanStack Query.
// Les pages ne parlent plus directement à Supabase : elles utilisent ces hooks.
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

// ------------------------------------------------------------
// Clés de cache
// ------------------------------------------------------------
export const keys = {
  rides: ['rides'],
  ride: (id) => ['ride', id],
  reservations: (rideId) => ['reservations', rideId],
  messages: (rideId) => ['messages', rideId],
  myRides: (userId) => ['my-rides', userId],
  profile: (userId) => ['profile', userId],
  profiles: (ids) => ['profiles', ...ids],
  attendance: (rideId) => ['attendance', rideId],
  ratings: (rideId) => ['ratings', rideId],
  notifications: ['notifications'],
  ridePassengers: (rideId) => ['ride-passengers', rideId],
}

// Lève l'erreur Supabase (si besoin) et renvoie les données
function unwrap({ data, error }) {
  if (error) throw error
  return data
}

const byTime = (a, b) => new Date(a.time) - new Date(b.time)

// ------------------------------------------------------------
// Lectures
// ------------------------------------------------------------

// ⚠️ L'URL de cette requête doit rester identique d'un appel à l'autre : le cache hors-ligne
// (Workbox) l'utilise comme clé. On filtre donc sur le DÉBUT de la journée (stable), puis on
// retire côté client les trajets déjà partis.
function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const onlyUpcoming = (rows) => {
  const now = Date.now()
  return rows.filter((ride) => new Date(ride.time).getTime() >= now)
}

export function useUpcomingRides() {
  return useQuery({
    queryKey: keys.rides,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('rides')
          .select('*')
          .gte('time', startOfToday())
          .order('time', { ascending: true }),
      ) ?? [],
    select: onlyUpcoming,
  })
}

export function useRide(id) {
  return useQuery({
    queryKey: keys.ride(id),
    queryFn: async () => unwrap(await supabase.from('rides').select('*').eq('id', id).maybeSingle()),
  })
}

export function useReservations(rideId) {
  return useQuery({
    queryKey: keys.reservations(rideId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('reservations')
          .select('*')
          .eq('ride_id', rideId)
          .order('created_at', { ascending: true }),
      ) ?? [],
  })
}

// `enabled` : le chat n'est lisible que par les membres du trajet (RLS)
export function useMessages(rideId, enabled) {
  return useQuery({
    queryKey: keys.messages(rideId),
    enabled,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('messages')
          .select('*')
          .eq('ride_id', rideId)
          .order('timestamp', { ascending: true }),
      ) ?? [],
  })
}

export function useMyRides(userId) {
  return useQuery({
    queryKey: keys.myRides(userId),
    queryFn: async () => {
      const [driven, booked] = await Promise.all([
        supabase
          .from('rides')
          .select('*')
          .eq('driver_id', userId)
          .order('time', { ascending: true }),
        supabase
          .from('reservations')
          .select('id, created_at, rides (*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
      ])
      if (driven.error) throw driven.error
      if (booked.error) throw booked.error
      return {
        driving: driven.data ?? [],
        joined: (booked.data ?? []).map((row) => row.rides).filter(Boolean).sort(byTime),
      }
    },
  })
}

// Données de la page CO₂ : trajets conduits + trajets rejoints, avec le nombre de passagers
export function useCo2Rides(userId) {
  return useQuery({
    queryKey: ['co2', userId],
    queryFn: async () => {
      const [driven, booked] = await Promise.all([
        supabase
          .from('rides')
          .select('id, time, distance_m, reservations(count)')
          .eq('driver_id', userId),
        supabase
          .from('reservations')
          .select('id, rides (id, time, distance_m, reservations(count))')
          .eq('user_id', userId),
      ])
      if (driven.error) throw driven.error
      if (booked.error) throw booked.error

      const normalize = (r) => ({
        id: r.id,
        time: r.time,
        distance_m: r.distance_m,
        passengers: r.reservations?.[0]?.count ?? 0,
      })
      return [
        ...(driven.data ?? []).map(normalize),
        ...(booked.data ?? []).map((row) => row.rides).filter(Boolean).map(normalize),
      ]
    },
  })
}

const PROFILE_COLUMNS =
  'id, full_name, study, level, discipline, gender, rating_avg, rating_count, completed_rides_count, total_scheduled_rides, reliability_score'

export function useProfile(userId) {
  return useQuery({
    queryKey: keys.profile(userId),
    enabled: Boolean(userId),
    queryFn: async () =>
      unwrap(await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle()),
  })
}

// Profils de plusieurs personnes (ex. les passagers d'un trajet)
export function useProfiles(ids) {
  const sorted = [...ids].sort() // ordre stable = même URL = même entrée de cache
  return useQuery({
    queryKey: keys.profiles(sorted),
    enabled: sorted.length > 0,
    queryFn: async () =>
      unwrap(await supabase.from('profiles').select('id, full_name, study, level, discipline, gender, rating_avg, rating_count').in('id', sorted)) ?? [],
  })
}

// Mes propres signalements de présence sur un trajet (la RLS ne renvoie que les miens)
export function useMyAttendance(rideId, enabled) {
  return useQuery({
    queryKey: keys.attendance(rideId),
    enabled,
    queryFn: async () =>
      unwrap(
        await supabase.from('ride_attendance').select('user_id, attended').eq('ride_id', rideId),
      ) ?? [],
  })
}

// Boîte de notifications (la RLS ne renvoie que les miennes)
export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('notifications')
          .select('id, kind, title, body, url, read_at, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ) ?? [],
  })
}

// Passagers d'un trajet, visibles par les membres du trajet uniquement (fonction SQL ride_passengers)
export function useRidePassengers(rideId, enabled) {
  return useQuery({
    queryKey: keys.ridePassengers(rideId),
    enabled,
    queryFn: async () =>
      unwrap(await supabase.rpc('ride_passengers', { p_ride_id: rideId })) ?? [],
  })
}

// Mes propres notes données sur un trajet (la RLS ne renvoie que les miennes)
export function useMyRatings(rideId, enabled) {
  return useQuery({
    queryKey: keys.ratings(rideId),
    enabled,
    queryFn: async () =>
      unwrap(await supabase.from('ride_ratings').select('ratee_id, stars').eq('ride_id', rideId)) ??
      [],
  })
}

// ------------------------------------------------------------
// Écritures
// ------------------------------------------------------------
function refreshAfterRideChange(qc, rideId) {
  qc.invalidateQueries({ queryKey: keys.rides })
  qc.invalidateQueries({ queryKey: ['my-rides'] })
  qc.invalidateQueries({ queryKey: ['co2'] })
  if (rideId) {
    qc.invalidateQueries({ queryKey: keys.ride(rideId) })
    qc.invalidateQueries({ queryKey: keys.reservations(rideId) })
  }
}

export function useCreateRide() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ride) => unwrap(await supabase.from('rides').insert(ride)),
    onSuccess: () => refreshAfterRideChange(qc),
  })
}

// Renvoie le nombre de trajets créés
export function useCreateRecurringRides() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args) => unwrap(await supabase.rpc('create_recurring_rides', args)),
    onSuccess: () => refreshAfterRideChange(qc),
  })
}

export function useJoinRide() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rideId) => unwrap(await supabase.rpc('join_ride', { p_ride_id: rideId })),
    onSuccess: (_data, rideId) => {
      refreshAfterRideChange(qc, rideId)
      qc.invalidateQueries({ queryKey: keys.messages(rideId) }) // le chat devient lisible
    },
  })
}

export function useLeaveRide() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rideId) => unwrap(await supabase.rpc('leave_ride', { p_ride_id: rideId })),
    onSuccess: (_data, rideId) => {
      qc.removeQueries({ queryKey: keys.messages(rideId) }) // le chat redevient illisible
      refreshAfterRideChange(qc, rideId)
    },
  })
}

export function useCancelRide() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rideId) => {
      // .select() : la RLS supprime silencieusement 0 ligne si le trajet est déjà parti
      const rows = unwrap(await supabase.from('rides').delete().eq('id', rideId).select('id'))
      if (!rows?.length) throw new Error('Ce trajet ne peut plus être annulé.')
    },
    onSuccess: (_data, rideId) => {
      qc.removeQueries({ queryKey: keys.ride(rideId) })
      refreshAfterRideChange(qc)
    },
  })
}

// Annule toutes les occurrences à venir d'un trajet récurrent. Renvoie leur nombre.
export function useCancelSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rideId) =>
      unwrap(await supabase.rpc('cancel_ride_series', { p_ride_id: rideId })),
    onSuccess: () => refreshAfterRideChange(qc),
  })
}

export function useSendMessage(rideId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, text }) =>
      unwrap(
        await supabase
          .from('messages')
          .insert({ ride_id: rideId, user_id: userId, text })
          .select()
          .single(),
      ),
    onSuccess: (message) => appendMessage(qc, message),
  })
}

export function useReportAttendance(rideId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, attended }) =>
      unwrap(
        await supabase.rpc('report_attendance', {
          p_ride_id: rideId,
          p_user_id: userId,
          p_attended: attended,
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.attendance(rideId) })
      qc.invalidateQueries({ queryKey: ['profile'] }) // le score de la personne évaluée a changé
    },
  })
}

// ids = liste de notifications à marquer lues ; null = toutes les notifications non lues
export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids) => {
      let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
      if (ids) query = query.in('id', ids)
      return unwrap(await query)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  })
}

// Quand on ouvre un trajet, ses notifications (messages, passagers) sont lues d'office
export function useMarkRideNotificationsRead(rideId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .is('read_at', null)
          .eq('url', `/trajets/${rideId}`),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  })
}

export function useRateUser(rideId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, stars }) =>
      unwrap(await supabase.rpc('rate_user', { p_ride_id: rideId, p_user_id: userId, p_stars: stars })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.ratings(rideId) })
      qc.invalidateQueries({ queryKey: ['profile'] }) // la moyenne de la personne notée a changé
      qc.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

// Demande à la modération (table support_requests ; user_id est rempli par le serveur)
export function useSendSupportRequest() {
  return useMutation({
    mutationFn: async ({ category, message }) =>
      unwrap(await supabase.from('support_requests').insert({ category, message })),
  })
}

export function useSaveProfile(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ full_name, level, discipline, gender }) =>
      unwrap(
        await supabase.from('profiles').upsert({
          id: userId,
          full_name: full_name.trim() || null,
          level: level || null,
          discipline: discipline || null,
          // texte affiché partout (« L3 · Droit ») : reste compatible avec le reste de l'application
          study: [level, discipline].filter(Boolean).join(' · ') || null,
          gender: gender || 'non_precise',
          updated_at: new Date().toISOString(),
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.profile(userId) }),
  })
}

// ------------------------------------------------------------
// Temps réel : un seul canal pour toute l'application.
// Supabase n'envoie que les lignes que la RLS autorise l'utilisateur à lire.
// ------------------------------------------------------------
function appendMessage(qc, message) {
  qc.setQueryData(keys.messages(message.ride_id), (old) => {
    if (!old) return old // chat jamais ouvert : il se chargera tout seul
    return old.some((m) => m.id === message.id) ? old : [...old, message]
  })
}

export function useRealtimeSync(enabled) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel('app-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => {
        qc.invalidateQueries({ queryKey: keys.rides })
        qc.invalidateQueries({ queryKey: ['ride'] })
        qc.invalidateQueries({ queryKey: ['my-rides'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        qc.invalidateQueries({ queryKey: ['reservations'] })
        qc.invalidateQueries({ queryKey: ['ride-passengers'] })
        qc.invalidateQueries({ queryKey: ['my-rides'] })
        qc.invalidateQueries({ queryKey: ['ride'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () =>
        qc.invalidateQueries({ queryKey: keys.notifications }),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
        appendMessage(qc, payload.new),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, qc])
}
