/**
 * Metronome timing. The classic "two clocks" design: a JS timer wakes up often, and each time schedules every
 * click that falls inside a short look-ahead window on the audio clock. setInterval jitter (tens of ms) never
 * reaches the listener because the clicks themselves are sample-accurate. Pure: the audio clock and the sound
 * are injected, so the timing is unit-tested without Web Audio.
 */

export const MIN_BPM = 30
export const MAX_BPM = 300
export const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))

export type TickKind = 'accent' | 'beat' | 'sub'
export type Tick = { time: number; beat: number; sub: number; kind: TickKind }

export type MetronomeSettings = {
  bpm: number
  beatsPerBar: number
  /** Clicks per beat: 1 quarter, 2 eighths, 3 triplets, 4 sixteenths. */
  subdivision: 1 | 2 | 3 | 4
  accentFirst: boolean
}

export type ClockDeps = {
  /** Audio clock in seconds (AudioContext.currentTime). */
  now: () => number
  onTick: (t: Tick) => void
}

const LOOKAHEAD = 0.12 // seconds scheduled ahead
const PUMP_MS = 25
const START_DELAY = 0.06

export class ClickScheduler {
  settings: MetronomeSettings
  private timer: ReturnType<typeof setInterval> | null = null
  private next = 0
  private beat = 0
  private sub = 0

  constructor(
    private deps: ClockDeps,
    settings: MetronomeSettings,
  ) {
    this.settings = { ...settings }
  }

  get running() {
    return this.timer !== null
  }

  /** Changes apply to the next click, so tempo changes never glitch or drift. */
  update(patch: Partial<MetronomeSettings>) {
    this.settings = { ...this.settings, ...patch }
    if (this.beat >= this.settings.beatsPerBar) this.beat = 0
    if (this.sub >= this.settings.subdivision) this.sub = 0
  }

  start() {
    if (this.timer) return
    this.next = this.deps.now() + START_DELAY
    this.beat = 0
    this.sub = 0
    this.pump()
    this.timer = setInterval(() => this.pump(), PUMP_MS)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private pump() {
    const { bpm, beatsPerBar, subdivision, accentFirst } = this.settings
    const horizon = this.deps.now() + LOOKAHEAD
    while (this.next < horizon) {
      const kind: TickKind = this.sub > 0 ? 'sub' : this.beat === 0 && accentFirst ? 'accent' : 'beat'
      this.deps.onTick({ time: this.next, beat: this.beat, sub: this.sub, kind })
      this.next += 60 / clampBpm(bpm) / subdivision
      if (++this.sub >= subdivision) {
        this.sub = 0
        this.beat = (this.beat + 1) % beatsPerBar
      }
    }
  }
}

/** One click: a short pitched blip. Accent is higher and louder, subdivisions are softer and lower. */
export function playClick(ctx: AudioContext, time: number, kind: TickKind, volume: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const [freq, level] = kind === 'accent' ? [1568, 1] : kind === 'beat' ? [1047, 0.7] : [784, 0.35]
  osc.frequency.value = freq
  osc.type = 'sine'
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(level * volume, time + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06)
  osc.connect(gain).connect(ctx.destination)
  osc.start(time)
  osc.stop(time + 0.08)
}

// ---- tap tempo ---------------------------------------------------------------------------------

/** BPM from tap timestamps (ms). Needs 2+ taps; uses the median interval so one sloppy tap doesn't skew it. */
export function bpmFromTaps(times: number[]): number | null {
  if (times.length < 2) return null
  const intervals = times.slice(1).map((t, i) => t - times[i])
  const sorted = [...intervals].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return median > 0 ? clampBpm(60000 / median) : null
}

/** Append a tap, forgetting old ones: a pause of 2s+ starts a new count; keep the last 8 taps. */
export function addTap(taps: number[], now: number): number[] {
  const kept = taps.length && now - taps[taps.length - 1] > 2000 ? [] : taps
  return [...kept, now].slice(-8)
}

// ---- "raise the tempo only after 3 clean passes" -------------------------------------------------

export type PassState = { bpm: number; clean: number }
export const PASSES_NEEDED = 3

/** A clean pass counts toward a tempo bump. Reaching 3 raises the tempo by `step` and restarts the count. */
export function cleanPass(s: PassState, step: number, max = MAX_BPM): PassState & { bumped: boolean } {
  const clean = s.clean + 1
  if (clean < PASSES_NEEDED) return { bpm: s.bpm, clean, bumped: false }
  return { bpm: Math.min(max, s.bpm + step), clean: 0, bumped: s.bpm < max }
}

/** A messy pass resets the streak: you only earn the faster tempo with three in a row. */
export const missedPass = (s: PassState): PassState => ({ bpm: s.bpm, clean: 0 })
