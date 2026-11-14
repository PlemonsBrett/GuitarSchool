import { electricLead } from './electric-lead'
import type { PathInfo, Track } from './types'

export const tracks: Track[] = [electricLead]

export function getTrack(slug: string): Track | undefined {
  return tracks.find((t) => t.slug === slug)
}

/** Every track is listed so the path picker shows what is coming next. */
export const paths: PathInfo[] = [
  {
    id: 'electric',
    title: 'Electric',
    blurb: 'Riffs, solos and tone.',
    styles: [
      { trackSlug: 'electric-lead', label: 'Lead', blurb: 'Scales, bends, solos.' },
      { trackSlug: 'electric-rhythm', label: 'Rhythm', blurb: 'Chords, grooves, palm muting.' },
    ],
  },
  {
    id: 'acoustic',
    title: 'Acoustic',
    blurb: 'Campfire to concert hall.',
    styles: [
      { trackSlug: 'acoustic-traditional', label: 'Traditional', blurb: 'Strumming and flatpicking.' },
      { trackSlug: 'acoustic-fingerstyle', label: 'Fingerstyle', blurb: 'Pattern picking and arrangements.' },
    ],
  },
]

export function isPublished(trackSlug: string): boolean {
  return getTrack(trackSlug)?.published ?? false
}

export function allItems(track: Track) {
  return track.phases.flatMap((p) => p.items.map((item) => ({ phase: p, item })))
}
