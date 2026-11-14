import type { AlphaTabApi } from '@coderline/alphatab'
import { useEffect, useRef, useState } from 'react'

export const SOUNDFONT_URL = '/soundfont/sonivox.sf2'

/**
 * Standard notation + tab, rendered by alphaTab. Browser only: mount it after hydration.
 * Give it alphaTex source, a Guitar Pro file URL, or raw file bytes.
 * `player` also loads the soundfont and enables playback; `onApi` hands the instance to a toolbar.
 */
export function Notation({
  tex,
  fileUrl,
  data,
  player = false,
  onApi,
}: {
  tex?: string | null
  fileUrl?: string | null
  data?: Uint8Array | null
  player?: boolean
  onApi?: (api: AlphaTabApi | null) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const onApiRef = useRef(onApi)
  onApiRef.current = onApi

  useEffect(() => {
    let cancelled = false
    let api: AlphaTabApi | undefined
    setStatus('loading')

    ;(async () => {
      try {
        const at = await import('@coderline/alphatab')
        if (cancelled || !host.current) return
        const css = getComputedStyle(document.documentElement)
        const c = (name: string) => css.getPropertyValue(name).trim()
        const text = c('--color-text')
        const muted = c('--color-muted')

        const a = new at.AlphaTabApi(host.current, {
          core: { fontDirectory: '/font/', useWorkers: false },
          player: {
            enablePlayer: player,
            soundFont: SOUNDFONT_URL,
            // Our scores are short; auto-scrolling would just yank the page around.
            scrollMode: at.ScrollMode.Off,
            enableCursor: player,
            enableUserInteraction: player,
          },
          display: {
            staveProfile: at.StaveProfile.ScoreTab,
            scale: 0.9,
            resources: {
              mainGlyphColor: text,
              secondaryGlyphColor: muted,
              staffLineColor: muted,
              barSeparatorColor: muted,
              barNumberColor: muted,
              scoreInfoColor: text,
            },
          },
        })
        api = a
        a.error.on((e: unknown) => {
          if (cancelled) return
          setMessage(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
          setStatus('error')
        })
        a.renderFinished.on(() => !cancelled && setStatus((s) => (s === 'error' ? s : 'ready')))
        onApiRef.current?.(a)

        if (data) a.load(data)
        else if (fileUrl) a.load(fileUrl)
        else if (tex) a.tex(tex)
        else {
          setMessage('Nothing to show yet.')
          setStatus('error')
        }
      } catch (e) {
        if (cancelled) return
        setMessage(e instanceof Error ? e.message : 'Could not load notation')
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      onApiRef.current?.(null)
      api?.destroy()
    }
  }, [tex, fileUrl, data, player])

  return (
    <div>
      {status === 'loading' && <p className="text-sm text-muted">Loading notation…</p>}
      {status === 'error' && (
        <p role="alert" className="text-sm text-red-500">
          {data
            ? 'Could not open that file. Is it a Guitar Pro file (.gp, .gp5, .gp7, .gpx)?'
            : `Could not render this notation. ${message}`}
        </p>
      )}
      <div ref={host} className="relative overflow-x-auto" aria-label="Guitar notation and tab" />
    </div>
  )
}
