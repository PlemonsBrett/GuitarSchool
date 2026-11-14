import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addTap,
  bpmFromTaps,
  clampBpm,
  ClickScheduler,
  cleanPass,
  MAX_BPM,
  MIN_BPM,
  missedPass,
  PASSES_NEEDED,
  playClick,
  type Tick,
} from '~/lib/audio/metronome'

type Saved = { bpm: number; beats: number; sub: 1 | 2 | 3 | 4; accent: boolean; volume: number; step: number }
const DEFAULTS: Saved = { bpm: 80, beats: 4, sub: 1, accent: true, volume: 0.8, step: 5 }

const SUBS: { v: 1 | 2 | 3 | 4; label: string }[] = [
  { v: 1, label: 'Quarter ♩' },
  { v: 2, label: 'Eighths ♫' },
  { v: 3, label: 'Triplets' },
  { v: 4, label: 'Sixteenths' },
]

function tempoName(bpm: number) {
  return bpm < 60 ? 'Largo' : bpm < 76 ? 'Adagio' : bpm < 108 ? 'Andante' : bpm < 120 ? 'Moderato' : bpm < 156 ? 'Allegro' : bpm < 176 ? 'Vivace' : 'Presto'
}

function load(key: string): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

/**
 * Metronome with accent, subdivisions, tap tempo, and the "raise the tempo only after 3 clean passes" tracker.
 * Settings persist per `storageKey` in this browser.
 */
