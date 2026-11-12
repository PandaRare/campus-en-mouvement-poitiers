// Notifications Web Push : abonnement de l'appareil et enregistrement côté Supabase.
// L'envoi lui-même est fait par l'Edge Function `send-push` (voir supabase/functions/send-push).
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// Mémorise (sur cet appareil) qui a activé les notifications : au prochain démarrage ou après une
// reconnexion de la MÊME personne, l'abonnement est renouvelé sans rien redemander.
const PREF_KEY = 'cem-push-user'
const readPref = () => {
  try {
    return localStorage.getItem(PREF_KEY)
  } catch {
    return null
  }
}
const writePref = (userId) => {
  try {
    if (userId) localStorage.setItem(PREF_KEY, userId)
    else localStorage.removeItem(PREF_KEY)
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}

export const pushConfigured = Boolean(VAPID_PUBLIC_KEY)

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// La clé VAPID publique est en base64url ; l'API Push veut un Uint8Array
function urlBase64ToUint8Array(base64) {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// 'unsupported' | 'unconfigured' | 'denied' | 'subscribed' | 'idle'
export async function getPushState() {
  if (!pushSupported()) return 'unsupported'
  if (!pushConfigured) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? 'subscribed' : 'idle'
  } catch {
    return 'idle'
  }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('Les notifications ne sont pas disponibles sur cet appareil.')
  if (!pushConfigured) throw new Error('Notifications non configurées (clé VAPID manquante).')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications refusées. Autorisez-les dans les réglages du navigateur.')
  }

  const reg = await navigator.serviceWorker.ready
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const json = subscription.toJSON()
  const { data: auth } = await supabase.auth.getSession()
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth_key: json.keys.auth,
    p_user_agent: navigator.userAgent.slice(0, 200),
  })
  if (error) throw error
  writePref(auth.session?.user.id ?? null)
}

// Retire l'abonnement de cet appareil (côté serveur puis côté navigateur).
//   forget: false → à la déconnexion : l'appareil ne reçoit plus rien pour ce compte, mais la
//                   préférence est gardée pour se réabonner à la reconnexion de la même personne.
export async function disablePush({ forget = true } = {}) {
  if (forget) writePref(null)
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const subscription = await reg?.pushManager.getSubscription()
  if (!subscription) return
  const { endpoint } = subscription
  // Suppression côté serveur d'abord (il faut encore être connecté), puis côté navigateur
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  await subscription.unsubscribe()
}

// Au démarrage / à la connexion : renouvelle l'abonnement si cette personne l'avait activé sur
// cet appareil (clé de chiffrement renouvelée par le navigateur, reconnexion après déconnexion…).
export async function syncPush(userId) {
  if (!userId || !pushSupported() || !pushConfigured) return
  if (Notification.permission !== 'granted' || readPref() !== userId) return
  try {
    await enablePush()
  } catch {
    /* hors-ligne ou service worker pas prêt : réessayé au prochain démarrage */
  }
}

// Crée une notification pour soi-même : toute la chaîne (base → webhook → fonction → appareil) est testée
export async function sendTestNotification() {
  const { error } = await supabase.rpc('send_test_notification')
  if (error) throw error
}
