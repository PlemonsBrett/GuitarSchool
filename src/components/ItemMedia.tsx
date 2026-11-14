import { useState } from 'react'
import type { ItemMedia as Media } from '~/content/types'
import { ChordDiagram } from './ChordDiagram'
import { Notation } from './Notation'

export function ItemMedia({ media }: { media?: Media }) {
  // Notation mounts only once opened, so alphaTab is loaded on demand.
  const [open, setOpen] = useState<Set<number>>(new Set())
  if (!media) return null
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })

  return (
    <div className="mt-3 space-y-3">
      {media.chords && (
        <div>
          <div className="flex flex-wrap gap-3">
            {media.chords.map((c) => (
              <ChordDiagram key={c.id} chord={c} />
            ))}
          </div>
          {media.chordNote && <p className="mt-1 text-xs text-muted">{media.chordNote}</p>}
        </div>
      )}
      {media.notation?.map((n, i) => (
        <div key={n.id} className="rounded-lg border border-line bg-bg">
          <button
            type="button"
            aria-expanded={open.has(i)}
            onClick={() => toggle(i)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
          >
            <span>♪ {n.title}</span>
            <span className="text-muted">{open.has(i) ? 'Hide' : 'Show tab'}</span>
          </button>
          {open.has(i) && (
            <div className="border-t border-line p-3">
              <Notation tex={n.tex} fileUrl={n.fileUrl} />
              {n.caption && <p className="mt-2 text-sm text-muted">{n.caption}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
