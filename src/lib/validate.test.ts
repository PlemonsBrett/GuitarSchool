import { describe, expect, it } from 'vitest'
import { chords } from '../../scripts/seed/chords'
import { slugify } from './slug'
import { lines, oneOf, optText, parseChord, slug, text, uuid } from './validate'

describe('text', () => {
  it('trims and enforces bounds', () => {
    expect(text('  hi  ', 'T')).toBe('hi')
    expect(() => text('', 'Title', { min: 1 })).toThrow('Title is required')
    expect(() => text('x'.repeat(11), 'T', { max: 10 })).toThrow('too long')
  })
  it('treats non-strings as empty, never crashes', () => {
    expect(text(undefined, 'T')).toBe('')
    expect(text(42, 'T')).toBe('')
    expect(optText('  ', 'T')).toBeNull()
  })
})

describe('slug', () => {
  it.each(['a', 'seven-nation-army', 'a1-b2'])('accepts %s', (s) => expect(slug(s)).toBe(s))
  it.each(['', 'Has Caps', 'trailing-', '-leading', 'double--dash', 'sp ace', 'a'.repeat(61), '../etc'])('rejects %j', (s) =>
    expect(() => slug(s)).toThrow(),
  )
  it('slugify output is always a valid slug', () => {
    for (const t of ["Seven Nation Army!", "Knockin' on Heaven's Door", 'Café  Tacvba', '12-bar blues']) {
      expect(() => slug(slugify(t))).not.toThrow()
    }
    expect(slugify("Knockin' on Heaven's Door")).toBe('knockin-on-heaven-s-door')
  })
})

describe('uuid / oneOf / lines', () => {
  it('uuid accepts real uuids and rejects look-alikes', () => {
    expect(uuid('aaaaaaaa-0000-0000-0000-000000000001')).toBeTruthy()
    expect(() => uuid('------------------------------------')).toThrow()
    expect(() => uuid("1' or '1'='1")).toThrow()
  })
  it('oneOf', () => {
    expect(oneOf('drill', ['drill', 'song'] as const, 'Kind')).toBe('drill')
    expect(() => oneOf('x', ['drill', 'song'] as const, 'Kind')).toThrow()
  })
  it('lines drops blanks and caps the count', () => {
    expect(lines(['a', ' ', 'b'], 'L')).toEqual(['a', 'b'])
    expect(() => lines(Array(21).fill('x'), 'L')).toThrow('too many')
    expect(lines('not an array', 'L')).toEqual([])
  })
})

describe('parseChord', () => {
  const ok = { id: 'Em', name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] }

  it('accepts a valid chord', () => expect(parseChord(ok)).toMatchObject({ id: 'Em', barre: null, isNew: false }))
  it('accepts numeric strings from form inputs', () =>
    expect(parseChord({ ...ok, frets: ['0', '2', '2', '0', '0', '0'] }).frets).toEqual([0, 2, 2, 0, 0, 0]))
  it('rejects wrong string counts and out-of-range frets', () => {
    expect(() => parseChord({ ...ok, frets: [0, 2, 2] })).toThrow('six')
    expect(() => parseChord({ ...ok, frets: [0, 2, 2, 0, 0, 25] })).toThrow('six')
    expect(() => parseChord({ ...ok, fingers: [0, 2, 5, 0, 0, 0] })).toThrow('six')
  })
  it('rejects blank cells instead of silently reading them as 0', () =>
    expect(() => parseChord({ ...ok, frets: ['0', '', '2', '0', '0', '0'] })).toThrow('six'))
  it('rejects a finger on an open or muted string', () => {
    expect(() => parseChord({ ...ok, fingers: [1, 2, 3, 0, 0, 0] })).toThrow('cannot have a finger')
    expect(() => parseChord({ ...ok, frets: [-1, 2, 2, 0, 0, 0], fingers: [1, 2, 3, 0, 0, 0] })).toThrow('cannot have a finger')
  })
  it('requires a finger on fretted strings unless it is a barre', () => {
    expect(() => parseChord({ ...ok, fingers: [0, 2, 0, 0, 0, 0] })).toThrow('needs a finger')
  })
  it('validates barres', () => {
    const f = { id: 'F', name: 'F', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] }
    expect(parseChord({ ...f, barre: { fret: 1, from: 6, to: 1 } }).barre).toEqual({ fret: 1, from: 6, to: 1 })
    expect(() => parseChord({ ...f, barre: { fret: 1, from: 1, to: 6 } })).toThrow('Barre')
    expect(() => parseChord({ ...f, barre: { fret: 1, from: 7, to: 1 } })).toThrow('Barre')
    expect(() => parseChord({ ...f, barre: { fret: 1, from: 6, to: '' } })).toThrow('Barre')
  })
  it('rejects ids that could break references', () => {
    expect(() => parseChord({ ...ok, id: 'E m' })).toThrow('Id may only')
    expect(() => parseChord({ ...ok, id: 'x'.repeat(13) })).toThrow('too long')
  })

  it('every chord in the seed passes the same rules the admin form enforces', () => {
    for (const [id, c] of Object.entries(chords)) {
      expect(() => parseChord({ id, ...c }), id).not.toThrow()
    }
  })
})
