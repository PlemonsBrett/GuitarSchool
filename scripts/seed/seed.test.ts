import { describe, expect, it } from 'vitest'
import { chords } from './chords'
import { electricLead } from './electric-lead'
import { media } from './notation'

const slugs = electricLead.phases.flatMap((p) => p.items.map((i) => i.slug))

describe('media', () => {
  it('only references items that exist (guards against typos)', () => {
    for (const key of Object.keys(media)) expect(slugs, key).toContain(key)
  })

  it('every attached media entry reaches its item', () => {
    for (const phase of electricLead.phases)
      for (const item of phase.items) expect(item.media, item.slug).toBe(media[item.slug])
  })

  it('only uses chords that are defined', () => {
    for (const m of Object.values(media)) for (const id of m.chords ?? []) expect(chords).toHaveProperty(id)
  })

  it('has well-formed alphaTex (tempo header, notes after the dot, no copyrighted-song titles)', () => {
    for (const m of Object.values(media))
      for (const n of m.notation ?? []) {
        expect(n.tex).toMatch(/^\\tempo \d+\n\.\n/)
        expect(n.tex.split('\n.\n')[1].trim().length).toBeGreaterThan(0)
      }
  })

  it('never attaches notation to songs (chord shapes only)', () => {
    for (const phase of electricLead.phases)
      for (const item of phase.items.filter((i) => i.kind === 'song')) expect(item.media?.notation, item.slug).toBeUndefined()
  })
})

describe('chords', () => {
  it.each(Object.entries(chords))('%s fingering is consistent', (_, c) => {
    expect(c.frets).toHaveLength(6)
    expect(c.fingers).toHaveLength(6)
    c.frets.forEach((f, i) => {
      // fingers only on fretted strings
      if (f <= 0) expect(c.fingers[i]).toBe(0)
      else expect(c.fingers[i]).toBeGreaterThan(0)
    })
  })
})
