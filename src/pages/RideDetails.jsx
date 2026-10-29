import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Users, Clock, MapPin, Send, LogOut, Flag, Leaf, Repeat } from 'lucide-react'
import AttendancePanel from '../components/AttendancePanel'
import OfflineNotice from '../components/OfflineNotice'
import { ReliabilityBadge } from '../components/ReliabilityBadge'
import RidesMap from '../components/RidesMap'
import { formatDistance, hasRoute } from '../lib/geo'
import { DEFAULT_VEHICLE, VEHICLES, formatKg, tripSavings } from '../lib/co2'
import {
  useCancelRide,
  useCancelSeries,
  useJoinRide,
  useLeaveRide,
  useMessages,
  useProfile,
  useReservations,
  useRide,
  useSendMessage,
} from '../lib/queries'

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

const CONFIRM_WINDOW_MS = 7 * 24 * 3600 * 1000 // identique à la limite côté SQL

export default function RideDetails({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const userId = session.user.id
  const bottomRef = useRef(null)

  const rideQuery = useRide(id)
  const reservationsQuery = useReservations(id)
  const ride = rideQuery.data
  const reservations = reservationsQuery.data ?? []

  const isDriver = ride?.driver_id === userId
  const myReservation = reservations.find((r) => r.user_id === userId)
  const isMember = Boolean(isDriver || myReservation)

  const messagesQuery = useMessages(id, isMember)
  const messages = messagesQuery.data ?? []
  const driverQuery = useProfile(ride?.driver_id)
  const driverProfile = driverQuery.data

  const joinRide = useJoinRide()
  const leaveRide = useLeaveRide()
  const cancelRide = useCancelRide()
  const cancelSeries = useCancelSeries()
  const sendMessage = useSendMessage(id)

  const [draft, setDraft] = useState('')

  // Défilement automatique du chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  const busy =
    joinRide.isPending || leaveRide.isPending || cancelRide.isPending || cancelSeries.isPending
  const actionError =
    joinRide.error ??
    leaveRide.error ??
    cancelRide.error ??
    cancelSeries.error ??
    sendMessage.error ??
    rideQuery.error ??
    null

  async function handleCancelRide() {
    await cancelRide.mutateAsync(id)
    navigate('/mes-trajets', { replace: true })
  }

  async function handleCancelSeries() {
    if (!window.confirm('Annuler tous les trajets à venir de cette série ?')) return
    await cancelSeries.mutateAsync(id)
    navigate('/mes-trajets', { replace: true })
  }

  function handleSend(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    sendMessage.mutate({ userId, text }, { onError: () => setDraft(text) })
  }

  function authorLabel(message) {
    if (message.user_id === userId) return 'Vous'
    if (message.user_id === ride?.driver_id) return 'Conducteur'
    return `Passager ${message.user_id.slice(0, 4)}`
  }

  if (rideQuery.isPending) {
    return <p className="text-pine-700 p-8 text-sm">Chargement du trajet…</p>
  }

  if (!ride) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
        <button onClick={() => navigate('/trajets')} className="text-pine-700 mb-6 flex items-center gap-2 text-sm">
          <ArrowLeft size={18} /> Retour
        </button>
        <OfflineNotice />
        <p className="border-pine-100 text-pine-700 rounded-2xl border border-dashed p-6 text-center text-sm">
          Ce trajet n'existe plus ou a été annulé.
        </p>
      </main>
    )
  }

  const departure = new Date(ride.time)
  const isPast = departure < new Date()
  const canConfirm = isMember && isPast && new Date().getTime() - departure.getTime() < CONFIRM_WINDOW_MS

  // Estimation du CO₂ économisé par personne (véhicule moyen « essence » par défaut)
  const factor = VEHICLES.find((v) => v.id === DEFAULT_VEHICLE).factor
  const passengersForEstimate = reservations.length + (isMember ? 0 : 1)
  const ecoSaving =
    ride.distance_m && passengersForEstimate > 0
      ? tripSavings({
          distanceKm: ride.distance_m / 1000,
          factor,
          passengers: passengersForEstimate,
        }).savedPerPerson
      : null

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      <button
        onClick={() => navigate(-1)}
        className="text-pine-700 mb-5 flex items-center gap-2 text-sm"
      >
        <ArrowLeft size={18} /> Retour
      </button>

      <OfflineNotice />

      <section className="border-pine-100 rounded-2xl border bg-white p-5">
        <h1 className="text-xl leading-snug font-semibold">
          {ride.origin} → {ride.destination}
        </h1>

        <ul className="text-pine-700 mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Clock size={16} className="text-pine-500" />
            {dateFormat.format(departure)}
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
          {ride.meeting_label && (
            <li className="flex items-start gap-2">
              <Flag size={16} className="text-pine-500 mt-0.5 shrink-0" />
              Rendez-vous : {ride.meeting_label}
            </li>
          )}
          {ride.recurrence_group_id && (
            <li className="flex items-center gap-2">
              <Repeat size={16} className="text-pine-500" />
              Trajet hebdomadaire
            </li>
          )}
          {ecoSaving && (
            <li className="flex items-start gap-2">
              <Leaf size={16} className="text-pine-500 mt-0.5 shrink-0" />
              <span>
                {formatDistance(ride.distance_m)} · ≈ {formatKg(ecoSaving)} de CO₂ économisés
                {isMember ? ' par personne' : ' si vous rejoignez ce trajet'}
              </span>
            </li>
          )}
        </ul>

        {hasRoute(ride) && (
          <div className="mt-4 overflow-hidden rounded-2xl">
            <RidesMap rides={[ride]} selectedId={ride.id} height={220} />
          </div>
        )}

        <div className="mt-4 space-y-2">
          <p className="text-pine-500 text-xs">
            {isDriver
              ? 'Vous êtes le conducteur'
              : `Conducteur : ${
                  [driverProfile?.full_name, driverProfile?.study].filter(Boolean).join(' · ') ||
                  ride.driver_id.slice(0, 4)
                }`}
          </p>
          {driverQuery.isSuccess && (
            <ReliabilityBadge
              score={driverProfile?.reliability_score ?? 100}
              totalRides={driverProfile?.total_scheduled_rides ?? 0}
            />
          )}
        </div>

        <div className="mt-5 space-y-3">
          {isPast ? (
            <p className="bg-pine-100 rounded-xl px-4 py-3 text-sm">Ce trajet est terminé.</p>
          ) : isDriver ? (
            <>
              <button
                onClick={handleCancelRide}
                disabled={busy}
                className="border-pine-100 w-full rounded-xl border py-3.5 font-medium disabled:opacity-50"
              >
                {cancelRide.isPending ? 'Annulation…' : 'Annuler ce trajet'}
              </button>
              {ride.recurrence_group_id && (
                <button
                  onClick={handleCancelSeries}
                  disabled={busy}
                  className="w-full rounded-xl border border-red-200 py-3.5 font-medium text-red-800 disabled:opacity-50"
                >
                  {cancelSeries.isPending ? 'Annulation…' : 'Annuler toute la série à venir'}
                </button>
              )}
            </>
          ) : myReservation ? (
            <button
              onClick={() => leaveRide.mutate(id)}
              disabled={busy}
              className="border-pine-100 flex w-full items-center justify-center gap-2 rounded-xl border py-3.5 font-medium disabled:opacity-50"
            >
              <LogOut size={18} />
              {leaveRide.isPending ? 'Annulation…' : 'Quitter ce trajet'}
            </button>
          ) : (
            <button
              onClick={() => joinRide.mutate(id)}
              disabled={busy || ride.seats < 1}
              className="bg-pine-900 w-full rounded-xl py-3.5 font-medium text-white disabled:opacity-50"
            >
              {ride.seats < 1
                ? 'Complet'
                : joinRide.isPending
                  ? 'Réservation…'
                  : 'Rejoindre ce trajet'}
            </button>
          )}
        </div>
      </section>

      {actionError && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError.message}
        </p>
      )}

      {canConfirm && <AttendancePanel ride={ride} isDriver={isDriver} reservations={reservations} />}

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

            <form onSubmit={handleSend} className="mt-3 flex gap-2">
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
