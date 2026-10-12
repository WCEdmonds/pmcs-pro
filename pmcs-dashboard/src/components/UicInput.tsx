import { useEffect, useState } from 'react'
import { isValidUic, lookupUnitName, normalizeUic, uicError, zeroSuggestion, type UnitNameLookup } from '../lib/uic'

interface UicInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Show the validation message even before the field is touched (e.g. after a submit attempt). */
  showErrors?: boolean
}

/**
 * UIC field used by Register, the watch list and the profile editor: uppercases
 * as you type, validates "exactly 6 letters/digits" after trimming, offers a
 * one-tap O -> 0 fix, and shows the unit name (or a "new UIC" warning).
 */
export function UicInput({ id, value, onChange, onEnter, placeholder = 'e.g. WABC12', className = '', disabled, showErrors }: UicInputProps) {
  const [touched, setTouched] = useState(false)
  const uic = normalizeUic(value)
  const valid = isValidUic(uic)
  const error = uicError(uic)
  const suggestion = zeroSuggestion(uic)
  const [lookup, setLookup] = useState<{ uic: string; result: UnitNameLookup } | null>(null)

  useEffect(() => {
    if (!valid) return
    const ctl = new AbortController()
    const t = window.setTimeout(() => {
      lookupUnitName(uic, ctl.signal).then((result) => {
        if (!ctl.signal.aborted) setLookup({ uic, result })
      })
    }, 300)
    return () => {
      window.clearTimeout(t)
      ctl.abort()
    }
  }, [uic, valid])

  const result = valid && lookup?.uic === uic ? lookup.result : null
  const showError = (touched || showErrors) && !!value && error

  return (
    <div className="flex-1 min-w-0">
      <input
        id={id}
        type="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onBlur={() => {
          setTouched(true)
          if (value !== uic) onChange(uic)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
        placeholder={placeholder}
        aria-invalid={!!showError}
        aria-describedby={`${id}-hint`}
        className={className}
      />
      <div id={`${id}-hint`} className="mt-1 space-y-1 text-xs" aria-live="polite">
        {suggestion && (
          <p className="text-accent-amber">
            Did you mean 0 (zero)?{' '}
            <button
              type="button"
              onClick={() => onChange(suggestion)}
              className="underline font-semibold hover:text-text-primary"
            >
              Use {suggestion}
            </button>
          </p>
        )}
        {showError && <p className="text-accent-red">{error}</p>}
        {result?.state === 'known' && <p className="text-accent-green">{result.name}</p>}
        {result?.state === 'unknown' && (
          <p className="text-accent-amber">New UIC — check it's correct</p>
        )}
      </div>
    </div>
  )
}
