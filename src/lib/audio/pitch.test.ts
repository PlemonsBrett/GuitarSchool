import { describe, expect, it } from 'vitest'
import { centsBetween, detectPitch, median, midiToFreq, nearestString, noteName, TUNINGS } from './pitch'

const SR = 48000

/** Synthetic guitar-ish tone: fundamental plus harmonics with given relative amplitudes. */
function tone(freq: number, harmonics = [1, 0.5, 0.3, 0.2], n = 4096, amp = 0.3): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let v = 0
    harmonics.forEach((a, h) => (v += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / SR)))
    out[i] = (v * amp) / harmonics.reduce((s, a) => s + a, 0)
  }
  return out
}

describe('detectPitch', () => {
  const standard = TUNINGS[0].notes.map((m) => midiToFreq(m))

  it.each(standard.map((f, i) => [['E2', 'A2', 'D3', 'G3', 'B3', 'E4'][i], f] as const))(
    'finds open string %s (%f Hz) within 1 cent',
    (_, f) => {
      const p = detectPitch(tone(f), SR)!
      expect(p).not.toBeNull()
      expect(Math.abs(centsBetween(p.freq, f))).toBeLessThan(1)
      expect(p.clarity).toBeGreaterThan(0.9)
    },
  )

  it('is not fooled when the 2nd harmonic is louder than the fundamental (typical low E)', () => {
    const f = midiToFreq(40)
    const p = detectPitch(tone(f, [0.4, 1, 0.6, 0.3]), SR)!
    expect(Math.abs(centsBetween(p.freq, f))).toBeLessThan(2) // no octave jump
  })

  it('reports sharp and flat accurately (±20 cents)', () => {
    const target = midiToFreq(45)
    for (const off of [-20, -7, 7, 20]) {
      const f = target * 2 ** (off / 1200)
      const p = detectPitch(tone(f), SR)!
      expect(centsBetween(p.freq, f)).toBeCloseTo(0, 0)
      expect(centsBetween(p.freq, target)).toBeCloseTo(off, 0)
    }
  })

  it('works at 44.1 kHz too', () => {
    const f = midiToFreq(50)
    const buf = new Float32Array(4096).map((_, i) => 0.3 * Math.sin((2 * Math.PI * f * i) / 44100))
    expect(Math.abs(centsBetween(detectPitch(buf, 44100)!.freq, f))).toBeLessThan(1)
  })

  it('returns null for silence and faint room noise', () => {
    expect(detectPitch(new Float32Array(4096), SR)).toBeNull()
    const noise = new Float32Array(4096).map(() => (Math.random() - 0.5) * 0.004)
    expect(detectPitch(noise, SR)).toBeNull()
  })

  it('returns null for loud unpitched noise', () => {
    const noise = new Float32Array(4096).map(() => (Math.random() - 0.5) * 0.6)
    expect(detectPitch(noise, SR)).toBeNull()
  })
})

describe('notes and tunings', () => {
  it('names notes', () => {
    expect(noteName(40)).toEqual({ name: 'E', octave: 2 })
    expect(noteName(69)).toEqual({ name: 'A', octave: 4 })
    expect(noteName(61)).toEqual({ name: 'C♯', octave: 4 })
  })
  it('midiToFreq matches A440 and E2', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 5)
    expect(midiToFreq(40)).toBeCloseTo(82.407, 2)
  })
  it('nearestString picks the string and signs cents', () => {
    const std = TUNINGS[0]
    const m = nearestString(midiToFreq(45) * 2 ** (10 / 1200), std)
    expect(m.index).toBe(1)
    expect(m.cents).toBeCloseTo(10, 3)
    expect(nearestString(midiToFreq(59) * 2 ** (-15 / 1200), std).cents).toBeCloseTo(-15, 3)
  })
  it('drop D lowers only the 6th string', () => {
    expect(TUNINGS[1].notes[0]).toBe(TUNINGS[0].notes[0] - 2)
    expect(TUNINGS[1].notes.slice(1)).toEqual(TUNINGS[0].notes.slice(1))
    expect(nearestString(midiToFreq(38), TUNINGS[1]).index).toBe(0)
  })
  it('median ignores a single outlier', () => {
    expect(median([82, 82.4, 164, 82.2, 82.3])).toBeCloseTo(82.3, 5)
  })
})
