import type { PathId } from './types'

/** The two top-level paths are fixed. Styles under them are tracks, managed in /admin. */
export const PATHS: { id: PathId; title: string; blurb: string }[] = [
  { id: 'electric', title: 'Electric', blurb: 'Riffs, solos and tone.' },
  { id: 'acoustic', title: 'Acoustic', blurb: 'Campfire to concert hall.' },
]
