import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
} from 'react-router-dom'
import { Search, Route as RouteIcon, Leaf, User } from 'lucide-react'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Carpooling from './pages/Carpooling'
import RideDetails from './pages/RideDetails'
import MyRides from './pages/MyRides'
import Co2 from './pages/Co2'
import Account from './pages/Account'

const NAV = [
  { to: '/trajets', label: 'Accueil', Icon: Search },
  { to: '/mes-trajets', label: 'Mes trajets', Icon: RouteIcon },
  { to: '/co2', label: 'CO₂', Icon: Leaf },
  { to: '/compte', label: 'Compte', Icon: User },
]

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
        <Route path="/co2" element={<Co2 session={session} />} />
        <Route path="/compte" element={<Account session={session} />} />
        <Route path="*" element={<Navigate to="/trajets" replace />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  )
}
