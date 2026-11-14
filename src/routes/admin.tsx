import { createFileRoute, Link, notFound, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ context, location }) => {
    if (!context.user) throw redirect({ to: '/login', search: { redirect: location.pathname } })
    // Signed in but not an admin: behave as if the page doesn't exist.
    if (!context.user.isAdmin) throw notFound()
  },
  head: () => ({ meta: [{ title: 'Admin · Guitar School' }] }),
  notFoundComponent: () => <p className="py-10">Page not found.</p>,
  component: AdminLayout,
})

function AdminLayout() {
  const tab = 'rounded-md px-3 py-1.5 text-sm hover:bg-surface'
  const active = { className: `${tab} bg-surface font-medium` }
  return (
    <>
      <nav aria-label="Admin" className="mb-6 flex items-center gap-1 border-b border-line pb-3">
        <span className="mr-3 text-xs font-semibold uppercase tracking-wide text-muted">Admin</span>
        <Link to="/admin" activeOptions={{ exact: true }} className={tab} activeProps={active}>
          Catalog
        </Link>
        <Link to="/admin/chords" className={tab} activeProps={active}>
          Chords
        </Link>
      </nav>
      <Outlet />
    </>
  )
}
