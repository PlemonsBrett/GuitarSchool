import { useState } from 'react'
import type { Chord, Item, Phase } from '~/content/types'
import { slugify } from '~/lib/slug'
import { deleteItemFn, deletePhaseFn, moveItemFn, reorderFn, saveItemFn, savePhaseFn } from '~/server/admin'
import { ChordDiagram } from '../ChordDiagram'
import { NotationEditor } from './NotationEditor'
import { Btn, confirmDelete, ErrorText, Field, inputCls, moved, MoveButtons, useAction } from './ui'

// ---------------------------------------------------------------------------------------------
// Phase
// ---------------------------------------------------------------------------------------------

export function PhaseForm({
  trackSlug,
  phase,
  onDone,
}: {
  trackSlug: string
  phase?: Phase
  onDone: () => void
}) {
  const { busy, error, run } = useAction()
  const [title, setTitle] = useState(phase?.title ?? '')
  const [slug, setSlug] = useState(phase?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(false)
  const [months, setMonths] = useState(phase?.months ?? '')
  const [summary, setSummary] = useState(phase?.summary ?? '')
  const [milestone, setMilestone] = useState(phase?.milestone.text ?? '')

  return (
    <form
      className="space-y-3 rounded-xl border border-line bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await run(() =>
          savePhaseFn({ data: { id: phase?.id, trackSlug, slug, title, months, summary, milestoneText: milestone } }),
        )
        if (ok) onDone()
      }}
    >
      <h3 className="font-semibold">{phase ? 'Edit phase' : 'New phase'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input
            required
            maxLength={80}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (!phase && !slugTouched) setSlug(slugify(e.target.value))
            }}
            className={inputCls}
          />
        </Field>
        <Field label="Months" hint='e.g. "Months 1-2"'>
          <input maxLength={40} value={months} onChange={(e) => setMonths(e.target.value)} className={inputCls} />
        </Field>
        {!phase && (
          <Field label="Slug" hint="Set once; learners' progress is keyed to it.">
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugTouched(true)
              }}
              className={inputCls}
            />
          </Field>
        )}
      </div>
      <Field label="Summary">
        <input maxLength={300} value={summary} onChange={(e) => setSummary(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Milestone" hint="The checkpoint that closes the phase, e.g. “10 clean chord changes a minute”.">
        <input maxLength={300} value={milestone} onChange={(e) => setMilestone(e.target.value)} className={inputCls} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Btn type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save phase'}
        </Btn>
        <Btn onClick={onDone}>Cancel</Btn>
      </div>
    </form>
  )
}

