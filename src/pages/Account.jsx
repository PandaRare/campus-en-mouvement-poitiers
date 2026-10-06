import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const inputClass =
  'border-pine-100 focus:border-pine-500 w-full rounded-xl border bg-white px-4 py-3 outline-none'

export default function Account({ session }) {
  const navigate = useNavigate()
  const userId = session.user.id
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({ full_name: '', study: '' })
  const [message, setMessage] = useState(null) // { type: 'ok' | 'error', text }

  useEffect(() => {
    let active = true
    supabase
      .from('profiles')
      .select('full_name, study')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setMessage({ type: 'error', text: error.message })
        else if (data) setProfile({ full_name: data.full_name ?? '', study: data.study ?? '' })
      })
    return () => {
      active = false
    }
  }, [userId])

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: profile.full_name.trim() || null,
      study: profile.study.trim() || null,
      updated_at: new Date().toISOString(),
    })
    setMessage(
      error ? { type: 'error', text: error.message } : { type: 'ok', text: 'Profil enregistré.' },
    )
    setSaving(false)
  }

  async function signOut() {
    setBusy(true)
    await supabase.auth.signOut()
    setBusy(false)
    navigate('/trajets', { replace: true })
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
      <h1 className="text-2xl font-semibold">Mon compte</h1>
      <p className="text-pine-700 mt-1 text-sm">{session.user.email}</p>

      <form onSubmit={saveProfile} className="border-pine-100 mt-6 space-y-4 rounded-2xl border bg-white p-4">
        <h2 className="font-medium">Mon profil</h2>

        <label className="block">
          <span className="text-pine-700 mb-1 block text-sm">Prénom ou pseudo</span>
          <input
            value={profile.full_name}
            onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
            maxLength={40}
            placeholder="Ex. Gaspard"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-pine-700 mb-1 block text-sm">Licence / formation</span>
          <input
            value={profile.study}
            onChange={(e) => setProfile((p) => ({ ...p, study: e.target.value }))}
            maxLength={80}
            placeholder="Ex. L3 Maths, M1 Droit, BTS…"
            className={inputClass}
          />
        </label>

        <p className="text-pine-500 text-xs">
          Ces informations sont visibles par les autres étudiants connectés (sur les trajets que
          vous conduisez).
        </p>

        {message && (
          <p
            className={`rounded-xl px-4 py-3 text-sm ${
              message.type === 'ok' ? 'bg-pine-100 text-pine-900' : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="bg-pine-900 w-full rounded-xl py-3.5 font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

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
