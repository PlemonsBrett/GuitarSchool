import { createServerFn } from '@tanstack/react-start'
import { allItems, getTrack, isPublished } from '~/content'
import { getSupabase } from '~/lib/supabase.server'

async function requireUser() {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) throw new Error('Not signed in')
  return supabase
}

function validTrack(slug: unknown): string {
  if (typeof slug !== 'string' || !isPublished(slug)) throw new Error('Unknown track')
  return slug
}

function validItem(trackSlug: string, itemSlug: unknown): string {
  const track = getTrack(trackSlug)!
  const known = new Set<string>([
    ...allItems(track).map((x) => x.item.slug),
    ...track.phases.map((p) => p.milestone.slug),
  ])
  if (typeof itemSlug !== 'string' || !known.has(itemSlug)) throw new Error('Unknown item')
  return itemSlug
}

export type TrackProgress = {
  today: string
  startedOn: string | null
  completed: string[]
  practiceDays: string[]
  totalMinutes: number
  recent: { id: string; practiced_on: string; minutes: number; note: string | null }[]
}

export const getProgressFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => ({ trackSlug: validTrack((d as { trackSlug?: unknown })?.trackSlug) }))
  .handler(async ({ data }): Promise<TrackProgress> => {
    const supabase = await requireUser()
    const [started, done, logs] = await Promise.all([
      supabase.from('user_tracks').select('started_on').eq('track_slug', data.trackSlug).maybeSingle(),
      supabase.from('progress').select('item_slug').eq('track_slug', data.trackSlug),
      supabase
        .from('practice_logs')
        .select('id, practiced_on, minutes, note')
        .eq('track_slug', data.trackSlug)
        .order('practiced_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500),
    ])
    for (const r of [started, done, logs]) if (r.error) throw new Error(r.error.message)
    const rows = logs.data ?? []
    return {
      today: new Date().toISOString().slice(0, 10),
      startedOn: started.data?.started_on ?? null,
      completed: (done.data ?? []).map((r) => r.item_slug),
      practiceDays: [...new Set(rows.map((r) => r.practiced_on))],
      totalMinutes: rows.reduce((n, r) => n + r.minutes, 0),
      recent: rows.slice(0, 10),
    }
  })

export const startTrackFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => ({ trackSlug: validTrack((d as { trackSlug?: unknown })?.trackSlug) }))
  .handler(async ({ data }) => {
    const supabase = await requireUser()
    const { error } = await supabase
      .from('user_tracks')
      .upsert({ track_slug: data.trackSlug }, { onConflict: 'user_id,track_slug', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  })

export const setCompletedFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => {
    const x = (d ?? {}) as { trackSlug?: unknown; itemSlug?: unknown; done?: unknown }
    const trackSlug = validTrack(x.trackSlug)
    return { trackSlug, itemSlug: validItem(trackSlug, x.itemSlug), done: x.done === true }
  })
  .handler(async ({ data }) => {
    const supabase = await requireUser()
    const q = data.done
      ? supabase
          .from('progress')
          .upsert({ track_slug: data.trackSlug, item_slug: data.itemSlug }, { onConflict: 'user_id,track_slug,item_slug', ignoreDuplicates: true })
      : supabase.from('progress').delete().eq('track_slug', data.trackSlug).eq('item_slug', data.itemSlug)
    const { error } = await q
    if (error) throw new Error(error.message)
  })

export const logPracticeFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => {
    const x = (d ?? {}) as { trackSlug?: unknown; minutes?: unknown; note?: unknown }
    const minutes = Number(x.minutes)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) throw new Error('Minutes must be 1-600')
    const note = typeof x.note === 'string' ? x.note.trim().slice(0, 1000) : ''
    return { trackSlug: validTrack(x.trackSlug), minutes, note: note || null }
  })
  .handler(async ({ data }) => {
    const supabase = await requireUser()
    const { error } = await supabase
      .from('practice_logs')
      .insert({ track_slug: data.trackSlug, minutes: data.minutes, note: data.note })
    if (error) throw new Error(error.message)
  })