export function PhaseCard({
  trackSlug,
  phase,
  index,
  total,
  allPhaseIds,
  phaseOptions,
  chords,
}: {
  trackSlug: string
  phase: Phase
  index: number
  total: number
  allPhaseIds: string[]
  phaseOptions: { id: string; title: string }[]
  chords: Chord[]
}) {
  const act = useAction()
  const [editingPhase, setEditingPhase] = useState(false)
  const [openItem, setOpenItem] = useState<string | 'new' | null>(null)

  if (editingPhase) return <PhaseForm trackSlug={trackSlug} phase={phase} onDone={() => setEditingPhase(false)} />

  const moveItem = (i: number, dir: -1 | 1) => {
    const next = moved(phase.items, i, dir)
    if (next) void act.run(() => reorderFn({ data: { kind: 'items', ids: next.map((x) => x.id) } }))
  }
  const movePhase = (dir: -1 | 1) => {
    const next = moved(allPhaseIds, index, dir)
    if (next) void act.run(() => reorderFn({ data: { kind: 'phases', ids: next } }))
  }

  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <MoveButtons disabled={act.busy} onUp={index > 0 ? () => movePhase(-1) : undefined} onDown={index < total - 1 ? () => movePhase(1) : undefined} />
        <div className="min-w-40 flex-1">
          <h3 className="font-semibold">
            {phase.title} <span className="text-sm font-normal text-muted">{phase.months}</span>
          </h3>
          <p className="text-xs text-muted">
            Milestone: {phase.milestone.text || '—'} · <code>{phase.slug}</code>
          </p>
        </div>
        <Btn onClick={() => setEditingPhase(true)}>Edit phase</Btn>
        <Btn
          variant="danger"
          disabled={act.busy}
          onClick={() =>
            confirmDelete(`phase "${phase.title}" and its ${phase.items.length} lesson(s)`) &&
            act.run(() => deletePhaseFn({ data: { id: phase.id } }))
          }
        >
          Delete
        </Btn>
      </header>
      <div className="space-y-2 p-3">
        <ErrorText>{act.error}</ErrorText>
        {phase.items.length === 0 && openItem !== 'new' && <p className="px-1 text-sm text-muted">No lessons in this phase yet.</p>}
        <ul className="space-y-2">
          {phase.items.map((item, i) => (
            <li key={item.id} className="rounded-lg border border-line bg-bg">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <MoveButtons disabled={act.busy} onUp={i > 0 ? () => moveItem(i, -1) : undefined} onDown={i < phase.items.length - 1 ? () => moveItem(i, 1) : undefined} />
                <span className="min-w-32 flex-1 text-sm">
                  <span className="font-medium">{item.title}</span>{' '}
                  <span className="rounded-full border border-line px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wide text-muted">{item.kind}</span>
                  <span className="ml-2 text-xs text-muted">
                    {(item.media?.chords?.length ?? 0) > 0 && `${item.media!.chords!.length} chords · `}
                    {(item.media?.notation?.length ?? 0) > 0 ? `${item.media!.notation!.length} tab(s)` : 'no tab'}
                  </span>
                </span>
                <Btn onClick={() => setOpenItem(openItem === item.id ? null : item.id)}>{openItem === item.id ? 'Close' : 'Edit'}</Btn>
              </div>
              {openItem === item.id && (
                <div className="border-t border-line p-3">
                  <ItemForm phaseId={phase.id} item={item} chords={chords} phaseOptions={phaseOptions} onDone={() => setOpenItem(null)} />
                </div>
              )}
            </li>
          ))}
        </ul>
        {openItem === 'new' ? (
          <div className="rounded-lg border border-line bg-bg p-3">
            <ItemForm phaseId={phase.id} chords={chords} onDone={() => setOpenItem(null)} />
          </div>
        ) : (
          <Btn onClick={() => setOpenItem('new')}>+ Add lesson</Btn>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------------------------

function ItemForm({
  phaseId,
  item,
  chords,
  phaseOptions = [],
  onDone,
}: {
  phaseId: string
  item?: Item
  chords: Chord[]
  phaseOptions?: { id: string; title: string }[]
  onDone: () => void
}) {
  const { busy, error, run } = useAction()
  const del = useAction()
  const move = useAction()
  const [kind, setKind] = useState<'drill' | 'song'>(item?.kind ?? 'drill')
  const [title, setTitle] = useState(item?.title ?? '')
  const [slug, setSlug] = useState(item?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(false)
  const [detail, setDetail] = useState(item?.detail ?? '')
  const [query, setQuery] = useState(item?.query ?? '')
  const [picked, setPicked] = useState<string[]>(item?.media?.chords?.map((c) => c.id) ?? [])
  const [chordNote, setChordNote] = useState(item?.media?.chordNote ?? '')

  const toggleChord = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <div className="space-y-5">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const ok = await run(() =>
            saveItemFn({ data: { id: item?.id, phaseId, slug, kind, title, detail, query, chords: picked, chordNote } }),
          )
          if (ok && !item) onDone()
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <Field label="Type">
            <select value={kind} onChange={(e) => setKind(e.target.value as 'drill' | 'song')} className={inputCls}>
              <option value="drill">Drill</option>
              <option value="song">Song</option>
            </select>
          </Field>
          <Field label="Title">
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (!item && !slugTouched) setSlug(slugify(e.target.value))
              }}
              className={inputCls}
            />
          </Field>
        </div>
        {item && phaseOptions.length > 1 && (
          <Field label="Phase" hint="Move this lesson to another phase. Learners keep their progress.">
            <select
              value={phaseId}
              disabled={move.busy}
              onChange={(e) => void move.run(() => moveItemFn({ data: { id: item.id, phaseId: e.target.value } }))}
              className={inputCls}
            >
              {phaseOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <ErrorText>{move.error}</ErrorText>
          </Field>
        )}
        {!item && (
          <Field label="Slug" hint="Set once; learners' progress is keyed to it. Must be unique within the track.">
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugTouched(true)
              }}
              className={inputCls}
            />
          </Field>
        )}
        <Field label="What to do" hint="One or two sentences.">
          <textarea rows={2} maxLength={500} value={detail} onChange={(e) => setDetail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Search hint" hint={kind === 'song' ? 'Artist, so the Tabs/Lesson links find the right song.' : 'Extra words for the lesson/exercise search links.'}>
          <input maxLength={120} value={query} onChange={(e) => setQuery(e.target.value)} className={inputCls} />
        </Field>

        <fieldset>
          <legend className="text-sm font-medium">Chord diagrams</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chords.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={picked.includes(c.id)}
                onClick={() => toggleChord(c.id)}
                className={`rounded-md border px-2 py-1 text-sm ${picked.includes(c.id) ? 'border-accent bg-accent/15 font-medium' : 'border-line hover:bg-surface'}`}
              >
                {c.name}
              </button>
            ))}
            {chords.length === 0 && <span className="text-sm text-muted">No chords in the library yet.</span>}
          </div>
          {picked.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {picked.map((id) => {
                const c = chords.find((x) => x.id === id)
                return c ? <ChordDiagram key={id} chord={c} /> : null
              })}
            </div>
          )}
        </fieldset>
        {picked.length > 0 && (
          <Field label="Chord note (optional)">
            <input maxLength={300} value={chordNote} onChange={(e) => setChordNote(e.target.value)} className={inputCls} />
          </Field>
        )}

        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap gap-2">
          <Btn type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving…' : item ? 'Save lesson' : 'Add lesson'}
          </Btn>
          <Btn onClick={onDone}>{item ? 'Close' : 'Cancel'}</Btn>
          {item && (
            <Btn
              variant="danger"
              className="ml-auto"
              disabled={del.busy}
              onClick={() =>
                confirmDelete(`"${item.title}"`) && del.run(() => deleteItemFn({ data: { id: item.id } })).then((ok) => ok && onDone())
              }
            >
              Delete lesson
            </Btn>
          )}
        </div>
        <ErrorText>{del.error}</ErrorText>
      </form>

      {item ? (
        <div className="border-t border-line pt-4">
          <NotationEditor item={item} />
        </div>
      ) : (
        <p className="text-xs text-muted">Save the lesson first, then you can attach tabs.</p>
      )}
    </div>
  )
}
