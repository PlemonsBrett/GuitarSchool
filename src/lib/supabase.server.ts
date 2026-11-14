import { createServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'

/**
 * Project URL and publishable key. The publishable key is designed to be public (RLS is the protection),
 * but it stays server-side here. The VITE_-prefixed names are accepted too, so either naming works.
 */
export function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error('Supabase is not configured: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (see .dev.vars.example)')
  }
  return { url, key }
}

/** Per-request Supabase client that reads/writes the session through cookies. Server only. */
export function getSupabase() {
  const { url, key } = supabaseConfig()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }))
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) setCookie(name, value, options)
      },
    },
  })
}
