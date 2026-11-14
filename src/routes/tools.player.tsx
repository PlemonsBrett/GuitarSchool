import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { TabViewer } from '~/components/TabViewer'

export const Route = createFileRoute('/tools/player')({
  head: () => ({ meta: [{ title: 'Tab player · Guitar School' }] }),
  component: PlayerPage,
})

const SAMPLE = `\\tempo 80
.
:8 3.5 0.4 2.4 3.4 0.3 2.3 0.2 1.2 |
1.2 0.2 2.3 0.3 3.4 2.4 0.4 3.5`

const MAX_BYTES = 10 * 1024 * 1024

function PlayerPage() {
  const [data, setData] = useState<Uint8Array | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    setError(null)
    if (!file) return
    if (file.size > MAX_BYTES) return setError('That file is larger than 10 MB.')
    setData(new Uint8Array(await file.arrayBuffer()))
    setName(file.name)
  }

  return (
    <div>
      <div className="rounded-xl border border-line bg-surface p-4">
        <label className="block text-sm">
          <span className="font-medium">Open a Guitar Pro file from your computer</span>
          <input
            type="file"
            accept=".gp,.gp3,.gp4,.gp5,.gp7,.gpx,.gtp,.musicxml,.xml"
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-bg file:px-3 file:py-1.5"
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          The file is read in your browser and never uploaded. Then slow it down, loop the hard bars, and play along with a click.
        </p>
        {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
        {name && (
          <button
            type="button"
            className="mt-2 text-sm underline"
            onClick={() => {
              setData(null)
              setName(null)
            }}
          >
            Back to the sample ({name} is loaded)
          </button>
        )}
      </div>
      <p className="mb-3 mt-6 text-sm font-medium">{name ?? 'Sample: C major scale'}</p>
      {/* key: a new file is a new score, so start a fresh viewer */}
      <TabViewer key={name ?? 'sample'} tex={data ? null : SAMPLE} data={data} defaultPlayer />
    </div>
  )
}
