import { createFileRoute } from '@tanstack/react-router'
import { Tuner } from '~/components/tools/Tuner'

export const Route = createFileRoute('/tools/tuner')({
  head: () => ({ meta: [{ title: 'Tuner · Guitar School' }] }),
  component: () => (
    <div className="mx-auto max-w-xl">
      <Tuner />
    </div>
  ),
})
