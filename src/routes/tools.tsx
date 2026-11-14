import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/tools')({
  head: () => ({ meta: [{ title: 'Practice tools · Guitar School' }] }),
  component: ToolsLayout,
})

function ToolsLayout() {
  const tab = 'rounded-md px-3 py-1.5 text-sm hover:bg-surface'
  const active = { className: `${tab} bg-surface font-medium` }
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Practice tools</h1>
      <p className="text-muted">Everything runs in your browser. Nothing is recorded or uploaded.</p>
      <nav aria-label="Practice tools" className="mb-6 mt-4 flex gap-1 border-b border-line pb-3">
        <Link to="/tools/metronome" className={tab} activeProps={active}>Metronome</Link>
        <Link to="/tools/tuner" className={tab} activeProps={active}>Tuner</Link>
        <Link to="/tools/player" className={tab} activeProps={active}>Tab player</Link>
      </nav>
      <Outlet />
    </>
  )
}
