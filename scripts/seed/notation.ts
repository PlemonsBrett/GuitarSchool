import type { ChordId } from './chords'

/**
 * Notation is authored in alphaTex (https://alphatab.net/docs/alphatex), rendered as standard notation + tab.
 * String numbers follow tab convention: 1 = high E ... 6 = low E. A note is `fret.string`.
 * Everything here is an original exercise or a standard scale/chord shape. We do not transcribe copyrighted songs.
 */
export type Notation = { title: string; tex: string; caption?: string }
export type ItemMedia = { chords?: ChordId[]; chordNote?: string; notation?: Notation[] }

/** Split a flat list of beats into bars of `perBar` beats. */
function bars(beats: string[], perBar: number): string {
  const out: string[] = []
  for (let i = 0; i < beats.length; i += perBar) out.push(beats.slice(i, i + perBar).join(' '))
  return out.join(' |\n')
}

// No \\title: the card around the notation already names it.
const header = (tempo: number) => `\\tempo ${tempo}\n.\n`
/** Chord beat: list of `fret.string`, with a property applied to every note. */
const chord = (notes: string[], prop = '') => `(${notes.map((n) => (prop ? `${n}{${prop}}` : n)).join(' ')})`

// --- Spider: frets 1-2-3-4 across all strings -------------------------------------------------
const spiderUp = [6, 5, 4, 3, 2, 1].flatMap((s) => [1, 2, 3, 4].map((f) => `${f}.${s}`))
const spiderDown = [1, 2, 3, 4, 5, 6].flatMap((s) => [4, 3, 2, 1].map((f) => `${f}.${s}`))
const spider = `${header(60)}:8\n${bars([...spiderUp, ...spiderDown], 8)}`

// --- Downstrokes: open A string, quarter notes ------------------------------------------------
const downstrokes = `${header(60)}:4\n${bars(Array(8).fill('0.5{sd}'), 4)}`

// --- Down-up strumming on D (count: 1 & 2 & 3 & 4 &) ------------------------------------------
const D = ['0.4', '2.3', '3.2', '2.1']
const strumBar = [
  `${chord(D)}{sd}`, 'r', `${chord(D)}{sd}`, `${chord(D)}{su}`,
  'r', `${chord(D)}{su}`, `${chord(D)}{sd}`, `${chord(D)}{su}`,
]
const strumming = `${header(80)}:8\n${bars([...strumBar, ...strumBar], 8)}`

// --- Power chords, palm muted then open -------------------------------------------------------
const E5 = ['0.6', '2.5']
const A5 = ['0.5', '2.4']
const D5 = ['0.4', '2.3']
const progression = [E5, A5, D5, A5]
const powerBeats = [
  ...progression.flatMap((c) => Array(8).fill(chord(c, 'pm'))),
  ...progression.flatMap((c) => Array(4).fill(chord(c))),
]
const power = `${header(90)}:8\n${bars(
  powerBeats.slice(0, 32),
  8,
)} |\n:4\n${bars(powerBeats.slice(32), 4)}`

// --- A minor pentatonic boxes -----------------------------------------------------------------
type Box = [number, number][] // per string, low to high: [fret, fret]
const box1: Box = [[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]]
const box2: Box = [[8, 10], [7, 10], [7, 10], [7, 9], [8, 10], [8, 10]]
function boxTex(box: Box) {
  const up = box.flatMap(([a, b], i) => [`${a}.${6 - i}`, `${b}.${6 - i}`])
  const down = [...up].reverse()
  return `${header(70)}:8\n${bars([...up, ...down], 8)}`
}

// --- Hammer-ons, pull-offs, slides ------------------------------------------------------------
const hpsl = `${header(60)}:8
${Array(4).fill('5.3{h} 7.3').join(' ')} |
${Array(4).fill('7.3{h} 5.3').join(' ')} |
:4 5.3{sl} 7.3 7.3{sl} 5.3`

// --- Bends and vibrato (bend values are quarter-tones: 2 = half step, 4 = whole step) ----------
const bends = `${header(60)}:4
8.2{b (0 2)} 8.2 8.2{b (0 2)} 8.2 |
7.3{b (0 4)} 7.3 7.3{b (0 4)} 7.3 |
7.3{v} 7.3{v} 7.3{v} 7.3{v}`

// --- 12-bar blues shuffle in A (root on the 5th string) ---------------------------------------
const shuffleBar = (rootFret: number) => {
  const five = chord([`${rootFret}.5`, `${rootFret + 2}.4`])
  const six = chord([`${rootFret}.5`, `${rootFret + 4}.4`])
  return Array(4).fill(`${five} ${six}`).join(' ')
}
const A_ = shuffleBar(0), D_ = shuffleBar(5), E_ = shuffleBar(7)
const shuffle = `${header(100)}:8
${[A_, A_, A_, A_, D_, D_, A_, A_, E_, D_, A_, E_].join(' |\n')}`

