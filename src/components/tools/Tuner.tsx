import { useCallback, useEffect, useRef, useState } from 'react'
import { detectPitch, median, midiToFreq, nearestString, noteName, TUNINGS, type StringMatch } from '~/lib/audio/pitch'

type Status = 'idle' | 'starting' | 'listening' | 'error'
type Reading = StringMatch & { freq: number }

const IN_TUNE = 5 // cents
const CLOSE = 15
const HOLD_MS = 700 // keep the last reading briefly so the needle doesn't flicker between plucks

function micError(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return "Microphone access was blocked. Allow it in your browser's site settings, then press Start again."
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found on this device.'
  if (name === 'NotSupportedError') return 'This browser cannot use the microphone on this page. The tuner needs a secure (https) page.'
  if (name === 'NotReadableError') return 'The microphone is in use by another app. Close it and try again.'
  return 'Could not start the microphone.'
}

export function Tuner() {
  const [tuningId, setTuningId] = useState(TUNINGS[0].id)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState<Reading | null>(null)
  const tuning = TUNINGS.find((t) => t.id === tuningId) ?? TUNINGS[0]

  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toneCtx = useRef<AudioContext | null>(null)
  const tuningRef = useRef(tuning)
  tuningRef.current = tuning

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void ctxRef.current?.close()
    ctxRef.current = null
    setReading(null)
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot use the microphone here. The tuner needs a secure (https) page.')
      setStatus('error')
      return
    }
    setStatus('starting')
    try {
      // Turn off the browser's voice processing: it would "clean up" the guitar tone we want to measure.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      ctx.createMediaStreamSource(stream).connect(analyser)
      streamRef.current = stream
      ctxRef.current = ctx

      const buf = new Float32Array(analyser.fftSize)
      const recent: number[] = []
      let lastHeard = 0
      timerRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(buf)
        const p = detectPitch(buf, ctx.sampleRate)
        const now = performance.now()
        if (p && p.clarity > 0.85) {
          lastHeard = now
          recent.push(p.freq)
          if (recent.length > 5) recent.shift()
          const f = median(recent)
          setReading({ ...nearestString(f, tuningRef.current), freq: f })
        } else if (now - lastHeard > HOLD_MS) {
          recent.length = 0
          setReading(null)
        }
      }, 50)
      setStatus('listening')
    } catch (e) {
      setError(micError(e))
      setStatus('error')
    }
  }, [])

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      void ctxRef.current?.close()
      void toneCtx.current?.close()
    },
    [],
  )

  /** Reference tone for a string. A triangle wave, because a pure sine at 82 Hz is inaudible on laptop speakers. */
  function playTone(midi: number) {
    const ctx = toneCtx.current ?? new AudioContext()
    toneCtx.current = ctx
    void ctx.resume()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = midiToFreq(midi)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.35, t + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 2.6)
  }

  const cents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0
  const state = !reading ? 'idle' : Math.abs(reading.cents) <= IN_TUNE ? 'good' : Math.abs(reading.cents) <= CLOSE ? 'close' : 'off'
  const color = state === 'good' ? 'text-ok' : state === 'close' ? 'text-accent' : 'text-text'
  const note = reading ? noteName(reading.midi) : null

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm">
          <span className="font-medium">Tuning</span>
          <select
            value={tuningId}
            onChange={(e) => setTuningId(e.target.value)}
            className="mt-1 block rounded-md border border-line bg-bg px-2 py-1.5"
          >
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        {status === 'listening' ? (
          <button type="button" onClick={stop} className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-bg">
            ■ Stop listening
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={status === 'starting'}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            {status === 'starting' ? 'Waiting for microphone…' : '🎤 Start tuner'}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}

      <div className="mt-6 text-center" aria-live="polite">
        <p className={`h-20 text-7xl font-bold tabular-nums leading-none ${color}`}>
          {note ? (
            <>
              {note.name}
              <span className="text-2xl text-muted">{note.octave}</span>
            </>
          ) : (
            <span className="text-muted">–</span>
          )}
        </p>
        <p className="mt-1 h-6 text-sm text-muted">
          {status !== 'listening'
            ? 'Press start, then pluck an open string.'
            : !reading
              ? 'Listening… pluck a string.'
              : state === 'good'
                ? 'In tune ✓'
                : reading.cents < 0
                  ? `Flat: tune up (${Math.round(reading.cents)}¢)`
                  : `Sharp: tune down (+${Math.round(reading.cents)}¢)`}
        </p>
      </div>

      {/* Needle: ±50 cents, centre is in tune. */}
      <div
        className="relative mx-auto mt-3 h-10 max-w-md"
        role="meter"
        aria-label="Tuning offset in cents"
        aria-valuemin={-50}
        aria-valuemax={50}
        aria-valuenow={Math.round(cents)}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-line" />
        <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-ok/70" />
        <div className="absolute top-1/2 h-8 -translate-y-1/2 rounded bg-ok/15" style={{ left: `${50 - IN_TUNE}%`, width: `${IN_TUNE * 2}%` }} />
        {reading && (
          <div
            className={`absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg transition-[left] duration-100 ${
              state === 'good' ? 'bg-ok' : state === 'close' ? 'bg-accent' : 'bg-text'
            }`}
            style={{ left: `${50 + cents}%` }}
          />
        )}
        <span className="absolute -bottom-4 left-0 text-[10px] text-muted">♭ −50</span>
        <span className="absolute -bottom-4 right-0 text-[10px] text-muted">+50 ♯</span>
      </div>
      {reading && <p className="mt-6 text-center text-xs text-muted">{reading.freq.toFixed(1)} Hz · target {reading.target.toFixed(1)} Hz</p>}

      <div className="mt-7">
        <p className="text-sm font-medium">Strings <span className="font-normal text-muted">(tap one to hear its pitch)</span></p>
        <ul className="mt-2 grid grid-cols-6 gap-2">
          {tuning.notes.map((midi, i) => {
            const n = noteName(midi)
            const on = reading?.index === i
            return (
              <li key={`${tuning.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => playTone(midi)}
                  aria-label={`Play ${n.name}${n.octave}, string ${6 - i}`}
                  className={`w-full rounded-lg border px-1 py-2 text-center ${
                    on ? (state === 'good' ? 'border-ok bg-ok/15' : 'border-accent bg-accent/15') : 'border-line hover:bg-bg'
                  }`}
                >
                  <span className="block text-lg font-semibold">{n.name}</span>
                  <span className="block text-[10px] text-muted">{6 - i}{i === 0 ? ' (low)' : i === 5 ? ' (high)' : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="mt-4 text-xs text-muted">
        Tune each string up to pitch rather than down from above, and check it again after the others: tightening one string
        shifts the rest slightly. Audio stays on your device.
      </p>
    </div>
  )
}
