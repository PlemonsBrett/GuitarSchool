/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Link, Outlet, Scripts, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '~/styles.css?url'
import { getUserFn, signOutFn } from '~/server/auth'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Guitar School' },
      { name: 'description', content: 'A guided path to learn guitar: what to practice, where to look next, and a record of your progress.' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  beforeLoad: async () => ({ user: await getUserFn() }),
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
  shellComponent: Document,
})

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function Shell({ children }: { children: ReactNode }) {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-4">
      <header className="flex items-center justify-between py-5">
        <Link to="/" className="text-lg font-bold tracking-tight">
          Guitar<span className="text-accent">School</span>
        </Link>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.email}</span>
            <button
              className="rounded-md border border-line px-3 py-1.5 hover:bg-surface"
              onClick={async () => {
                await signOutFn()
                await router.invalidate()
                await router.navigate({ to: '/' })
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link to="/login" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">
            Sign in
          </Link>
        )}
      </header>
      <main className="flex-1 pb-16">{children}</main>
    </div>
  )
}
