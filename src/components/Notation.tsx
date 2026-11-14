import { useEffect, useRef, useState } from 'react'

/** Standard notation + tab, rendered by alphaTab. Browser only: mount it after hydration. */
export function Notation({ tex }: { tex: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    let api: { destroy(): void } | undefined
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
          player: { enablePlayer: false },
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
        a.tex(tex)
      } catch (e) {
        if (cancelled) return
        setMessage(e instanceof Error ? e.message : 'Could not load notation')
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      api?.destroy()
    }
  }, [tex])

  return (
    <div>
      {status === 'loading' && <p className="text-sm text-muted">Loading notation…</p>}
      {status === 'error' && (
        <p role="alert" className="text-sm text-red-500">
          Could not render this notation. {message}
        </p>
      )}
      <div ref={host} className="overflow-x-auto" aria-label="Guitar notation and tab" />
    </div>
  )
}
