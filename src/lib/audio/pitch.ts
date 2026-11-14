/** Pitch detection (YIN) and note maths for the tuner. Pure functions: no Web Audio, so they are unit-tested. */

export type Pitch = { freq: number; clarity: number }

export type PitchOptions = {
  minFreq?: number
  maxFreq?: number
  /** YIN absolute threshold. Lower = stricter. */
  threshold?: number
  /** Ignore frames quieter than this RMS (room noise). */
  minRms?: number
}

/**
 * YIN pitch detector (de Cheveigné & Kawahara, 2002). Robust on guitar because it resists the
 * octave errors that plain autocorrelation makes when the 2nd harmonic is louder than the fundamental.
 * Returns null for silence or unpitched sound.
 */
export function detectPitch(buf: Float32Array, sampleRate: number, opts: PitchOptions = {}): Pitch | null {
  const { minFreq = 60, maxFreq = 1000, threshold = 0.15, minRms = 0.008 } = opts
  const n = buf.length

  let sum = 0
  for (let i = 0; i < n; i++) sum += buf[i] * buf[i]
  if (Math.sqrt(sum / n) < minRms) return null

  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(n / 2))
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq))
  const w = n - maxTau // samples summed per lag

  // Step 1-2: difference function, then cumulative mean normalised difference.
  const d = new Float32Array(maxTau + 1)
  for (let tau = 1; tau <= maxTau; tau++) {
    let acc = 0
    for (let j = 0; j < w; j++) {
      const diff = buf[j] - buf[j + tau]
      acc += diff * diff
    }
    d[tau] = acc
  }
  d[0] = 1
  let running = 0
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau]
    d[tau] = running === 0 ? 1 : (d[tau] * tau) / running
  }

  // Step 3: first dip under the threshold, then walk down to its local minimum.
  let tau = -1
  for (let t = minTau; t < maxTau; t++) {
    if (d[t] < threshold) {
      while (t + 1 < maxTau && d[t + 1] < d[t]) t++
      tau = t
      break
    }
  }
  if (tau === -1) return null

  // Step 4: parabolic interpolation for sub-sample accuracy (matters: 1 sample at 82 Hz is ~25 cents).
  let better = tau
  if (tau > 1 && tau < maxTau) {
    const s0 = d[tau - 1], s1 = d[tau], s2 = d[tau + 1]
    const denom = 2 * (s0 - 2 * s1 + s2)
    if (denom !== 0) better = tau + (s0 - s2) / denom
  }
  return { freq: sampleRate / better, clarity: 1 - d[tau] }
}

// ---- notes -------------------------------------------------------------------------------------

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

export const midiToFreq = (midi: number, a4 = 440) => a4 * 2 ** ((midi - 69) / 12)
export const freqToMidi = (freq: number, a4 = 440) => 69 + 12 * Math.log2(freq / a4)
/** Signed distance in cents from `target` to `freq`. */
export const centsBetween = (freq: number, target: number) => 1200 * Math.log2(freq / target)

export function noteName(midi: number): { name: string; octave: number } {
  return { name: NAMES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1 }
}

export type Tuning = { id: string; name: string; /** MIDI notes, low string to high */ notes: number[] }

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: 'Standard (E A D G B E)', notes: [40, 45, 50, 55, 59, 64] },
  { id: 'drop-d', name: 'Drop D (D A D G B E)', notes: [38, 45, 50, 55, 59, 64] },
  { id: 'half-down', name: 'Half step down (E♭ A♭ D♭ G♭ B♭ E♭)', notes: [39, 44, 49, 54, 58, 63] },
  { id: 'dadgad', name: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
]

export type StringMatch = { index: number; midi: number; target: number; cents: number }

/** Which string of `tuning` is `freq` closest to, and how many cents off is it. */
export function nearestString(freq: number, tuning: Tuning, a4 = 440): StringMatch {
  let best: StringMatch | null = null
  tuning.notes.forEach((midi, index) => {
    const target = midiToFreq(midi, a4)
    const cents = centsBetween(freq, target)
    if (!best || Math.abs(cents) < Math.abs(best.cents)) best = { index, midi, target, cents }
  })
  return best!
}

/** Median of recent readings: kills the occasional octave jump without adding much lag. */
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
