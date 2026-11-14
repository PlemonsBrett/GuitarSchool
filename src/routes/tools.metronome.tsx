import { createFileRoute } from '@tanstack/react-router'
import { Metronome } from '~/components/tools/Metronome'

export const Route = createFileRoute('/tools/metronome')({
  head: () => ({ meta: [{ title: 'Metronome · Guitar School' }] }),
  component: () => (
    <div className="mx-auto max-w-xl">
      <Metronome hotkeys />
    </div>
  ),
})
