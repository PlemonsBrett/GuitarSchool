import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addTap,
  bpmFromTaps,
  cleanPass,
  clampBpm,
  ClickScheduler,
  missedPass,
  type MetronomeSettings,
  type Tick,
} from './metronome'

const base: MetronomeSettings = { bpm: 120, beatsPerBar: 4, subdivision: 1, accentFirst: true }

describe('ClickScheduler', () => {
  let t = 0 // fake audio clock, seconds
  const ticks: Tick[] = []
  const make = (s: Partial<MetronomeSettings> = {}) =>
    new ClickScheduler({ now: () => t, onTick: (k) => ticks.push(k) }, { ...base, ...s })
  /** Advance the audio clock and the interval timer together, like real time. */
  const advance = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / 0.025); i++) {
      t += 0.025
      vi.advanceTimersByTime(25)
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    t = 0
    ticks.length = 0
  })
  afterEach(() => vi.useRealTimers())

  it('clicks at exactly 60/bpm seconds apart, with no drift over a minute', () => {
    const m = make({ bpm: 100 })
    m.start()
    advance(60)
    m.stop()
    const gaps = ticks.slice(1).map((k, i) => k.time - ticks[i].time)
    expect(gaps.every((g) => Math.abs(g - 0.6) < 1e-9)).toBe(true)
    // ~100 clicks in a minute
    expect(ticks.length).toBeGreaterThanOrEqual(100)
    expect(ticks.length).toBeLessThanOrEqual(102)
  })

  it('accents beat 1 and counts the bar', () => {
    const m = make({ beatsPerBar: 3 })
    m.start()
    advance(3.2)
    m.stop()
    expect(ticks.slice(0, 7).map((k) => `${k.beat}:${k.kind}`)).toEqual([
      '0:accent', '1:beat', '2:beat', '0:accent', '1:beat', '2:beat', '0:accent',
    ])
  })

  it('can turn the accent off', () => {
    const m = make({ accentFirst: false })
    m.start()
    advance(2.1)
    m.stop()
    expect(ticks.every((k) => k.kind === 'beat')).toBe(true)
  })

  it('subdivides: 4 clicks per beat for sixteenths, soft except the beat itself', () => {
    const m = make({ bpm: 60, subdivision: 4, beatsPerBar: 2 })
    m.start()
    advance(2.1)
    m.stop()
    expect(ticks.slice(0, 5).map((k) => k.kind)).toEqual(['accent', 'sub', 'sub', 'sub', 'beat'])
    expect(ticks[1].time - ticks[0].time).toBeCloseTo(0.25, 9)
  })

  it('triplets are three equal clicks per beat', () => {
    const m = make({ bpm: 90, subdivision: 3 })
    m.start()
    advance(2)
    m.stop()
    const gap = 60 / 90 / 3
    expect(ticks[1].time - ticks[0].time).toBeCloseTo(gap, 9)
    expect(ticks[3].time - ticks[0].time).toBeCloseTo(60 / 90, 9)
  })

  it('applies a tempo change to later clicks without a glitch', () => {
    const m = make({ bpm: 60 })
    m.start()
    advance(3)
    m.update({ bpm: 120 })
    advance(3)
    m.stop()
    const gaps = ticks.slice(1).map((k, i) => +(k.time - ticks[i].time).toFixed(6))
    expect(Math.min(...gaps)).toBeCloseTo(0.5, 6)
    expect(Math.max(...gaps)).toBeCloseTo(1, 6)
    // only one transition: slow gaps then fast gaps, never back and forth
    const flips = gaps.filter((g, i) => i && g !== gaps[i - 1]).length
    expect(flips).toBeLessThanOrEqual(2)
  })

  it('shrinking the bar mid-count never leaves the beat out of range', () => {
    const m = make({ beatsPerBar: 7 })
    m.start()
    advance(2.8)
    m.update({ beatsPerBar: 3 })
    advance(3)
    m.stop()
    expect(ticks.every((k) => k.beat < 7)).toBe(true)
    expect(ticks.slice(-6).every((k) => k.beat < 3)).toBe(true)
  })

  it('stops cleanly and does not double-start', () => {
    const m = make()
    m.start()
    m.start()
    advance(1)
    const n = ticks.length
    m.stop()
    advance(2)
    expect(ticks.length).toBe(n)
    expect(m.running).toBe(false)
  })

  it('never schedules in the past', () => {
    const m = make({ bpm: 300, subdivision: 4 })
    m.start()
    t = 0
    advance(2)
    m.stop()
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks[0].time).toBeGreaterThan(0)
  })
})

describe('tempo helpers', () => {
  it('clamps and rounds bpm', () => {
    expect(clampBpm(5)).toBe(30)
    expect(clampBpm(999)).toBe(300)
    expect(clampBpm(97.6)).toBe(98)
  })

  it('tap tempo: steady taps', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120)
    expect(bpmFromTaps([0, 1000])).toBe(60)
  })
  it('tap tempo: one sloppy tap does not skew the median', () => {
    expect(bpmFromTaps([0, 500, 1000, 1700, 2200, 2700])).toBe(120)
  })
  it('tap tempo: needs two taps', () => expect(bpmFromTaps([0])).toBeNull())
  it('tap tempo: a pause starts a new count, and only 8 taps are kept', () => {
    expect(addTap([0, 500], 5000)).toEqual([5000])
    let taps: number[] = []
    for (let i = 0; i < 12; i++) taps = addTap(taps, i * 400)
    expect(taps).toHaveLength(8)
  })
})

describe('three clean passes before raising the tempo', () => {
  it('bumps on the third clean pass in a row, then restarts the count', () => {
    let s = { bpm: 80, clean: 0 }
    let r = cleanPass(s, 5)
    expect(r).toEqual({ bpm: 80, clean: 1, bumped: false })
    r = cleanPass(r, 5)
    expect(r).toEqual({ bpm: 80, clean: 2, bumped: false })
    r = cleanPass(r, 5)
    expect(r).toEqual({ bpm: 85, clean: 0, bumped: true })
  })
  it('a missed pass resets the streak', () => {
    const s = missedPass({ bpm: 80, clean: 2 })
    expect(s).toEqual({ bpm: 80, clean: 0 })
    expect(cleanPass(s, 5).bumped).toBe(false)
  })
  it('never exceeds the maximum tempo', () => {
    const r = cleanPass({ bpm: 298, clean: 2 }, 5)
    expect(r.bpm).toBe(300)
    expect(cleanPass({ bpm: 300, clean: 2 }, 5)).toMatchObject({ bpm: 300, bumped: false })
  })
})
