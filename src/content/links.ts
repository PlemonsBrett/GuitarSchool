import type { Item } from './types'

const enc = encodeURIComponent

export type Lookup = { label: string; hint: string; url: string }

/**
 * "Where to look next": we never embed lessons, we point to the best places to find them.
 * Search URLs are built from the item so they never go stale.
 */
export function lookups(item: Item): Lookup[] {
  const q = [item.title, item.query].filter(Boolean).join(' ')
  if (item.kind === 'song') {
    return [
      { label: 'Tabs', hint: 'Interactive tab with playback', url: `https://www.songsterr.com/?pattern=${enc(q)}` },
      { label: 'Lesson', hint: 'Video walkthrough', url: `https://www.youtube.com/results?search_query=${enc(`${q} guitar lesson`)}` },
      { label: 'Backing track', hint: 'Play along', url: `https://www.youtube.com/results?search_query=${enc(`${item.title} backing track no guitar`)}` },
    ]
  }
  return [
    { label: 'Lesson', hint: 'Video walkthrough', url: `https://www.youtube.com/results?search_query=${enc(`${q} guitar lesson`)}` },
    { label: 'Exercise', hint: 'Written exercise and tab', url: `https://www.google.com/search?q=${enc(`${item.query ?? item.title} guitar exercise tab pdf`)}` },
  ]
}
