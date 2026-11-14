import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ChordDiagram } from '~/components/ChordDiagram'
import { Btn, confirmDelete, ErrorText, Field, inputCls, useAction } from '~/components/admin/ui'
import type { Chord } from '~/content/types'
import { deleteChordFn, getAdminChordsFn, saveChordFn } from '~/server/admin'

export const Route = createFileRoute('/admin/chords')({
  loader: () => getAdminChordsFn(),
  head: () => ({ meta: [{ title: 'Chords · Admin' }] }),
  component: ChordLibrary,
})

const STRINGS = ['E', 'A', 'D', 'G', 'B', 'e']

function ChordLibrary() {
  const chords = Route.useLoaderData()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const del = useAction()

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Chord library</h1>
      <p className="text-sm text-muted">Shapes you can attach to lessons as diagrams.</p>
      <ErrorText>{del.error}</ErrorText>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {chords.map((c) =>
          editing === c.id ? (
            <li key={c.id} className="sm:col-span-2">
              <ChordForm chord={c} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={c.id} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-3">
              <ChordDiagram chord={c} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted">
                  id <code>{c.id}</code> · used in {c.usedBy} lesson{c.usedBy === 1 ? '' : 's'}
                </p>
                <div className="mt-2 flex gap-2">
                  <Btn onClick={() => setEditing(c.id)}>Edit</Btn>
                  <Btn
                    variant="danger"
                    disabled={del.busy}
                    onClick={() => confirmDelete(`chord ${c.name}`) && del.run(() => deleteChordFn({ data: { id: c.id } }))}
                  >
                    Delete
                  </Btn>
                </div>
              </div>
            </li>
          ),
        )}
      </ul>

      <div className="mt-6">
        {editing === 'new' ? <ChordForm onDone={() => setEditing(null)} /> : <Btn variant="primary" onClick={() => setEditing('new')}>+ New chord</Btn>}
      </div>
    </>
  )
}

const parseFret = (s: string) => (/^x$/i.test(s.trim()) ? -1 : s.trim() === '' ? 0 : Number(s))
const fretText = (n: number) => (n < 0 ? 'x' : String(n))

function ChordForm({ chord, onDone }: { chord?: Chord; onDone: () => void }) {
  const { busy, error, run } = useAction()
  const [id, setId] = useState(chord?.id ?? '')
  const [name, setName] = useState(chord?.name ?? '')
  const [frets, setFrets] = useState<string[]>(chord ? chord.frets.map(fretText) : Array(6).fill('0'))
  const [fingers, setFingers] = useState<string[]>(chord ? chord.fingers.map(String) : Array(6).fill('0'))
  const [bFret, setBFret] = useState(String(chord?.barre?.fret ?? ''))
  const [bFrom, setBFrom] = useState(String(chord?.barre?.from ?? ''))
  const [bTo, setBTo] = useState(String(chord?.barre?.to ?? ''))

  const fretNums = frets.map(parseFret)
  const fingerNums = fingers.map((f) => (f.trim() === '' ? 0 : Number(f)))
  const barre = bFret ? { fret: Number(bFret), from: Number(bFrom), to: Number(bTo) } : null
  const valid = fretNums.every((n) => Number.isInteger(n) && n >= -1 && n <= 24) && fingerNums.every((n) => Number.isInteger(n) && n >= 0 && n <= 4)
  const preview: Chord = { id: id || 'new', name: name || id || 'New', frets: fretNums, fingers: fingerNums, barre }

  const cell = (vals: string[], set: (v: string[]) => void, i: number) => (
    <input
      aria-label={`${STRINGS[i]} string`}
      value={vals[i]}
      onChange={(e) => set(vals.map((v, j) => (j === i ? e.target.value : v)))}
      className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-center text-sm"
    />
  )

  return (
    <form
      className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto]"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await run(() => saveChordFn({ data: { isNew: !chord, id, name, frets: fretNums, fingers: fingerNums, barre } }))
        if (ok) onDone()
      }}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Id" hint={chord ? 'Fixed once created (lessons refer to it).' : 'Short and unique, e.g. Cmaj7'}>
            <input required disabled={!!chord} maxLength={12} pattern="[A-Za-z0-9#b+\-]+" value={id} onChange={(e) => setId(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Name shown">
            <input required maxLength={20} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div>
          <p className="text-sm font-medium">Frets, low E to high e</p>
          <div className="mt-1 grid grid-cols-6 gap-1.5">{STRINGS.map((_, i) => <div key={i}>{cell(frets, setFrets, i)}</div>)}</div>
          <p className="mt-1 text-xs text-muted">0 = open, x = muted, otherwise the fret number.</p>
        </div>
        <div>
          <p className="text-sm font-medium">Fingers (0 = none, 1 index … 4 pinky)</p>
          <div className="mt-1 grid grid-cols-6 gap-1.5">{STRINGS.map((_, i) => <div key={i}>{cell(fingers, setFingers, i)}</div>)}</div>
        </div>
        <div>
          <p className="text-sm font-medium">Barre (optional)</p>
          <div className="mt-1 grid max-w-sm grid-cols-3 gap-2">
            <Field label="Fret">
              <input value={bFret} onChange={(e) => setBFret(e.target.value)} inputMode="numeric" className={inputCls} />
            </Field>
            <Field label="From string">
              <input value={bFrom} onChange={(e) => setBFrom(e.target.value)} inputMode="numeric" className={inputCls} />
            </Field>
            <Field label="To string">
              <input value={bTo} onChange={(e) => setBTo(e.target.value)} inputMode="numeric" className={inputCls} />
            </Field>
          </div>
          <p className="mt-1 text-xs text-muted">Strings are numbered 6 (low E) to 1 (high e). A full barre is from 6 to 1.</p>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Btn type="submit" variant="primary" disabled={busy || !valid}>
            {busy ? 'Saving…' : 'Save chord'}
          </Btn>
          <Btn onClick={onDone}>Cancel</Btn>
        </div>
      </div>
      <div className="justify-self-center">
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
        {valid ? <ChordDiagram chord={preview} /> : <p className="w-24 text-center text-xs text-red-500">Check the numbers</p>}
      </div>
    </form>
  )
}
