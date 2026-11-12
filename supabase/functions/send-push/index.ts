// Edge Function « send-push » : envoie la notification Web Push correspondant à une ligne
// ajoutée dans la table `notifications` (les déclencheurs SQL de supabase_migration_v8.sql
// créent ces lignes : nouveau message, passager qui rejoint ou part, trajet annulé, test).
//
// Elle est appelée par UN SEUL Database Webhook : table `notifications`, événement INSERT
// (voir docs/INTEGRATION_V8.md). Les anciens webhooks sur messages / reservations doivent être supprimés.
// Secrets requis : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEBHOOK_SECRET
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.)
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: {
    user_id: string
    title: string
    body: string
    url: string
    tag: string | null
  } | null
}

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

// La configuration VAPID est faite à chaque appel et ses erreurs sont renvoyées clairement
// (une erreur ici au démarrage de la fonction donnerait un « 500 » muet côté webhook).
function configureVapid(): string | null {
  const subject = Deno.env.get('VAPID_SUBJECT') ?? ''
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''

  if (!publicKey || !privateKey) return 'VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY manquant dans les secrets.'
  if (!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(subject)) {
    return 'VAPID_SUBJECT invalide : écrivez « mailto:votre@adresse.fr » (avec « mailto: »).'
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
  } catch (err) {
    return `Clés VAPID refusées : ${(err as Error).message}`
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

  // Les anciens webhooks (messages, reservations) peuvent encore exister : on les ignore
  if (payload.table !== 'notifications' || payload.type !== 'INSERT' || !payload.record) {
    return json({ skipped: true })
  }

  const vapidError = configureVapid()
  if (vapidError) {
    console.error(vapidError)
    return json({ error: vapidError }, 500)
  }

  const { user_id, title, body, url, tag } = payload.record

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('user_id', user_id)

  if (error) return json({ error: error.message }, 500)
  if (!subscriptions || subscriptions.length === 0) return json({ sent: 0, reason: 'no_subscription' })

  const message = JSON.stringify({ title, body, url, tag })

  let sent = 0
  const expired: string[] = []
  const failures: Array<{ status?: number; message: string }> = []

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          message,
          { TTL: 60 * 60 * 24, urgency: 'high' }, // abandonné après 24 h ; livré sans attendre
        )
        sent++
      } catch (err) {
        // 404 / 410 : l'abonnement n'existe plus (appli désinstallée, permission retirée)
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) expired.push(sub.id)
        else failures.push({ status, message: (err as Error).message })
      }
    }),
  )

  if (expired.length > 0) await supabase.from('push_subscriptions').delete().in('id', expired)
  for (const failure of failures) console.error('Échec push', failure.status, failure.message)

  return json({ sent, removed: expired.length, failed: failures.length })
})
