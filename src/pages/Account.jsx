import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PushToggle from '../components/PushToggle'
import { ReliabilityBadge } from '../components/ReliabilityBadge'
import { supabase } from '../lib/supabase'
import { useProfile, useSaveProfile } from '../lib/queries'

const inputClass =
  'border-pine-100 focus:border-pine-500 w-full rounded-xl border bg-white px-4 py-3 outline-none'

// Formulaire séparé : il (re)démarre avec le profil chargé, sans effet de synchronisation
function ProfileForm({ userId, profile }) {
  const save = useSaveProfile(userId)
  const [values, setValues] = useState({
    full_name: profile?.full_name ?? '',
    study: profile?.study ?? '',
  })
  const [saved, setSaved] = useState(false)

  function submit(e) {
    e.preventDefault()
    setSaved(false)
    save.mutate(values, { onSuccess: () => setSaved(true) })
  }

  return (
    <form onSubmit={submit} className="border-pine-100 mt-6 space-y-4 rounded-2xl border bg-white p-4">
      <h2 className="font-medium">Mon profil</h2>

      <label className="block">
        <span className="text-pine-700 mb-1 block text-sm">Prénom ou pseudo</span>
        <input
          value={values.full_name}
          onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))}
          maxLength={40}
          placeholder="Ex. Gaspard"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-pine-700 mb-1 block text-sm">Licence / formation</span>
        <input
          value={values.study}
          onChange={(e) => setValues((v) => ({ ...v, study: e.target.value }))}
          maxLength={80}
          placeholder="Ex. L3 Maths, M1 Droit, BTS…"
          className={inputClass}
        />
      </label>

      <p className="text-pine-500 text-xs">
        Ces informations sont visibles par les autres étudiants connectés (sur les trajets que
        vous conduisez).
      </p>

      {save.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{save.error.message}</p>
      )}
      {saved && !save.error && (
        <p className="bg-pine-100 text-pine-900 rounded-xl px-4 py-3 text-sm">Profil enregistré.</p>
      )}

      <button
        type="submit"
        disabled={save.isPending}
        className="bg-pine-900 w-full rounded-xl py-3.5 font-medium text-white disabled:opacity-50"
      >
        {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

export default function Account({ session }) {
  const navigate = useNavigate()
  const userId = session.user.id
  const [busy, setBusy] = useState(false)
  const profileQuery = useProfile(userId)
  const profile = profileQuery.data

  async function signOut() {
    setBusy(true)
    await supabase.auth.signOut() // le cache (mémoire + hors-ligne) est vidé dans App.jsx
    setBusy(false)
    navigate('/trajets', { replace: true })
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      <h1 className="text-2xl font-semibold">Mon compte</h1>
      <p className="text-pine-700 mt-1 text-sm">{session.user.email}</p>

      {profileQuery.isSuccess && (
        <div className="mt-3">
          <ReliabilityBadge
            score={profile?.reliability_score ?? 100}
            totalRides={profile?.total_scheduled_rides ?? 0}
          />
        </div>
      )}

      {profileQuery.isPending ? (
        <p className="text-pine-700 mt-6 text-sm">Chargement du profil…</p>
      ) : (
        // key : si le profil arrive après coup (ex. rafraîchi), le formulaire repart des bonnes valeurs
        <ProfileForm key={profile?.id ?? 'new'} userId={userId} profile={profile} />
      )}

      <PushToggle />

      <dl className="border-pine-100 divide-pine-100 mt-6 divide-y rounded-2xl border bg-white px-4">
        <div className="flex items-center justify-between py-3">
          <dt className="text-pine-700 text-sm">Membre depuis</dt>
          <dd className="text-sm">
            {new Intl.DateTimeFormat('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(new Date(session.user.created_at))}
          </dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-pine-700 text-sm">Identifiant</dt>
          <dd className="font-mono text-xs">{userId.slice(0, 8)}</dd>
        </div>
      </dl>

      <button
        onClick={signOut}
        disabled={busy}
        className="border-pine-100 mt-6 w-full rounded-xl border bg-white py-3.5 font-medium disabled:opacity-50"
      >
        {busy ? 'Déconnexion…' : 'Me déconnecter'}
      </button>
    </main>
  )
}
