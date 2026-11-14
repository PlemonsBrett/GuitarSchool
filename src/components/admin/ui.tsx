import { useRouter } from '@tanstack/react-router'
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const inputCls = 'mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm disabled:opacity-60'

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

type Variant = 'primary' | 'ghost' | 'danger'
export function Btn({ variant = 'ghost', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-accent text-accent-ink font-medium',
    ghost: 'border border-line hover:bg-surface',
    danger: 'border border-red-500/60 text-red-500 hover:bg-red-500/10',
  }
  return <button type="button" {...p} className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${styles[variant]} ${className}`} />
}

export function ErrorText({ children }: { children?: string | null }) {
  return children ? (
    <p role="alert" className="text-sm text-red-500">
      {children}
    </p>
  ) : null
}

/** Runs a server call, reloads route data on success, and keeps busy/error state for the form. */
export function useAction() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await router.invalidate()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export const confirmDelete = (what: string) => window.confirm(`Delete ${what}? This can't be undone.`)

/** Move item `i` up or down; returns the new order, or null at the ends. */
export function moved<T>(list: T[], i: number, dir: -1 | 1): T[] | null {
  const j = i + dir
  if (j < 0 || j >= list.length) return null
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function MoveButtons({ onUp, onDown, disabled }: { onUp?: () => void; onDown?: () => void; disabled?: boolean }) {
  return (
    <span className="inline-flex">
      <button type="button" aria-label="Move up" disabled={disabled || !onUp} onClick={onUp} className="rounded px-1.5 text-muted hover:text-text disabled:opacity-30">
        ↑
      </button>
      <button type="button" aria-label="Move down" disabled={disabled || !onDown} onClick={onDown} className="rounded px-1.5 text-muted hover:text-text disabled:opacity-30">
        ↓
      </button>
    </span>
  )
}

export const statusStyle: Record<string, string> = {
  published: 'border-ok/60 text-ok',
  coming_soon: 'border-accent/60 text-accent',
  draft: 'border-line text-muted',
}
export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${statusStyle[status] ?? ''}`}>{status.replace('_', ' ')}</span>
}
