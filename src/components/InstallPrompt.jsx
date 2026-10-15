import { useState, useSyncExternalStore } from 'react'
import { Download, Share, X } from 'lucide-react'
import {
  subscribe,
  canInstall,
  wasInstalled,
  isStandalone,
  isIos,
  promptInstall,
} from '../lib/pwaInstall'

const DISMISS_KEY = 'cem-install-dismissed'

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export default function InstallPrompt({ withNav = false }) {
  const available = useSyncExternalStore(subscribe, canInstall)
  const installed = useSyncExternalStore(subscribe, wasInstalled)
  const [dismissed, setDismissed] = useState(readDismissed)

  const ios = isIos()

  // Déjà installée, ou rien à proposer : on n'affiche rien
  if (installed || isStandalone() || dismissed) return null
  if (!available && !ios) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* stockage indisponible : on masque pour cette session seulement */
    }
  }

  return (
    <div
      className={`fixed inset-x-0 z-30 px-4 ${
        withNav ? 'bottom-[calc(4.5rem+env(safe-area-inset-bottom))]' : 'bottom-4'
      }`}
    >
      <div className="bg-pine-900 mx-auto flex w-full max-w-md items-center gap-3 rounded-2xl p-3 pl-4 text-white shadow-lg">
        {available ? (
          <>
            <Download size={20} className="shrink-0" />
            <p className="flex-1 text-sm">Installer Campus en Mouvement sur votre téléphone</p>
            <button
              onClick={promptInstall}
              className="bg-signal text-pine-900 shrink-0 rounded-xl px-4 py-2 text-sm font-medium"
            >
              Installer
            </button>
          </>
        ) : (
          <>
            <Share size={20} className="shrink-0" />
            <p className="flex-1 text-sm">
              Pour installer : touchez <strong>Partager</strong>, puis{' '}
              <strong>Sur l’écran d’accueil</strong>.
            </p>
          </>
        )}
        <button
          onClick={dismiss}
          aria-label="Masquer"
          className="shrink-0 rounded-lg p-1.5 text-white/70"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
