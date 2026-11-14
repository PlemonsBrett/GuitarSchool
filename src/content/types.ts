export type PathId = 'acoustic' | 'electric'

export type Item = {
  /** Stable slug, unique within a track. Stored in user_progress.item_slug. */
  slug: string
  kind: 'drill' | 'song'
  title: string
  /** What to actually do, in one or two sentences. */
  detail: string
  /** Optional search hint appended to lookups, e.g. the artist. */
  query?: string
}

export type Phase = {
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
  tagline: string
  published: boolean
  phases: Phase[]
  habits: string[]
  /** What "intermediate" means for this track. */
  graduation: string[]
}

export type StyleOption = {
  trackSlug: string
  label: string
  blurb: string
}

export type PathInfo = {
  id: PathId
  title: string
  blurb: string
  styles: StyleOption[]
}
