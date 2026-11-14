import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ItemRow } from '~/components/ItemRow'
import { getTrack } from '~/content'
import { currentStreak } from '~/lib/streak'
import { getProgressFn, setCompletedFn, startTrackFn } from '~/server/progress'

export const Route = createFileRoute('/tracks/$slug')({
  loader: async ({ params, context }) => {
    const track = getTrack(params.slug)
    if (!track?.published) throw notFound()
    const progress = context.user ? await getProgressFn({ data: { trackSlug: track.slug } }) : null
    return { track, progress }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.track.title ?? 'Track'} · Guitar School` }] }),
  notFoundComponent: () => <p className="py-10">That track doesn't exist yet.</p>,
  component: TrackPage,
})

function TrackPage() {
  const { track, progress } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const completed = new Set(progress?.completed ?? [])
  const total = track.phases.reduce((n, p) => n + p.items.length + 1, 0)
  const doneCount = track.phases.reduce(
    (n, p) => n + p.items.filter((i) => completed.has(i.slug)).length + (completed.has(p.milestone.slug) ? 1 : 0),
    0,
  )

  async function toggle(itemSlug: string, done: boolean) {
    setPending((s) => new Set(s).add(itemSlug))
    setError(null)
    try {
      if (!progress?.startedOn) await startTrackFn({ data: { trackSlug: track.slug } })
      await setCompletedFn({ data: { trackSlug: track.slug, itemSlug, done } })
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setPending((s) => {
        const n = new Set(s)
        n.delete(itemSlug)
        return n
      })
    }
  }

  return (
    <>
      <Link to="/" className="text-sm text-muted hover:text-text">← All paths</Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{track.title}</h1>
      <p className="text-muted">{track.tagline}</p>

      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4">
        {user && progress ? (
          <>
            <div className="min-w-40 flex-1">
              <div className="flex justify-between text-sm">
                <span>{doneCount} of {total} complete</span>
                <span className="text-muted">{Math.round((doneCount / total) * 100)}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={doneCount} aria-valuemax={total}>
                <div className="h-full bg-accent" style={{ width: `${(doneCount / total) * 100}%` }} />
              </div>
            </div>
            <p className="text-sm text-muted">
              🔥 {currentStreak(progress.practiceDays, progress.today)}-day streak · {progress.totalMinutes} min logged
            </p>
            <Link
              to="/tracks/$slug/today"
              params={{ slug: track.slug }}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
            >
              Today's practice →
            </Link>
          </>
        ) : (
          <p className="text-sm">
            <Link to="/login" search={{ redirect: `/tracks/${track.slug}` }} className="font-medium text-accent underline">
              Sign in
            </Link>{' '}
            to check things off, log practice and track your streak.
          </p>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}

      <div className="mt-8 space-y-10">
        {track.phases.map((phase, i) => (
          <section key={phase.slug} aria-labelledby={phase.slug}>
            <p className="text-xs uppercase tracking-wide text-muted">Phase {i + 1} · {phase.months}</p>
            <h2 id={phase.slug} className="text-2xl font-semibold">{phase.title}</h2>
            <p className="text-sm text-muted">{phase.summary}</p>
            <ul className={`mt-3 space-y-2 ${pending.size ? 'opacity-90' : ''}`}>
              {phase.items.map((item) => (
                <ItemRow
                  key={item.slug}
                  item={item}
                  done={completed.has(item.slug)}
                  canToggle={!!user && !pending.has(item.slug)}
                  onToggle={(d) => toggle(item.slug, d)}
                />
              ))}
            </ul>
            <label className="mt-3 flex items-start gap-3 rounded-lg border border-accent/60 bg-accent/5 p-3">
              <input
                type="checkbox"
                checked={completed.has(phase.milestone.slug)}
                disabled={!user || pending.has(phase.milestone.slug)}
                onChange={(e) => toggle(phase.milestone.slug, e.target.checked)}
                className="mt-1 size-4 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-accent">Milestone</span>
                {phase.milestone.text}
              </span>
            </label>
          </section>
        ))}
      </div>

      <section className="mt-12 grid gap-5 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-semibold">What "intermediate" means here</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {track.graduation.map((g) => <li key={g}>{g}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-semibold">Habits that matter most</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {track.habits.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
      </section>
    </>
  )
}
