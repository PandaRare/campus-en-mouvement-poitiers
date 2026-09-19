import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Users, Clock, MapPin, Send, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

export default function RideDetails({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const userId = session.user.id
  const bottomRef = useRef(null)

  const [ride, setRide] = useState(null)
  const [reservations, setReservations] = useState([])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const isDriver = ride?.driver_id === userId
  const myReservation = reservations.find((r) => r.user_id === userId)
  const isMember = Boolean(isDriver || myReservation)

  const loadRide = useCallback(async () => {
    const { data, error } = await supabase.from('rides').select('*').eq('id', id).maybeSingle()
    if (error) setError(error.message)
    else setRide(data)
  }, [id])

  const loadReservations = useCallback(async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('ride_id', id)
      .order('created_at', { ascending: true })
    if (!error) setReservations(data ?? [])
  }, [id])

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('ride_id', id)
      .order('timestamp', { ascending: true })
    if (!error) setMessages(data ?? [])
  }, [id])

  // Chargement initial
  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([loadRide(), loadReservations(), loadMessages()]).then(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [loadRide, loadReservations, loadMessages])

  // Temps réel : trajet, réservations et messages
  useEffect(() => {
    const channel = supabase
      .channel(`ride-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `id=eq.${id}` },
        loadRide,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `ride_id=eq.${id}` },
        loadReservations,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `ride_id=eq.${id}` },
        (payload) =>
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new],
          ),
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id, loadRide, loadReservations])

  // Défilement automatique du chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  async function joinRide() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('join_ride', { p_ride_id: id })
    if (error) setError(error.message)
    else await Promise.all([loadRide(), loadReservations(), loadMessages()])
    setBusy(false)
  }

  async function leaveRide() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('leave_ride', { p_ride_id: id })
    if (error) {
      setError(error.message)
    } else {
      setMessages([])
      await Promise.all([loadRide(), loadReservations()])
    }
    setBusy(false)
  }

  async function cancelRide() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('rides').delete().eq('id', id)
    if (error) {
      setError(error.message)
      setBusy(false)
    } else {
      navigate('/mes-trajets', { replace: true })
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return

    setDraft('')
    const { error } = await supabase
      .from('messages')
      .insert({ ride_id: id, user_id: userId, text })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setDraft(text)
    }
  }

  function authorLabel(message) {
    if (message.user_id === userId) return 'Vous'
    if (message.user_id === ride?.driver_id) return 'Conducteur'
    return `Passager ${message.user_id.slice(0, 4)}`
  }

  if (loading) {
    return <p className="text-pine-700 p-8 text-sm">Chargement du trajet…</p>
  }

  if (!ride) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
        <button onClick={() => navigate('/trajets')} className="text-pine-700 mb-6 flex items-center gap-2 text-sm">
          <ArrowLeft size={18} /> Retour
        </button>
        <p className="border-pine-100 text-pine-700 rounded-2xl border border-dashed p-6 text-center text-sm">
          Ce trajet n'existe plus ou a été annulé.
        </p>
      </main>
    )
  }

  const isPast = new Date(ride.time) < new Date()

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      <button
        onClick={() => navigate(-1)}
        className="text-pine-700 mb-5 flex items-center gap-2 text-sm"
      >
        <ArrowLeft size={18} /> Retour
      </button>

      <section className="border-pine-100 rounded-2xl border bg-white p-5">
        <h1 className="text-xl leading-snug font-semibold">
          {ride.origin} → {ride.destination}
        </h1>

        <ul className="text-pine-700 mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Clock size={16} className="text-pine-500" />
            {dateFormat.format(new Date(ride.time))}
          </li>
          <li className="flex items-center gap-2">
            <MapPin size={16} className="text-pine-500" />
            Départ : {ride.origin}
          </li>
          <li className="flex items-center gap-2">
            <Users size={16} className="text-pine-500" />
            {ride.seats} place{ride.seats > 1 ? 's' : ''} restante
            {ride.seats > 1 ? 's' : ''}
            {isDriver && ` · ${reservations.length} passager${reservations.length > 1 ? 's' : ''}`}
          </li>
        </ul>

        <p className="text-pine-500 mt-4 text-xs">
          {isDriver ? 'Vous êtes le conducteur' : `Conducteur ${ride.driver_id.slice(0, 4)}`}
        </p>

        <div className="mt-5">
          {isPast ? (
            <p className="bg-pine-100 rounded-xl px-4 py-3 text-sm">Ce trajet est terminé.</p>
          ) : isDriver ? (
            <button
              onClick={cancelRide}
              disabled={busy}
              className="border-pine-100 w-full rounded-xl border py-3.5 font-medium disabled:opacity-50"
            >
              {busy ? 'Annulation…' : 'Annuler ce trajet'}
            </button>
          ) : myReservation ? (
            <button
              onClick={leaveRide}
              disabled={busy}
              className="border-pine-100 flex w-full items-center justify-center gap-2 rounded-xl border py-3.5 font-medium disabled:opacity-50"
            >
              <LogOut size={18} />
              {busy ? 'Annulation…' : 'Quitter ce trajet'}
            </button>
          ) : (
            <button
              onClick={joinRide}
              disabled={busy || ride.seats < 1}
              className="bg-pine-900 w-full rounded-xl py-3.5 font-medium text-white disabled:opacity-50"
            >
              {ride.seats < 1
                ? 'Complet'
                : busy
                  ? 'Réservation…'
                  : 'Rejoindre ce trajet'}
            </button>
          )}
        </div>
      </section>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <section className="mt-6">
        <h2 className="mb-3 font-medium">Discussion</h2>

        {!isMember ? (
          <p className="border-pine-100 text-pine-700 rounded-2xl border border-dashed p-6 text-center text-sm">
            Rejoignez le trajet pour discuter avec le conducteur et les passagers.
          </p>
        ) : (
          <>
            <div className="border-pine-100 max-h-80 space-y-3 overflow-y-auto rounded-2xl border bg-white p-4">
              {messages.length === 0 && (
                <p className="text-pine-700 text-center text-sm">
                  Aucun message. Lancez la conversation : point de rendez-vous, bagages, partage des frais.
                </p>
              )}

              {messages.map((message) => {
                const mine = message.user_id === userId
                return (
                  <div key={message.id} className={mine ? 'text-right' : 'text-left'}>
                    <p className="text-pine-500 mb-1 text-[11px]">
                      {authorLabel(message)} · {timeFormat.format(new Date(message.timestamp))}
                    </p>
                    <p
                      className={`inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-left text-sm ${
                        mine ? 'bg-pine-900 text-white' : 'bg-pine-100 text-pine-900'
                      }`}
                    >
                      {message.text}
                    </p>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={1000}
                placeholder="Votre message"
                className="border-pine-100 focus:border-pine-500 w-full rounded-xl border bg-white px-4 py-3 outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Envoyer le message"
                className="bg-pine-900 shrink-0 rounded-xl px-4 text-white disabled:opacity-40"
              >
                <Send size={18} />
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
