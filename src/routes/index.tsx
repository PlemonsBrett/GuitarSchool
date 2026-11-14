import { createFileRoute, Link } from '@tanstack/react-router'
import { PATHS } from '~/content/paths'
import { getCatalogFn } from '~/server/catalog'

export const Route = createFileRoute('/')({
  loader: () => getCatalogFn(),
  component: Home,
})

function Home() {
  const catalog = Route.useLoaderData()
  return (
    <>
      <section className="py-10 sm:py-16">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Know what to practice. Know where to look next.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Guitar School is a roadmap, not a video library. Each step tells you what to work on, then points to the best
          place to learn it, and tracks your progress as you go.
        </p>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        {PATHS.map((p) => (
          <section key={p.id} className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-2xl font-semibold">{p.title}</h2>
            <p className="text-sm text-muted">{p.blurb}</p>
            <ul className="mt-4 space-y-2">
              {catalog.filter((s) => s.path === p.id).map((s) => {
                const live = s.status === 'published'
                const body = (
                  <>
                    <span>
                      <span className="block font-medium">{s.style}</span>
                      <span className="block text-sm text-muted">{s.blurb}</span>
                    </span>
                    {live ? (
                      <span className="text-sm font-medium text-accent">Start →</span>
                    ) : (
                      <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">Coming soon</span>
                    )}
                  </>
                )
                return (
                  <li key={s.slug}>
                    {live ? (
                      <Link
                        to="/tracks/$slug"
                        params={{ slug: s.slug }}
                        className="flex items-center justify-between rounded-lg border border-line p-3 hover:border-accent"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg border border-dashed border-line p-3 opacity-70">
                        {body}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
