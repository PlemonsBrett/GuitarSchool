import { describe, expect, it } from 'vitest'
import type { Item, Phase, Track } from '~/content/types'
import { currentPhase, todaysPlan } from './plan'

const item = (slug: string, kind: Item['kind']): Item => ({ id: slug, slug, kind, title: slug, detail: '' })
const phase = (slug: string, items: Item[]): Phase => ({
  id: slug,
  slug,
  title: slug,
  months: '',
  summary: '',
  milestone: { slug: `${slug}-milestone`, text: '' },
  items,
})

const track = (phases: Phase[], warmupSlug: string | null = 'spider'): Track => ({
  slug: 't',
  path: 'electric',
  style: 'Lead',
  title: 'T',
  blurb: '',
  tagline: '',
  status: 'published',
  warmupSlug,
  habits: [],
  graduation: [],
  phases,
})

const T = track([
  phase('one', [item('spider', 'drill'), item('chords', 'drill'), item('song-a', 'song'), item('song-b', 'song')]),
  phase('two', [item('strum', 'drill'), item('song-c', 'song')]),
])
const allDone = (t: Track) => new Set(t.phases.flatMap((p) => [...p.items.map((i) => i.slug), p.milestone.slug]))

describe('plan', () => {
  it('starts in the first phase with the warm-up, first drill and first song', () => {
    const plan = todaysPlan(T, new Set())!
    expect(plan.phase.slug).toBe('one')
    expect(plan.blocks.map((b) => b.minutes)).toEqual([5, 10, 10, 5])
    expect(plan.blocks[0].item?.slug).toBe('spider')
    expect(plan.blocks[1].item?.slug).toBe('spider')
    expect(plan.blocks[2].item?.slug).toBe('song-a')
  })

  it('advances to the next unfinished drill and song', () => {
    const plan = todaysPlan(T, new Set(['spider', 'song-a']))!
    expect(plan.blocks[1].item?.slug).toBe('chords')
    expect(plan.blocks[2].item?.slug).toBe('song-b')
  })

  it('moves to the next phase once items and milestone are done', () => {
    const done = new Set(['spider', 'chords', 'song-a', 'song-b', 'one-milestone'])
    expect(currentPhase(T, done)?.slug).toBe('two')
  })

  it('stays on the last phase when everything is complete', () => {
    const plan = todaysPlan(T, allDone(T))!
    expect(plan.phase.slug).toBe('two')
    expect(plan.blocks[1].item).toBeUndefined()
    expect(plan.blocks[1].note).toBeTruthy()
  })

  it('falls back to the first drill when no warm-up is set or it was deleted', () => {
    expect(todaysPlan(track(T.phases, null), new Set())!.blocks[0].item?.slug).toBe('spider')
    expect(todaysPlan(track(T.phases, 'gone'), new Set())!.blocks[0].item?.slug).toBe('spider')
  })

  it('returns null for a track with no phases yet (just created in admin)', () => {
    expect(todaysPlan(track([]), new Set())).toBeNull()
  })
})
