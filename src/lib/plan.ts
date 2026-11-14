import type { Item, Phase, Track } from '~/content/types'

export type DailyBlock = { minutes: number; label: string; item?: Item; note?: string }

/** First phase with anything left to do; the last phase once everything is done. */
export function currentPhase(track: Track, completed: Set<string>): Phase {
  const open = track.phases.find(
    (p) => !completed.has(p.milestone.slug) || p.items.some((i) => !completed.has(i.slug)),
  )
  return open ?? track.phases[track.phases.length - 1]
}

/** The 5 / 10 / 10 / 5 daily structure, pointing at the next unfinished drill and song. */
export function todaysPlan(track: Track, completed: Set<string>) {
  const phase = currentPhase(track, completed)
  const nextOf = (kind: Item['kind']) => phase.items.find((i) => i.kind === kind && !completed.has(i.slug))
  const warmup = track.phases[0].items.find((i) => i.slug === 'spider')
  const blocks: DailyBlock[] = [
    { minutes: 5, label: 'Warm-up', item: warmup },
    {
      minutes: 10,
      label: 'Current drill',
      item: nextOf('drill'),
      note: nextOf('drill') ? undefined : `All ${phase.title} drills are checked off. Review your favorite, or work toward the milestone.`,
    },
    {
      minutes: 10,
      label: 'Current song',
      item: nextOf('song'),
      note: nextOf('song') ? undefined : `All ${phase.title} songs are checked off. Replay one you like.`,
    },
    { minutes: 5, label: 'Play whatever you want', note: 'No plan. This is what keeps you coming back.' },
  ]
  return { phase, blocks }
}
