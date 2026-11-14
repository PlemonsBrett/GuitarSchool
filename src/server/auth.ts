import { createServerFn } from '@tanstack/react-start'
import { getSupabase } from '~/lib/supabase.server'

type Credentials = { email: string; password: string }

function parseCredentials(d: unknown): Credentials {
  const { email, password } = (d ?? {}) as Partial<Credentials>
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email')
  if (typeof password !== 'string' || password.length < 8) throw new Error('Password must be at least 8 characters')
  return { email: email.trim(), password }
}

export const getUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { data } = await getSupabase().auth.getClaims()
  const claims = data?.claims
  return claims ? { id: claims.sub, email: (claims.email as string | undefined) ?? '' } : null
})

export const signInFn = createServerFn({ method: 'POST' })
  .validator(parseCredentials)
  .handler(async ({ data }) => {
    const { error } = await getSupabase().auth.signInWithPassword(data)
    return error ? { error: error.message } : { error: null }
  })

export const signUpFn = createServerFn({ method: 'POST' })
  .validator(parseCredentials)
  .handler(async ({ data }) => {
    const { data: res, error } = await getSupabase().auth.signUp(data)
    if (error) return { error: error.message, needsConfirmation: false }
    // With email confirmation on, there is no session until the link is clicked.
    return { error: null, needsConfirmation: !res.session }
  })

export const signOutFn = createServerFn({ method: 'POST' }).handler(async () => {
  await getSupabase().auth.signOut()
})
