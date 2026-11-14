import { createFileRoute, Link, notFound, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ItemMedia } from '~/components/ItemMedia'
import { lookups } from '~/content/links'
import { getTrack } from '~/content'
import { todaysPlan } from '~/lib/plan'
import { currentStreak } from '~/lib/streak'
import { getProgressFn, logPracticeFn, startTrackFn } from '~/server/progress'

export const Route = createFileRoute('/tracks/$slug/today')({
  beforeLoad: ({ context, location }) => {
    if (!context.user) throw redirect({ to: '/login', search: { redirect: location.pathname } })
  },
  loader: async ({ params }) => {
    const track = getTrack(params.slug)
    if (!track?.published) throw notFound()
    return { track, progress: await getProgressFn({ data: { trackSlug: track.slug } }) }
  },
  head: () => ({ meta: [{ title: "Today's practice · Guitar School" }] }),
  component: Today,
})

function Today() {
  const { track, progress } = Route.useLoaderData()
  const router = useRouter()
  const [minutes, setMinutes] = useState(30)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const { phase, blocks } = todaysPlan(track, new Set(progress.completed))
  const streak = currentStreak(progress.practiceDays, progress.today)

  async function log(e: React.FormEvent) {
    e.preventDefault()
    setState('saving')
    setError(null)
    try {
      if (!progress.startedOn) await startTrackFn({ data: { trackSlug: track.slug } })
      await logPracticeFn({ data: { trackSlug: track.slug, minutes, note } })
      setNote('')
      setState('saved')
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setState('idle')
    }
  }

  return (
    <>
      <Link to="/tracks/$slug" params={{ slug: track.slug }} className="text-sm text-muted hover:text-text">
        ← {track.title} roadmap
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Today's practice</h1>
      <p className="text-muted">
        {phase.title} · {phase.months} · 🔥 {streak}-day streak
      </p>

      <ol className="mt-6 space-y-3">
        {blocks.map((b) => (
          <li key={b.label} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{b.label}</h2>
              <span className="text-sm text-muted">{b.minutes} min</span>
            </div>
            {b.item && (
              <>
                <p className="mt-1">{b.item.title}</p>
                <p className="text-sm text-muted">{b.item.detail}</p>
                <p className="mt-2 flex flex-wrap gap-2 text-sm">
                  {lookups(b.item).map((l) => (
                    <a
                      key={l.label}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-line px-2 py-0.5 hover:border-accent hover:text-accent"
                    >
                      {l.label} ↗
                    </a>
                  ))}
                </p>
                <ItemMedia media={b.item.media} />
              </>
            )}
            {b.note && <p className="mt-1 text-sm text-muted">{b.note}</p>}
          </li>
        ))}
      </ol>

      <form onSubmit={log} className="mt-8 rounded-xl border border-accent/60 bg-accent/5 p-4">
        <h2 className="font-semibold">Log today's session</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Minutes
            <input
              type="number"
              min={1}
              max={600}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="mt-1 block w-24 rounded-md border border-line bg-bg px-3 py-2"
            />
          </label>
          <label className="min-w-48 flex-1 text-sm">
            Note (optional)
            <input
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Spider at 70 bpm, clean"
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2"
            />
          </label>
          <button disabled={state === 'saving'} className="rounded-md bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-60">
            {state === 'saving' ? 'Saving…' : 'Log it'}
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
        {state === 'saved' && <p role="status" className="mt-2 text-sm text-ok">Logged. Nice work.</p>}
      </form>

      {progress.recent.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Recent sessions</h2>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {progress.recent.map((r) => (
              <li key={r.id} className="flex justify-between gap-4 px-4 py-2">
                <span>{r.practiced_on} · {r.minutes} min</span>
                <span className="truncate text-muted">{r.note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