// --- Alternate picking, 16ths -----------------------------------------------------------------
const pick = (frets: number[], string: number, reps: number) =>
  Array.from({ length: reps }).flatMap((_, r) =>
    frets.map((f, i) => `${f}.${string}{${(r * frets.length + i) % 2 === 0 ? 'sd' : 'su'}}`),
  )
const altPicking = `${header(80)}:16\n${bars(
  [...pick([5, 6, 7, 8], 3, 4), ...pick([5, 6, 7, 8], 2, 4)],
  16,
)}`

// --- Legato run: hammer-on then pull-off on each string of pentatonic box 1 -------------------
const legatoRun = `${header(70)}:16
5.4{h} 7.4{h} 5.4 5.3{h} 7.3{h} 5.3 5.2{h} 8.2{h} 5.2 5.1{h} 8.1{h} 5.1 r r r r`

// --- C major scale, open position -------------------------------------------------------------
const cUp = ['3.5', '0.4', '2.4', '3.4', '0.3', '2.3', '0.2', '1.2']
const cDown = ['1.2', '0.2', '2.3', '0.3', '3.4', '2.4', '0.4', '3.5']
const cMajor = `${header(70)}:8\n${bars([...cUp, ...cDown], 8)}`

// --- C major triads on the top three strings --------------------------------------------------
const triad = (a: string, b: string, c: string) => `${chord([a, b, c])}`
const triads = `${header(60)}:2
${triad('5.3', '5.2', '3.1')} ${triad('5.3', '5.2', '3.1')} |
${triad('9.3', '8.2', '8.1')} ${triad('9.3', '8.2', '8.1')} |
${triad('12.3', '13.2', '12.1')} ${triad('12.3', '13.2', '12.1')}`

export const media: Record<string, ItemMedia> = {
  spider: {
    notation: [{ title: 'Spider drill', tex: spider, caption: 'One finger per fret: 1-2-3-4. Up the strings, then back down.' }],
  },
  'open-chords': { chords: ['Em', 'Am', 'E', 'A', 'D', 'G', 'C'] },
  'one-minute-changes': { chords: ['G', 'C', 'D', 'Em'], chordNote: 'Cycle G to C to D to Em and count clean switches.' },
  'steady-downstrokes': {
    notation: [{ title: 'Steady downstrokes', tex: downstrokes, caption: 'Every note is a downstroke. Stay locked to the click.' }],
  },
  'down-up-strumming': {
    chords: ['D'],
    notation: [{ title: 'Strumming pattern', tex: strumming, caption: 'Keep your hand moving down-up the whole time, even on the rests.' }],
  },
  'power-chords': {
    chords: ['E5', 'A5', 'D5'],
    notation: [{ title: 'Power chords', tex: power, caption: 'Bars 1-4 are palm muted eighth notes, bars 5-8 open quarter notes.' }],
  },
  'easy-barre-chords': { chords: ['F', 'Bm'] },
  'minor-pentatonic': {
    notation: [
      { title: 'A minor pentatonic, box 1 (5th fret)', tex: boxTex(box1) },
      { title: 'A minor pentatonic, box 2 (7th fret)', tex: boxTex(box2) },
    ],
  },
  'hammer-pull-slide': {
    notation: [{ title: 'Hammer-ons, pull-offs, slides', tex: hpsl, caption: 'Pick only the first note of each slur.' }],
  },
  'bends-vibrato': {
    notation: [{ title: 'Bends and vibrato', tex: bends, caption: 'Fret the target note first and listen to it, then bend until the pitches match.' }],
  },
  'twelve-bar-shuffle': {
    notation: [{ title: '12-bar shuffle in A', tex: shuffle, caption: 'Play the eighth notes with a swing feel, long-short.' }],
  },
  'major-scale-caged': {
    chords: ['C', 'A', 'G', 'E', 'D'],
    chordNote: 'The five CAGED open shapes. Each one can move up the neck as a barre chord.',
    notation: [{ title: 'C major scale, open position', tex: cMajor }],
  },
  'triads-inversions': {
    notation: [{ title: 'C major triads: root, 1st and 2nd inversion', tex: triads, caption: 'Same three notes, three places on the neck.' }],
  },
  'alternate-picking': {
    notation: [{ title: 'Alternate picking, 16th notes', tex: altPicking, caption: 'Start at 80 bpm. Raise it only after 3 clean passes.' }],
  },
  'legato-runs': {
    notation: [{ title: 'Legato run', tex: legatoRun, caption: 'Only the first note on each string is picked.' }],
  },
  // Chord shapes only: not the arrangement, which is covered by the linked tabs.
  'knockin-on-heavens-door': { chords: ['G', 'D', 'Am', 'C'], chordNote: 'Chord shapes used. Rhythm and arrangement are in the linked tab.' },
  'brown-eyed-girl': { chords: ['G', 'C', 'D', 'Em'], chordNote: 'Chord shapes used. Rhythm and arrangement are in the linked tab.' },
  'sweet-home-alabama': { chords: ['D', 'C', 'G'], chordNote: 'Chord shapes used. Rhythm and arrangement are in the linked tab.' },
}
