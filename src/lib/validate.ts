import type { Chord } from '~/content/types'
import { SLUG_RE } from './slug'

/** Input validation for admin server functions. Pure, so it is unit-tested without a database. */

export const obj = (d: unknown): Record<string, unknown> =>
  d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : {}

export function text(v: unknown, label: string, { min = 0, max = 500 } = {}): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (s.length < min) throw new Error(`${label} is required`)
  if (s.length > max) throw new Error(`${label} is too long (max ${max})`)
  return s
}

export const optText = (v: unknown, label: string, max = 500) => text(v, label, { max }) || null

export function slug(v: unknown, label = 'Slug'): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!SLUG_RE.test(s) || s.length > 60) throw new Error(`${label} must be lowercase letters, numbers and dashes`)
  return s
}

export function lines(v: unknown, label: string): string[] {
  const xs = Array.isArray(v) ? v : []
  if (xs.length > 20) throw new Error(`${label}: too many lines`)
  return xs.map((x) => text(x, label, { max: 300 })).filter(Boolean)
}

export function uuid(v: unknown, label = 'Id'): string {
  if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
    throw new Error(`${label} is invalid`)
  }
  return v
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], label: string): T {
  if (!allowed.includes(v as T)) throw new Error(`${label} must be one of: ${allowed.join(', ')}`)
  return v as T
}

function six(v: unknown, label: string, lo: number, hi: number): number[] {
  const a = Array.isArray(v) ? v.map((n) => (typeof n === 'string' && n.trim() === '' ? NaN : Number(n))) : []
  if (a.length !== 6 || a.some((n) => !Number.isInteger(n) || n < lo || n > hi)) {
    throw new Error(`${label}: six whole numbers, ${lo} to ${hi}`)
  }
  return a
}

export function parseChord(d: unknown) {
  const x = obj(d)
  const id = text(x.id, 'Id', { min: 1, max: 12 })
  if (!/^[A-Za-z0-9#b+-]+$/.test(id)) throw new Error('Id may only contain letters, numbers, # b + -')
  const frets = six(x.frets, 'Frets', -1, 24)
  const fingers = six(x.fingers, 'Fingers', 0, 4)
  frets.forEach((f, i) => {
    if (f <= 0 && fingers[i] !== 0) throw new Error('Open or muted strings cannot have a finger')
    if (f > 0 && fingers[i] === 0 && !x.barre) {
      // a fretted note with no finger is almost always a typo; barres may legitimately omit fingers
      throw new Error('Every fretted string needs a finger (1-4)')
    }
  })

  let barre: Chord['barre'] = null
  const b = obj(x.barre)
  if (x.barre && b.fret) {
    const fret = Number(b.fret)
    const from = Number(b.from)
    const to = Number(b.to)
    if (![fret, from, to].every(Number.isInteger) || fret < 1 || from < 1 || from > 6 || to < 1 || to > 6 || from < to) {
      throw new Error('Barre: fret 1 or higher; strings numbered 6 (low E) to 1 (high e); "from" must be at least "to"')
    }
    barre = { fret, from, to }
  }
  return { isNew: x.isNew === true, id, name: text(x.name, 'Name', { min: 1, max: 20 }), frets, fingers, barre }
}
