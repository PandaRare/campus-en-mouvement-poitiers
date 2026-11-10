import { useState } from 'react'
import { Flag } from 'lucide-react'
import { useSendSupportRequest } from '../lib/queries'

const CATEGORIES = [
  { value: 'signalement', label: 'Signaler un comportement ou un trajet' },
  { value: 'probleme', label: 'Problème technique' },
  { value: 'autre', label: 'Autre demande' },
]

const inputClass =
  'border-pine-100 focus:border-pine-500 w-full rounded-xl border bg-white px-4 py-3 outline-none'

// Demande à la modération : enregistrée dans Supabase (table support_requests)
export default function SupportForm() {
  const send = useSendSupportRequest()
  const [category, setCategory] = useState('signalement')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  function submit(e) {
    e.preventDefault()
    setSent(false)
    send.mutate(
      { category, message: message.trim() },
      {
        onSuccess: () => {
          setMessage('')
          setSent(true)
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="border-pine-100 mt-6 space-y-3 rounded-2xl border bg-white p-4">
      <h2 className="flex items-center gap-2 font-medium">
        <Flag size={16} className="text-pine-500" /> Contacter la modération
      </h2>

      <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} aria-label="Motif">
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <textarea
        required
        minLength={5}
        maxLength={2000}
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Décrivez la situation (trajet concerné, date, nom du conducteur…)"
        className={inputClass}
      />

      {send.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{send.error.message}</p>
      )}
      {sent && !send.error && (
        <p className="bg-pine-100 text-pine-900 rounded-xl px-4 py-3 text-sm" role="status">
          Demande envoyée à la modération.
        </p>
      )}

      <button
        type="submit"
        disabled={send.isPending || message.trim().length < 5}
        className="bg-pine-900 w-full rounded-xl py-3.5 font-medium text-white disabled:opacity-50"
      >
        {send.isPending ? 'Envoi…' : 'Envoyer'}
      </button>
    </form>
  )
}
