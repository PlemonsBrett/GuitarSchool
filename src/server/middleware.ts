import { createMiddleware } from '@tanstack/react-start'
import { getSupabase } from '~/lib/supabase.server'

/** Requires a signed-in user and hands the handler a per-request Supabase client via `context.supabase`. */
export const userMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) throw new Error('Not signed in')
  return next({ context: { supabase } })
})

/**
 * Defense in depth: the UI hides /admin from non-admins, this refuses them,
 * and Postgres RLS refuses their writes a third time.
 */
export const adminMiddleware = createMiddleware({ type: 'function' })
  .middleware([userMiddleware])
  .server(async ({ next, context }) => {
    const { data: isAdmin } = await context.supabase.rpc('is_admin')
    if (isAdmin !== true) throw new Error('Forbidden')
    return next()
  })
