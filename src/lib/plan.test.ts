import { describe, expect, it } from 'vitest'
import { electricLead } from '~/content/electric-lead'
import { currentPhase, todaysPlan } from './plan'

const slugsOf = (p: (typeof electricLead.phases)[number]) => [...p.items.map((i) => i.slug), p.milestone.slug]

describe('plan', () => {
  it('starts in foundations with spider warm-up, first drill and first song', () => {
    const { phase, blocks } = todaysPlan(electricLead, new Set())
    expect(phase.slug).toBe('foundations')
    expect(blocks.map((b) => b.minutes)).toEqual([5, 10, 10, 5])
    expect(blocks[0].item?.slug).toBe('spider')
    expect(blocks[1].item?.slug).toBe('spider')
    expect(blocks[2].item?.slug).toBe('seven-nation-army')
  })

  it('advances to the next unfinished item and phase', () => {
    const done = new Set(slugsOf(electricLead.phases[0]))
    expect(currentPhase(electricLead, done).slug).toBe('rhythm')
    const { blocks } = todaysPlan(electricLead, new Set(['spider', 'seven-nation-army']))
    expect(blocks[1].item?.slug).toBe('open-chords')
    expect(blocks[2].item?.slug).toBe('smoke-on-the-water')
  })

  it('stays on the last phase when everything is complete', () => {
    const done = new Set(electricLead.phases.flatMap(slugsOf))
    const { phase, blocks } = todaysPlan(electricLead, done)
    expect(phase.slug).toBe('intermediate')
    expect(blocks[1].item).toBeUndefined()
    expect(blocks[1].note).toBeTruthy()
  })

  it('has unique slugs across the track', () => {
    const all = electricLead.phases.flatMap(slugsOf)
    expect(new Set(all).size).toBe(all.length)
  })
})
