import { useEffect, useState } from 'react'
import { X, MapPin } from 'lucide-react'
import { searchPlaces } from '../lib/geo'

// Champ de recherche d'adresse avec suggestions.
// - value / onChange : texte affiché
// - selected / onSelect : lieu choisi { label, lat, lng } ou null
export default function AddressInput({
  value,
  onChange,
  selected,
  onSelect,
  placeholder,
  ariaLabel,
  LeftIcon = MapPin,
  shortcuts = [],
  required = false,
}) {
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const q = value.trim()
    if (selected || q.length < 3) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setFailed(false)
      try {
        setResults(await searchPlaces(q, controller.signal))
        setOpen(true)
      } catch (err) {
        if (err.name !== 'AbortError') setFailed(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 350)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, selected])

  function pick(place) {
    onChange(place.label)
    onSelect(place)
    setOpen(false)
    setResults([])
  }

  function clear() {
    onChange('')
    onSelect(null)
    setResults([])
  }

  const showList = open && !selected && value.trim().length >= 3

  return (
    <div>
      <div className="relative">
        <LeftIcon
          size={18}
          className="text-pine-500 pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
        />
        <input
          type="text"
          required={required}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            onSelect(null)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          className={`focus:border-pine-500 w-full rounded-xl border bg-white py-3 pr-11 pl-11 text-base outline-none ${
            selected ? 'border-pine-500' : 'border-pine-100'
          }`}
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Effacer"
            className="text-pine-500 absolute top-1/2 right-3 -translate-y-1/2 p-1"
          >
            <X size={18} />
          </button>
        )}

        {showList && (
          <ul className="border-pine-100 absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border bg-white shadow-lg">
            {loading && <li className="text-pine-700 px-4 py-3 text-sm">Recherche…</li>}
            {!loading && failed && (
              <li className="px-4 py-3 text-sm text-red-800">
                Recherche indisponible, réessayez dans un instant.
              </li>
            )}
            {!loading && !failed && results.length === 0 && (
              <li className="text-pine-700 px-4 py-3 text-sm">Aucune adresse trouvée.</li>
            )}
            {results.map((place) => (
              <li key={`${place.lat}-${place.lng}-${place.label}`}>
                <button
                  type="button"
                  // mousedown se déclenche avant le blur : le choix n'est donc pas perdu
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(place)
                  }}
                  className="hover:bg-pine-50 flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm"
                >
                  <MapPin size={16} className="text-pine-500 mt-0.5 shrink-0" />
                  <span>{place.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {shortcuts.length > 0 && !selected && (
        <div className="mt-2 flex flex-wrap gap-2">
          {shortcuts.map((place) => (
            <button
              key={place.label}
              type="button"
              onClick={() => pick(place)}
              className="border-pine-100 text-pine-700 rounded-full border bg-white px-3 py-1 text-xs"
            >
              {place.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
