import { useEffect, useState } from 'react'
import type { Item, Notation as NotationT } from '~/content/types'
import { deleteNotationFn, reorderFn, saveNotationFn, uploadTabFn } from '~/server/admin'
import { Notation } from '../Notation'
import { Btn, confirmDelete, ErrorText, Field, inputCls, moved, MoveButtons, useAction } from './ui'

const TEMPLATE = `\\tempo 80
.
:8 0.6 2.6 2.5 0.5 0.4 2.4 2.3 0.3 |
0.2 1.2 0.1 3.1 0.1 1.2 0.2 2.3`

function useDebounced<T>(value: T, ms = 700): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function NotationEditor({ item }: { item: Item }) {
  const list = item.media?.notation ?? []
  const [adding, setAdding] = useState<'tex' | 'file' | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<Set<string>>(new Set())
  const act = useAction()

  const togglePreview = (id: string) =>
    setPreviewing((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Tab &amp; notation</h4>
      <ErrorText>{act.error}</ErrorText>

      {list.length === 0 && <p className="text-sm text-muted">No tabs yet.</p>}
      <ul className="space-y-2">
        {list.map((n, i) => (
          <li key={n.id} className="rounded-lg border border-line bg-bg p-3">
            {editing === n.id ? (
              <TexForm itemId={item.id} notation={n} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <MoveButtons
                    disabled={act.busy}
                    onUp={i > 0 ? () => reorder(i, -1) : undefined}
                    onDown={i < list.length - 1 ? () => reorder(i, 1) : undefined}
                  />
                  <span className="min-w-32 flex-1 text-sm font-medium">{n.title}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{n.fileUrl ? 'Guitar Pro file' : 'alphaTex'}</span>
                  <Btn onClick={() => togglePreview(n.id)}>{previewing.has(n.id) ? 'Hide preview' : 'Preview'}</Btn>
                  {n.tex != null && <Btn onClick={() => setEditing(n.id)}>Edit</Btn>}
                  <Btn
                    variant="danger"
                    disabled={act.busy}
                    onClick={() => confirmDelete(`"${n.title}"`) && act.run(() => deleteNotationFn({ data: { id: n.id } }))}
                  >
                    Delete
                  </Btn>
                </div>
                {previewing.has(n.id) && (
                  <div className="mt-3 border-t border-line pt-3">
                    <Notation tex={n.tex} fileUrl={n.fileUrl} />
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {adding === 'tex' && <TexForm itemId={item.id} onDone={() => setAdding(null)} />}
      {adding === 'file' && <FileForm itemId={item.id} onDone={() => setAdding(null)} />}
      {!adding && (
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => setAdding('file')}>+ Upload Guitar Pro file</Btn>
          <Btn onClick={() => setAdding('tex')}>+ Write alphaTex</Btn>
        </div>
      )}
    </div>
  )

  function reorder(i: number, dir: -1 | 1) {
    const next = moved(list, i, dir)
    if (next) void act.run(() => reorderFn({ data: { kind: 'notations', ids: next.map((n) => n.id) } }))
  }
}

function TexForm({ itemId, notation, onDone }: { itemId: string; notation?: NotationT; onDone: () => void }) {
  const { busy, error, run } = useAction()
  const [title, setTitle] = useState(notation?.title ?? '')
  const [caption, setCaption] = useState(notation?.caption ?? '')
  const [tex, setTex] = useState(notation?.tex ?? '')
  const preview = useDebounced(tex)

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await run(() => saveNotationFn({ data: { id: notation?.id, itemId, title, caption, tex } }))) onDone()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Caption (optional)">
          <input maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field
        label="alphaTex"
        hint="Notes are fret.string (1 = high E, 6 = low E), e.g. 3.6 is fret 3 on the low E. Bars separated by |."
      >
        <textarea
          required
          rows={8}
          spellCheck={false}
          value={tex}
          onChange={(e) => setTex(e.target.value)}
          className={`${inputCls} font-mono`}
          placeholder="\tempo 80&#10;.&#10;:8 0.6 2.6 ..."
        />
      </Field>
      <p className="text-xs text-muted">
        Syntax reference:{' '}
        <a href="https://alphatab.net/docs/alphatex/introduction" target="_blank" rel="noopener noreferrer" className="underline">
          alphaTab docs ↗
        </a>
        {!tex && (
          <>
            {' · '}
            <button type="button" className="underline" onClick={() => setTex(TEMPLATE)}>
              Insert a starter
            </button>
          </>
        )}
      </p>
      {preview.trim() && (
        <div className="rounded-lg border border-line p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Live preview</p>
          <Notation tex={preview} />
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Btn type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Btn>
        <Btn onClick={onDone}>Cancel</Btn>
      </div>
    </form>
  )
}

function FileForm({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const { busy, error, run } = useAction()
  const [title, setTitle] = useState('')

  return (
    <form
      className="space-y-3 rounded-lg border border-line bg-bg p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        fd.set('itemId', itemId)
        if (await run(() => uploadTabFn({ data: fd }))) onDone()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Caption (optional)">
          <input name="caption" maxLength={300} className={inputCls} />
        </Field>
      </div>
      <Field label="Guitar Pro file" hint=".gp, .gp5, .gp7, .gpx and similar. Max 5 MB. Files are publicly readable by anyone with the link.">
        <input
          name="file"
          type="file"
          required
          accept=".gp,.gp3,.gp4,.gp5,.gp7,.gpx,.gtp"
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5"
        />
      </Field>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Btn type="submit" variant="primary" disabled={busy}>
          {busy ? 'Uploading…' : 'Upload'}
        </Btn>
        <Btn onClick={onDone}>Cancel</Btn>
      </div>
    </form>
  )
}
