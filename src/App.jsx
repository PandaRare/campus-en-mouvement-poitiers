import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from 'react-router-dom'
import { Search, Route as RouteIcon, User } from 'lucide-react'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Carpooling from './pages/Carpooling'
import RideDetails from './pages/RideDetails'
import MyRides from './pages/MyRides'

const NAV = [
  { to: '/trajets', label: 'Accueil', Icon: Search },
  { to: '/mes-trajets', label: 'Mes trajets', Icon: RouteIcon },
  { to: '/compte', label: 'Compte', Icon: User },
]

function Account({ session }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

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
          <dd className="font-mono text-xs">{session.user.id.slice(0, 8)}</dd>
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

function BottomNav() {
  return (
    <nav className="border-pine-100 fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-md">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className="flex flex-1 flex-col items-center gap-1 py-2.5">
            {({ isActive }) => (
              <>
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className={isActive ? 'text-pine-900' : 'text-pine-500'}
                />
                <span
                  className={`text-[11px] ${
                    isActive ? 'text-pine-900 font-medium' : 'text-pine-500'
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return <p className="text-pine-700 p-8 text-sm">Chargement…</p>
  }

  if (!session) {
    return <Auth />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/trajets" element={<Carpooling session={session} />} />
        <Route path="/trajets/:id" element={<RideDetails session={session} />} />
        <Route path="/mes-trajets" element={<MyRides session={session} />} />
        <Route path="/compte" element={<Account session={session} />} />
        <Route path="*" element={<Navigate to="/trajets" replace />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  )
}
