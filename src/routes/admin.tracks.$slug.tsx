import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { PhaseCard, PhaseForm } from '~/components/admin/PhaseCard'
import { Btn, confirmDelete, ErrorText, Field, inputCls, StatusBadge, useAction } from '~/components/admin/ui'
import { PATHS } from '~/content/paths'
import type { Track, TrackStatus } from '~/content/types'
import { deleteTrackFn, getAdminTrackFn, saveTrackFn } from '~/server/admin'

export const Route = createFileRoute('/admin/tracks/$slug')({
  loader: ({ params }) => getAdminTrackFn({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.track.title ?? 'Track'} · Admin` }] }),
  component: TrackEditor,
})

function TrackEditor() {
  const { track, chords } = Route.useLoaderData()
  const [addingPhase, setAddingPhase] = useState(false)
  const phaseIds = track.phases.map((p) => p.id)

  return (
    <>
      <Link to="/admin" className="text-sm text-muted hover:text-text">
        ← Catalog
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{track.title}</h1>
        <StatusBadge status={track.status} />
        <Link to="/tracks/$slug" params={{ slug: track.slug }} className="ml-auto text-sm text-accent underline">
          Preview as learner ↗
        </Link>
      </div>

      {/* key: reset the form if you navigate straight to a different track */}
      <TrackForm key={track.slug} track={track} />

      <h2 className="mt-10 text-xl font-semibold">Lessons</h2>
      <p className="text-sm text-muted">Phases run in order. Learners work through each phase's lessons, then its milestone.</p>
      <div className="mt-4 space-y-4">
        {track.phases.map((p, i) => (
          <PhaseCard
            key={p.id}
            trackSlug={track.slug}
            phase={p}
            index={i}
            total={track.phases.length}
            allPhaseIds={phaseIds}
            phaseOptions={track.phases.map((x) => ({ id: x.id, title: x.title }))}
            chords={chords}
          />
        ))}
        {addingPhase ? (
          <PhaseForm trackSlug={track.slug} onDone={() => setAddingPhase(false)} />
        ) : (
          <Btn variant="primary" onClick={() => setAddingPhase(true)}>
            + Add phase
          </Btn>
        )}
      </div>

      <DangerZone track={track} />
    </>
  )
}

function TrackForm({ track }: { track: Track }) {
  const { busy, error, run } = useAction()
  const [saved, setSaved] = useState(false)
  const [path, setPath] = useState(track.path)
  const [style, setStyle] = useState(track.style)
  const [title, setTitle] = useState(track.title)
  const [blurb, setBlurb] = useState(track.blurb)
  const [tagline, setTagline] = useState(track.tagline)
  const [status, setStatus] = useState<TrackStatus>(track.status)
  const [warmup, setWarmup] = useState(track.warmupSlug ?? '')
  const [habits, setHabits] = useState(track.habits.join('\n'))
  const [graduation, setGraduation] = useState(track.graduation.join('\n'))
  const items = track.phases.flatMap((p) => p.items)
  const toLines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)

  return (
    <form
      className="mt-6 space-y-4 rounded-xl border border-line bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaved(false)
        const ok = await run(() =>
          saveTrackFn({
            data: {
              isNew: false,
              slug: track.slug,
              path,
              style,
              title,
              blurb,
              tagline,
              status,
              warmupSlug: warmup || null,
              habits: toLines(habits),
              graduation: toLines(graduation),
            },
          }),
        )
        setSaved(ok)
      }}
    >
      <h2 className="font-semibold">Track details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Style" hint="Shown under the path, e.g. Lead">
          <input required maxLength={40} value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Path">
          <select value={path} onChange={(e) => setPath(e.target.value as Track['path'])} className={inputCls}>
            {PATHS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Status"
          hint={
            status === 'published'
              ? 'Learners can open this track and record progress.'
              : status === 'coming_soon'
                ? 'Listed on the home page, but locked.'
                : 'Hidden from learners. Admins can still preview it.'
          }
        >
          <select value={status} onChange={(e) => setStatus(e.target.value as TrackStatus)} className={inputCls}>
            <option value="draft">Draft</option>
            <option value="coming_soon">Coming soon</option>
            <option value="published">Published</option>
          </select>
        </Field>
      </div>
      <Field label="Card blurb" hint="One line on the home page card.">
        <input maxLength={200} value={blurb} onChange={(e) => setBlurb(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Tagline" hint="Shown at the top of the track page.">
        <input maxLength={300} value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Daily warm-up" hint="Shown as the first block of today's practice. Defaults to the first drill.">
        <select value={warmup} onChange={(e) => setWarmup(e.target.value)} className={inputCls}>
          <option value="">First drill (default)</option>
          {items.map((i) => (
            <option key={i.id} value={i.slug}>
              {i.title}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Habits that matter most" hint="One per line.">
          <textarea rows={4} value={habits} onChange={(e) => setHabits(e.target.value)} className={inputCls} />
        </Field>
        <Field label={'What "intermediate" means here'} hint="One per line.">
          <textarea rows={4} value={graduation} onChange={(e) => setGraduation(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center gap-3">
        <Btn type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save details'}
        </Btn>
        {saved && (
          <span role="status" className="text-sm text-ok">
            Saved
          </span>
        )}
      </div>
    </form>
  )
}

function DangerZone({ track }: { track: Track }) {
  const router = useRouter()
  const { busy, error, run } = useAction()
  return (
    <section className="mt-12 rounded-xl border border-red-500/40 p-4">
      <h2 className="font-semibold text-red-500">Danger zone</h2>
      <p className="mt-1 text-sm text-muted">
        Deleting removes the track, all its lessons and uploaded tabs. Learners' progress rows stay in the database but become
        invisible. To hide a track without losing it, set it to Draft instead.
      </p>
      <ErrorText>{error}</ErrorText>
      <Btn
        variant="danger"
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          if (!confirmDelete(`track "${track.title}" and everything in it`)) return
          if (await run(() => deleteTrackFn({ data: { slug: track.slug } }))) await router.navigate({ to: '/admin' })
        }}
      >
        Delete track
      </Btn>
    </section>
  )
}
