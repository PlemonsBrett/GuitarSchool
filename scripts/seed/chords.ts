/** Fingering: 6 entries, low E to high E. -1 = muted, 0 = open, n = fret. */
export type Chord = {
  name: string
  frets: [number, number, number, number, number, number]
  /** Finger per string (1 = index ... 4 = pinky), 0 = none. */
  fingers: [number, number, number, number, number, number]
  /** Barre across strings (6 = low E ... 1 = high E) at a fret. */
  barre?: { fret: number; from: number; to: number }
}

export const chords = {
  Em: { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Am: { name: 'Am', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  E: { name: 'E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  A: { name: 'A', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  D: { name: 'D', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  G: { name: 'G', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  C: { name: 'C', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  F: { name: 'F', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, from: 6, to: 1 } },
  Bm: { name: 'Bm', frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, from: 5, to: 1 } },
  E5: { name: 'E5', frets: [0, 2, -1, -1, -1, -1], fingers: [0, 1, 0, 0, 0, 0] },
  A5: { name: 'A5', frets: [-1, 0, 2, -1, -1, -1], fingers: [0, 0, 1, 0, 0, 0] },
  D5: { name: 'D5', frets: [-1, -1, 0, 2, -1, -1], fingers: [0, 0, 0, 1, 0, 0] },
} satisfies Record<string, Chord>

export type ChordId = keyof typeof chords
