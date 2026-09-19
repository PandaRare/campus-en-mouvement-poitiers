import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { type, text }

  const isSignup = mode === 'signup'

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)

    const { error } = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else if (isSignup) {
      setMessage({
        type: 'ok',
        text: 'Compte créé. Confirmez votre adresse via le lien reçu par e-mail.',
      })
    }
    // En connexion réussie, App.jsx bascule automatiquement via onAuthStateChange.
    setBusy(false)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <p className="text-pine-500 text-sm">Campus en Mouvement</p>
        <h1 className="mt-1 text-3xl leading-tight font-semibold">
          Le campus se déplace ensemble.
        </h1>
        <p className="text-pine-700 mt-3 text-sm">
          Proposez vos places libres, trouvez un trajet, partagez les frais.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-pine-700 text-sm">Adresse e-mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@univ.fr"
            className="border-pine-100 focus:border-pine-500 mt-1 w-full rounded-xl border bg-white px-4 py-3 text-base outline-none"
          />
        </label>

        <label className="block">
          <span className="text-pine-700 text-sm">Mot de passe</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
            className="border-pine-100 focus:border-pine-500 mt-1 w-full rounded-xl border bg-white px-4 py-3 text-base outline-none"
          />
        </label>

        {message && (
          <p
            className={`rounded-xl px-4 py-3 text-sm ${
              message.type === 'error'
                ? 'bg-red-50 text-red-800'
                : 'bg-pine-100 text-pine-900'
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="bg-pine-900 w-full rounded-xl py-3.5 font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Un instant…' : isSignup ? 'Créer mon compte' : 'Me connecter'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(isSignup ? 'login' : 'signup')
          setMessage(null)
        }}
        className="text-pine-700 mt-6 text-sm underline underline-offset-4"
      >
        {isSignup ? 'J’ai déjà un compte' : 'Créer un compte étudiant'}
      </button>
    </main>
  )
}
