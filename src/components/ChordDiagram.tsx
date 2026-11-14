import type { Chord } from '~/content/chords'

const STRINGS = 6
const FRETS = 5
const W = 100
const H = 128
const L = 20 // left margin to first string
const R = 84
const T = 34
const B = 118
const sx = (i: number) => L + (i * (R - L)) / (STRINGS - 1) // i: 0 = low E
const fy = (f: number) => T + (f * (B - T)) / FRETS // f: 0 = nut line

const STRING_NAMES = ['low E', 'A', 'D', 'G', 'B', 'high E']

function describe(c: Chord) {
  const parts = c.frets.map((f, i) => `${STRING_NAMES[i]} ${f < 0 ? 'muted' : f === 0 ? 'open' : `fret ${f}`}`)
  return `${c.name} chord: ${parts.join(', ')}`
}

/** SVG chord box. Low E on the left. Scales with its container. */
export function ChordDiagram({ chord }: { chord: Chord }) {
  const fretted = chord.frets.filter((f) => f > 0)
  const maxFret = Math.max(0, ...fretted)
  const base = maxFret <= FRETS ? 1 : Math.min(...fretted)
  const row = (f: number) => f - base + 0.5 // centre of the fret space

  return (
    <figure className="w-24 text-center">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(chord)} className="w-full">
        <text x={W / 2} y={12} textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">
          {chord.name}
        </text>

        {/* nut (thick) or position marker */}
        {base === 1 ? (
          <line x1={L} x2={R} y1={T} y2={T} stroke="currentColor" strokeWidth="3.5" />
        ) : (
          <text x={L - 6} y={fy(0.5) + 3} textAnchor="end" fontSize="9" fill="currentColor">
            {base}fr
          </text>
        )}

        {/* frets */}
        {Array.from({ length: FRETS + 1 }, (_, f) =>
          f === 0 && base === 1 ? null : (
            <line key={f} x1={L} x2={R} y1={fy(f)} y2={fy(f)} stroke="var(--color-line)" strokeWidth="1" />
          ),
        )}
        {/* strings */}
        {Array.from({ length: STRINGS }, (_, i) => (
          <line key={i} x1={sx(i)} x2={sx(i)} y1={T} y2={B} stroke="var(--color-muted)" strokeWidth="1" />
        ))}

        {/* open / muted markers */}
        {chord.frets.map((f, i) =>
          f === 0 ? (
            <circle key={i} cx={sx(i)} cy={T - 9} r="3.2" fill="none" stroke="currentColor" strokeWidth="1" />
          ) : f < 0 ? (
            <text key={i} x={sx(i)} y={T - 6} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
              ×
            </text>
          ) : null,
        )}

        {/* barre */}
        {chord.barre && (
          <rect
            x={sx(STRINGS - chord.barre.from) - 4.5}
            y={fy(row(chord.barre.fret)) - 4.5}
            width={sx(STRINGS - chord.barre.to) - sx(STRINGS - chord.barre.from) + 9}
            height="9"
            rx="4.5"
            fill="var(--color-accent)"
          />
        )}

        {/* finger dots */}
        {chord.frets.map((f, i) =>
          f > 0 ? (
            <g key={i}>
              {!(chord.barre && f === chord.barre.fret && chord.fingers[i] === 1) && (
                <circle cx={sx(i)} cy={fy(row(f))} r="5" fill="var(--color-accent)" />
              )}
              {chord.fingers[i] > 0 && !(chord.barre && f === chord.barre.fret && chord.fingers[i] === 1 && STRINGS - i !== chord.barre.from) && (
                <text x={sx(i)} y={fy(row(f)) + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--color-accent-ink)">
                  {chord.fingers[i]}
                </text>
              )}
            </g>
          ) : null,
        )}
      </svg>
    </figure>
  )
}
