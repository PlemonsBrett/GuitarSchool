import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { signInFn, signUpFn } from '~/server/auth'

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    // Only same-site paths, so this can't be used as an open redirect.
    redirect: typeof s.redirect === 'string' && /^\/(?!\/)/.test(s.redirect) ? s.redirect : undefined,
  }),
  component: Login,
})

function Login() {
  const { redirect = '/' } = Route.useSearch()
  const router = useRouter()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const creds = { email: String(f.get('email')), password: String(f.get('password')) }
    setBusy(true)
    setError(null)
    try {
      if (mode === 'in') {
        const r = await signInFn({ data: creds })
        if (r.error) return setError(r.error)
      } else {
        const r = await signUpFn({ data: creds })
        if (r.error) return setError(r.error)
        if (r.needsConfirmation) return setNotice('Check your email to confirm your account, then sign in.')
      }
      await router.invalidate()
      await router.navigate({ to: redirect })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-sm rounded-xl border border-line bg-surface p-6">
      <h1 className="text-2xl font-semibold">{mode === 'in' ? 'Sign in' : 'Create account'}</h1>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2" />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        {notice && <p role="status" className="text-sm text-ok">{notice}</p>}
        <button disabled={busy} className="w-full rounded-md bg-accent px-3 py-2 font-medium text-accent-ink disabled:opacity-60">
          {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
      <button
        className="mt-4 text-sm text-muted underline"
        onClick={() => {
          setMode(mode === 'in' ? 'up' : 'in')
          setError(null)
          setNotice(null)
        }}
      >
        {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
    </div>
  )
}