export function Metronome({
  initialBpm,
  compact = false,
  hotkeys = false,
  storageKey = 'gs:metronome',
}: {
  initialBpm?: number
  compact?: boolean
  /** Space starts/stops, arrows nudge the tempo. Off when embedded next to other controls. */
  hotkeys?: boolean
  storageKey?: string
}) {
  const [bpm, setBpm] = useState(initialBpm ?? DEFAULTS.bpm)
  const [beats, setBeats] = useState(DEFAULTS.beats)
  const [sub, setSub] = useState<1 | 2 | 3 | 4>(DEFAULTS.sub)
  const [accent, setAccent] = useState(DEFAULTS.accent)
  const [volume, setVolume] = useState(DEFAULTS.volume)
  const [step, setStep] = useState(DEFAULTS.step)
  const [goal, setGoal] = useState('')
  const [clean, setClean] = useState(0)
  const [message, setMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ctxRef = useRef<AudioContext | null>(null)
  const schedRef = useRef<ClickScheduler | null>(null)
  const volumeRef = useRef(volume)
  const tapsRef = useRef<number[]>([])
  const timeouts = useRef(new Set<ReturnType<typeof setTimeout>>())
  const [hydrated, setHydrated] = useState(false)

  volumeRef.current = volume

  // Restore saved settings after mount (not during render, so server and client markup match).
  useEffect(() => {
    const s = load(storageKey)
    if (s.bpm && initialBpm == null) setBpm(clampBpm(s.bpm))
    if (s.beats) setBeats(s.beats)
    if (s.sub) setSub(s.sub)
    if (typeof s.accent === 'boolean') setAccent(s.accent)
    if (typeof s.volume === 'number') setVolume(s.volume)
    if (s.step) setStep(s.step)
    // Only after the restored values have been applied may the save effect run; otherwise it would
    // write the defaults over what we just read.
    setHydrated(true)
  }, [storageKey, initialBpm])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ bpm, beats, sub, accent, volume, step }))
    } catch {
      /* private mode: settings just won't persist */
    }
  }, [hydrated, bpm, beats, sub, accent, volume, step, storageKey])

  // Keep a running scheduler in sync; changes take effect on the next click.
  useEffect(() => {
    schedRef.current?.update({ bpm, beatsPerBar: beats, subdivision: sub, accentFirst: accent })
  }, [bpm, beats, sub, accent])

  const stop = useCallback(() => {
    schedRef.current?.stop()
    timeouts.current.forEach(clearTimeout)
    timeouts.current.clear()
    setRunning(false)
    setActive(null)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const ctx = ctxRef.current ?? new AudioContext()
      ctxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()
      const onTick = (t: Tick) => {
        playClick(ctx, t.time, t.kind, volumeRef.current)
        if (t.sub === 0) {
          // Flash the beat dot when the click actually sounds, not when it was scheduled.
          const id = setTimeout(() => {
            timeouts.current.delete(id)
            setActive(t.beat)
          }, Math.max(0, (t.time - ctx.currentTime) * 1000))
          timeouts.current.add(id)
        }
      }
      const sched = new ClickScheduler({ now: () => ctx.currentTime, onTick }, { bpm, beatsPerBar: beats, subdivision: sub, accentFirst: accent })
      schedRef.current = sched
      sched.start()
      setRunning(true)
    } catch {
      setError('Could not start audio. Check that your browser allows sound for this page.')
    }
  }, [bpm, beats, sub, accent])

  const toggle = useCallback(() => (running ? stop() : void start()), [running, start, stop])

  useEffect(
    () => () => {
      schedRef.current?.stop()
      timeouts.current.forEach(clearTimeout)
      void ctxRef.current?.close()
    },
    [],
  )

  useEffect(() => {
    if (!hotkeys) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, button, [contenteditable]')) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowRight') setBpm((b) => clampBpm(b + (e.shiftKey ? 5 : 1)))
      else if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') setBpm((b) => clampBpm(b - (e.shiftKey ? 5 : 1)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkeys, toggle])

  const tap = () => {
    tapsRef.current = addTap(tapsRef.current, performance.now())
    const t = bpmFromTaps(tapsRef.current)
    if (t) setBpm(t)
  }

  const goalN = Number(goal) || 0
  const goalReached = goalN > 0 && bpm >= goalN
  const nudge = (d: number) => setBpm((b) => clampBpm(b + d))

  const passClean = () => {
    const r = cleanPass({ bpm, clean }, step, goalN > 0 ? Math.min(goalN, MAX_BPM) : MAX_BPM)
    setBpm(r.bpm)
    setClean(r.clean)
    setMessage(r.bumped ? `${PASSES_NEEDED} clean passes in a row. Tempo up to ${r.bpm} bpm.` : '')
  }
  const passMissed = () => {
    setClean(missedPass({ bpm, clean }).clean)
    setMessage('No problem. Reset the count and go again at this tempo.')
  }

  const btn = 'rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50'

  return (
    <div className={`rounded-xl border border-line bg-surface ${compact ? 'p-3' : 'p-5'}`}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className={btn} onClick={() => nudge(-5)} aria-label="Slower by 5">−5</button>
        <button type="button" className={btn} onClick={() => nudge(-1)} aria-label="Slower by 1">−1</button>
        <div className="mx-2 text-center">
          <label className="sr-only" htmlFor={`${storageKey}-bpm`}>Beats per minute</label>
          <input
            id={`${storageKey}-bpm`}
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(e) => e.target.value !== '' && setBpm(clampBpm(Number(e.target.value)))}
            className={`w-28 bg-transparent text-center font-bold tabular-nums outline-none ${compact ? 'text-4xl' : 'text-6xl'}`}
          />
          <p className="text-xs text-muted">bpm{!compact && ` · ${tempoName(bpm)}`}</p>
        </div>
        <button type="button" className={btn} onClick={() => nudge(1)} aria-label="Faster by 1">+1</button>
        <button type="button" className={btn} onClick={() => nudge(5)} aria-label="Faster by 5">+5</button>
      </div>

      <input
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        onChange={(e) => setBpm(Number(e.target.value))}
        aria-label="Tempo"
        className="mt-3 w-full accent-[var(--color-accent)]"
      />

      <div className="mt-3 flex items-center justify-center gap-2" aria-hidden="true">
        {Array.from({ length: beats }, (_, i) => (
          <span
            key={i}
            className={`size-4 rounded-full border transition-colors ${
              running && active === i ? (i === 0 && accent ? 'border-accent bg-accent' : 'border-text bg-text') : 'border-line'
            }`}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={running}
          className="min-w-28 rounded-md bg-accent px-5 py-2 font-semibold text-accent-ink"
        >
          {running ? '■ Stop' : '▶ Start'}
        </button>
        <button type="button" onClick={tap} className={btn}>Tap tempo</button>
      </div>
      {error && <p role="alert" className="mt-2 text-center text-sm text-red-500">{error}</p>}
      {hotkeys && <p className="mt-2 text-center text-xs text-muted">Space starts and stops. Arrow keys nudge the tempo (Shift for 5).</p>}

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <label className="block">
          <span className="font-medium">Beats per bar</span>
          <select value={beats} onChange={(e) => setBeats(Number(e.target.value))} className="mt-1 block w-full rounded-md border border-line bg-bg px-2 py-1.5">
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-medium">Click every</span>
          <select value={sub} onChange={(e) => setSub(Number(e.target.value) as 1 | 2 | 3 | 4)} className="mt-1 block w-full rounded-md border border-line bg-bg px-2 py-1.5">
            {SUBS.map((s) => (
              <option key={s.v} value={s.v}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-medium">Volume</span>
          <input type="range" min={0.1} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="mt-2 block w-full accent-[var(--color-accent)]" />
        </label>
        <label className="flex items-center gap-2 sm:col-span-3">
          <input type="checkbox" checked={accent} onChange={(e) => setAccent(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          Accent beat 1
        </label>
      </div>

      <section className="mt-5 rounded-lg border border-line bg-bg p-3" aria-label="Clean pass tracker">
        <h3 className="text-sm font-semibold">Earn the next tempo</h3>
        <p className="text-xs text-muted">
          Play your drill through. Raise the tempo only after {PASSES_NEEDED} clean passes in a row.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="flex gap-1.5" role="img" aria-label={`${clean} of ${PASSES_NEEDED} clean passes`}>
            {Array.from({ length: PASSES_NEEDED }, (_, i) => (
              <span key={i} className={`size-4 rounded-full border ${i < clean ? 'border-ok bg-ok' : 'border-line'}`} />
            ))}
          </span>
          <button type="button" className={`${btn} border-ok/60 text-ok`} onClick={passClean} disabled={goalReached}>✓ Clean pass</button>
          <button type="button" className={btn} onClick={passMissed}>✗ Missed</button>
        </div>
        {!compact && (
          <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
            <label className="block">
              <span className="text-xs text-muted">Raise by</span>
              <select value={step} onChange={(e) => setStep(Number(e.target.value))} className="mt-1 block rounded-md border border-line bg-bg px-2 py-1">
                {[2, 5, 10].map((n) => (
                  <option key={n} value={n}>{n} bpm</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted">Goal tempo (optional)</span>
              <input
                type="number"
                min={MIN_BPM}
                max={MAX_BPM}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. 120"
                className="mt-1 block w-28 rounded-md border border-line bg-bg px-2 py-1"
              />
            </label>
          </div>
        )}
        {goalReached && <p role="status" className="mt-2 text-sm text-ok">Goal tempo reached. Log it in your practice notes.</p>}
        {message && !goalReached && <p role="status" className="mt-2 text-sm">{message}</p>}
      </section>
    </div>
  )
}
