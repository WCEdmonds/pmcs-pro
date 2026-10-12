import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { errorMessage, isAbortedError } from '../lib/api'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface DialogProps {
  title: string
  children: React.ReactNode
  /** Called on Escape / backdrop / Close. Ignored while `busy`. */
  onClose: () => void
  busy?: boolean
  footer?: React.ReactNode
  /** data-testid for the dialog element. */
  testId?: string
}

/**
 * Modal dialog: role="dialog" + aria-modal, labelled by its title, Escape to
 * close, focus moved inside on open (first [data-autofocus] or focusable),
 * Tab kept inside, and focus returned to the opener on close.
 */
export function Dialog({ title, children, onClose, busy, footer, testId }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const bodyId = useId()
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  useLayoutEffect(() => {
    closeRef.current = onClose
    busyRef.current = busy
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? node)?.focus()
    return () => {
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (!busyRef.current) closeRef.current()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busyRef.current) closeRef.current()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid={testId}
        className="w-full max-w-md bg-bg-secondary border border-border rounded-xl p-6 shadow-xl focus:outline-none"
      >
        <h2 id={titleId} className="font-display text-lg font-semibold text-text-primary mb-3">
          {title}
        </h2>
        <div id={bodyId} className="text-sm text-text-secondary space-y-3">
          {children}
        </div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}

export const btnSecondary =
  'px-4 py-2 rounded-lg text-sm font-medium text-text-secondary bg-bg-tertiary hover:text-text-primary disabled:opacity-50 transition-colors'
export const btnPrimary =
  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-accent-blue text-white hover:bg-accent-blue/90 disabled:opacity-50 transition-colors'
export const btnDanger =
  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-accent-red text-white hover:bg-accent-red/90 disabled:opacity-50 transition-colors'

interface ConfirmDialogProps {
  title: string
  /** The consequence, in plain words. */
  children: React.ReactNode
  confirmLabel: string
  danger?: boolean
  /** Extra condition for the confirm button (e.g. a valid input inside the dialog). */
  canConfirm?: boolean
  /** Runs the action; a thrown error is shown inside the dialog and keeps it open. */
  onConfirm: () => Promise<void>
  onClose: () => void
  testId?: string
}

/** Confirm-before-acting dialog. Cancel gets initial focus so Enter never confirms by accident. */
export function ConfirmDialog({ title, children, confirmLabel, danger, canConfirm = true, onConfirm, onClose, testId }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  async function confirm() {
    if (busyRef.current || !canConfirm) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      if (!isAbortedError(err)) setError(errorMessage(err))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={title}
      onClose={onClose}
      busy={busy}
      testId={testId}
      footer={
        <>
          <button type="button" data-autofocus onClick={onClose} disabled={busy} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={busy || !canConfirm} className={danger ? btnDanger : btnPrimary}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error && (
        <p role="alert" className="text-accent-red">
          {error}
        </p>
      )}
    </Dialog>
  )
}
