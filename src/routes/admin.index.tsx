import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Btn, ErrorText, Field, inputCls, moved, MoveButtons, StatusBadge, useAction } from '~/components/admin/ui'
import { PATHS } from '~/content/paths'
import { slugify } from '~/lib/slug'
import { getAdminCatalogFn, reorderTracksFn, saveTrackFn } from '~/server/admin'

export const Route = createFileRoute('/admin/')({
  loader: () => getAdminCatalogFn(),
  component: AdminCatalog,
})

function AdminCatalog() {
  const tracks = Route.useLoaderData()
  const reorder = useAction()

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Catalog</h1>
      <p className="text-sm text-muted">
        Every track learners can pick. <strong>Published</strong> tracks show full lessons, <strong>coming soon</strong> tracks are
        listed but locked, and <strong>draft</strong> tracks are visible only to admins.
      </p>
      <ErrorText>{reorder.error}</ErrorText>

      {PATHS.map((p) => {
        const inPath = tracks.filter((t) => t.path === p.id)
        return (
          <section key={p.id} className="mt-6">
            <h2 className="font-semibold">{p.title}</h2>
            {inPath.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No tracks yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
                {inPath.map((t, i) => (
                  <li key={t.slug} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <MoveButtons
                      disabled={reorder.busy}
                      onUp={i > 0 ? () => swap(inPath, i, -1) : undefined}
                      onDown={i < inPath.length - 1 ? () => swap(inPath, i, 1) : undefined}
                    />
                    <div className="min-w-40 flex-1">
                      <Link to="/admin/tracks/$slug" params={{ slug: t.slug }} className="font-medium hover:text-accent">
                        {t.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {t.style} · {t.phaseCount} phase{t.phaseCount === 1 ? '' : 's'} · /{t.slug}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                    <Link to="/admin/tracks/$slug" params={{ slug: t.slug }} className="text-sm text-accent underline">
                      Edit
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}

      <NewTrack />
    </>
  )

  function swap(list: typeof tracks, i: number, dir: -1 | 1) {
    const next = moved(list, i, dir)
    if (!next) return
    // Reorder within this path while keeping other paths' relative order.
    const others = tracks.filter((t) => t.path !== list[0].path)
    void reorder.run(() => reorderTracksFn({ data: { slugs: [...next, ...others].map((t) => t.slug) } }))
  }
}

function NewTrack() {
  const router = useRouter()
  const { busy, error, run } = useAction()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [path, setPath] = useState<'electric' | 'acoustic'>('electric')
  const [style, setStyle] = useState('')

  if (!open)
    return (
      <Btn variant="primary" className="mt-8" onClick={() => setOpen(true)}>
        + New track
      </Btn>
    )

  return (
    <form
      className="mt-8 space-y-3 rounded-xl border border-line bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await run(() =>
          saveTrackFn({ data: { isNew: true, slug, path, style, title, blurb: '', tagline: '', status: 'draft', habits: [], graduation: [] } }),
        )
        if (ok) await router.navigate({ to: '/admin/tracks/$slug', params: { slug } })
      }}
    >
      <h2 className="font-semibold">New track</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Path">
          <select value={path} onChange={(e) => setPath(e.target.value as 'electric' | 'acoustic')} className={inputCls}>
            {PATHS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Style" hint='e.g. "Lead", "Fingerstyle"'>
          <input required maxLength={40} value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Title">
          <input
            required
            maxLength={80}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (!slugTouched) setSlug(slugify(e.target.value))
            }}
            className={inputCls}
          />
        </Field>
        <Field label="URL slug" hint="Set once. Used in the address, so it can't change later.">
          <input
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              setSlugTouched(true)
            }}
            className={inputCls}
          />
        </Field>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Btn type="submit" variant="primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create as draft'}
        </Btn>
        <Btn onClick={() => setOpen(false)}>Cancel</Btn>
      </div>
    </form>
  )
}
