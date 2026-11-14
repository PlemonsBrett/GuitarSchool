import type { AlphaTabApi } from '@coderline/alphatab'
import { useEffect, useState } from 'react'
import { Notation } from './Notation'

const SPEEDS = [25, 40, 50, 60, 70, 75, 80, 90, 100, 110, 125]

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Notation with optional playback. Playback is opt-in because it downloads the 1.3 MB soundfont,
 * and it is the practice tool: slow it down, loop a section, count in, play along with a click.
 */
export function TabViewer({
  tex,
  fileUrl,
  data,
  defaultPlayer = false,
}: {
  tex?: string | null
  fileUrl?: string | null
  data?: Uint8Array | null
  defaultPlayer?: boolean
}) {
  const [playerOn, setPlayerOn] = useState(defaultPlayer)
  const [api, setApi] = useState<AlphaTabApi | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(100)
  const [loop, setLoop] = useState(false)
  const [click, setClick] = useState(false)
  const [countIn, setCountIn] = useState(false)
  const [volume, setVolume] = useState(0.9)
  const [pos, setPos] = useState({ cur: 0, end: 0 })
  const [tempo, setTempo] = useState<number | null>(null)

  // Wire the toolbar to the player each time a (re)created alphaTab instance arrives.
  useEffect(() => {
    setReady(false)
    setPlaying(false)
    if (!api || !playerOn) return
    const offs = [
      api.playerReady.on(() => setReady(true)),
      api.playerStateChanged.on((e) => setPlaying(e.state === 1)),
      api.playerPositionChanged.on((e) => setPos({ cur: e.currentTime, end: e.endTime })),
      api.scoreLoaded.on((s) => setTempo(s.tempo)),
    ]
    if (api.isReadyForPlayback) setReady(true) // the event may have fired before we subscribed
    if (api.score) setTempo(api.score.tempo)
    // Re-apply the settings the user already chose to the fresh instance.
    try {
      api.playbackSpeed = speed / 100
      api.isLooping = loop
      api.metronomeVolume = click ? 1 : 0
      api.countInVolume = countIn ? 1 : 0
      api.masterVolume = volume
    } catch {
      /* an instance without a player (mid-switch) rejects these; the next instance gets them */
    }
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settings are re-applied by their own handlers below
  }, [api, playerOn])

  const set = <T,>(setter: (v: T) => void, apply: (v: T) => void) => (v: T) => {
    setter(v)
    if (api) apply(v)
  }
  const onSpeed = set(setSpeed, (v: number) => (api!.playbackSpeed = v / 100))
  const onLoop = set(setLoop, (v: boolean) => (api!.isLooping = v))
  const onClick = set(setClick, (v: boolean) => (api!.metronomeVolume = v ? 1 : 0))
  const onCountIn = set(setCountIn, (v: boolean) => (api!.countInVolume = v ? 1 : 0))
  const onVolume = set(setVolume, (v: number) => (api!.masterVolume = v))

  const btn = 'rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50'
  // Primary must not share `btn`'s hover: it would turn the background to the surface colour under light text.
  const primary = 'min-w-24 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50'

  return (
    <div>
      {playerOn ? (
        <div className="mb-3 space-y-2 rounded-lg border border-line bg-surface p-3" role="group" aria-label="Playback controls">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!ready} onClick={() => api?.playPause()} className={primary} aria-pressed={playing}>
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <button type="button" disabled={!ready} onClick={() => api?.stop()} className={btn}>■ Stop</button>
            <span className="text-sm tabular-nums text-muted" aria-label="Position">
              {mmss(pos.cur)} / {mmss(pos.end)}
            </span>
            {!ready && <span role="status" className="text-sm text-muted">Loading sounds…</span>}
            <button type="button" onClick={() => setPlayerOn(false)} className={`${btn} ml-auto`}>Hide player</button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              Speed
              <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))} className="rounded-md border border-line bg-bg px-2 py-1">
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>{s}%</option>
                ))}
              </select>
              {tempo != null && <span className="text-xs text-muted">≈ {Math.round(tempo * (speed / 100))} bpm</span>}
            </label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={loop} onChange={(e) => onLoop(e.target.checked)} className="size-4 accent-[var(--color-accent)]" /> Loop</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={click} onChange={(e) => onClick(e.target.checked)} className="size-4 accent-[var(--color-accent)]" /> Click track</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={countIn} onChange={(e) => onCountIn(e.target.checked)} className="size-4 accent-[var(--color-accent)]" /> Count-in</label>
            <label className="flex items-center gap-2">
              Volume
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => onVolume(Number(e.target.value))} className="w-24 accent-[var(--color-accent)]" />
            </label>
          </div>
          <p className="text-xs text-muted">Tip: drag across the tab to select bars, then turn on Loop to repeat just that part.</p>
        </div>
      ) : (
        <button type="button" onClick={() => setPlayerOn(true)} className={`${btn} mb-3`}>
          ▶ Play along
        </button>
      )}
      <Notation tex={tex} fileUrl={fileUrl} data={data} player={playerOn} onApi={setApi} />
    </div>
  )
}
