export type PathId = 'acoustic' | 'electric'
export type TrackStatus = 'draft' | 'coming_soon' | 'published'

/** Fingering: 6 entries, low E to high E. -1 = muted, 0 = open, n = fret. */
export type Chord = {
  id: string
  name: string
  frets: number[]
  /** Finger per string (1 = index ... 4 = pinky), 0 = none. */
  fingers: number[]
  /** Barre across strings (6 = low E ... 1 = high E) at a fret. */
  barre?: { fret: number; from: number; to: number } | null
}

/** One piece of notation: alphaTex source, or an uploaded Guitar Pro file. */
export type Notation = {
  id: string
  title: string
  caption?: string | null
  tex?: string | null
  fileUrl?: string | null
}

export type ItemMedia = { chords?: Chord[]; chordNote?: string | null; notation?: Notation[] }

export type Item = {
  id: string
  /** Stable slug, unique within a track. Stored in user_progress.item_slug, so it never changes. */
  slug: string
  kind: 'drill' | 'song'
  title: string
  detail: string
  /** Search hint appended to lookups, e.g. the artist. */
  query?: string | null
  media?: ItemMedia
}

export type Phase = {
  id: string
  slug: string
  title: string
  months: string
  summary: string
  milestone: { slug: string; text: string }
  items: Item[]
}

export type Track = {
  slug: string
  path: PathId
  style: string
  title: string
  blurb: string
  tagline: string
  status: TrackStatus
  /** Item shown as the daily warm-up; falls back to the first drill. */
  warmupSlug?: string | null
  habits: string[]
  graduation: string[]
  phases: Phase[]
}

export type CatalogEntry = Pick<Track, 'slug' | 'path' | 'style' | 'title' | 'blurb' | 'status'>
