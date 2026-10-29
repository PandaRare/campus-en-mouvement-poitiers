// Edge Function « send-push » : envoie une notification Web Push quand
//   · un message est posté dans le chat d'un trajet  (table messages, INSERT)
//   · un passager rejoint un trajet                  (table reservations, INSERT)
//   · un passager quitte un trajet                   (table reservations, DELETE)
//
// Elle est appelée par des Database Webhooks Supabase (voir docs/INTEGRATION_V3.md).
// Secrets requis : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEBHOOK_SECRET
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.)
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!, // ex. mailto:vous@etu.univ-poitiers.fr
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: Record<string, any> | null
  old_record: Record<string, any> | null
}

type Notification = { userIds: string[]; title: string; body: string; url: string; tag: string }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Comparaison en temps constant du secret partagé avec le webhook
function secretMatches(received: string | null): boolean {
  const expected = Deno.env.get('WEBHOOK_SECRET') ?? ''
  if (!received || !expected || received.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= received.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

const shorten = (text: string, max = 110) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

async function displayName(userId: string, fallback: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
  return data?.full_name || fallback
}

async function getRide(rideId: string) {
  const { data } = await supabase
    .from('rides')
    .select('id, driver_id, origin, destination')
    .eq('id', rideId)
    .maybeSingle()
  return data
}

// Décide qui prévenir, et avec quel texte
async function buildNotification(payload: WebhookPayload): Promise<Notification | null> {
  // ----- Nouveau message : tous les membres du trajet sauf l'auteur -----
  if (payload.table === 'messages' && payload.type === 'INSERT' && payload.record) {
    const { ride_id, user_id, text } = payload.record
    const ride = await getRide(ride_id)
    if (!ride) return null

    const { data: passengers } = await supabase.from('reservations').select('user_id').eq('ride_id', ride_id)
    const members = new Set<string>([ride.driver_id, ...(passengers ?? []).map((p) => p.user_id)])
    members.delete(user_id)

    const author = await displayName(
      user_id,
      user_id === ride.driver_id ? 'Le conducteur' : 'Un passager',
    )
    return {
      userIds: [...members],
      title: `${author} · ${ride.origin} → ${ride.destination}`,
      body: shorten(String(text)),
      url: `/trajets/${ride_id}`,
      tag: `ride-${ride_id}`, // les messages d'un même trajet se remplacent au lieu de s'empiler
    }
  }

  // ----- Passager qui rejoint / quitte : on prévient le conducteur -----
  if (payload.table === 'reservations' && (payload.type === 'INSERT' || payload.type === 'DELETE')) {
    const row = payload.type === 'INSERT' ? payload.record : payload.old_record
    if (!row) return null

    const ride = await getRide(row.ride_id)
    if (!ride) return null // trajet supprimé : les réservations partent avec lui (cascade)

    const passenger = await displayName(row.user_id, 'Un passager')
    const joined = payload.type === 'INSERT'
    return {
      userIds: [ride.driver_id],
      title: joined ? 'Nouveau passager' : 'Un passager a quitté votre trajet',
      body: `${passenger} ${joined ? 'a rejoint' : 'a quitté'} ${ride.origin} → ${ride.destination}`,
      url: `/trajets/${ride.id}`,
      tag: `ride-${ride.id}-passengers`,
    }
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!secretMatches(req.headers.get('x-webhook-secret'))) return json({ error: 'Unauthorized' }, 401)

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const notification = await buildNotification(payload)
  if (!notification || notification.userIds.length === 0) return json({ sent: 0 })

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .in('user_id', notification.userIds)

  if (error) return json({ error: error.message }, 500)

  const message = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url,
    tag: notification.tag,
  })

  let sent = 0
  const expired: string[] = []

  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          message,
          { TTL: 60 * 60 * 24 }, // un message non distribué sous 24 h est abandonné
        )
        sent++
      } catch (err) {
        // 404 / 410 : l'abonnement n'existe plus (appli désinstallée, permission retirée)
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) expired.push(sub.id)
        else console.error('Échec push', status, (err as Error).message)
      }
    }),
  )

  if (expired.length > 0) await supabase.from('push_subscriptions').delete().in('id', expired)

  return json({ sent, removed: expired.length })
})
