import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerFn } from '@tanstack/react-start'
import { SLUG_RE } from '~/lib/slug'
import { userMiddleware } from './middleware'

type Db = SupabaseClient

function slugArg(v: unknown, what: string): string {
  if (typeof v !== 'string' || !SLUG_RE.test(v)) throw new Error(`Unknown ${what}`)
  return v
}

/** Progress can only be recorded on published tracks. */
async function assertPublished(supabase: Db, trackSlug: string) {
  const { data, error } = await supabase.from('tracks').select('status').eq('slug', trackSlug).maybeSingle()
  if (error) throw new Error(error.message)
  if (data?.status !== 'published') throw new Error('Unknown track')
}

/** An item slug or a phase milestone slug that really exists on this track. */
async function assertItem(supabase: Db, trackSlug: string, itemSlug: string) {
  const [item, milestone] = await Promise.all([
    supabase.from('items').select('id').eq('track_slug', trackSlug).eq('slug', itemSlug).maybeSingle(),
    supabase.from('phases').select('id').eq('track_slug', trackSlug).eq('milestone_slug', itemSlug).maybeSingle(),
  ])
  if (item.error || milestone.error) throw new Error((item.error ?? milestone.error)!.message)
  if (!item.data && !milestone.data) throw new Error('Unknown item')
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
  .middleware([userMiddleware])
  .validator((d: unknown) => ({ trackSlug: slugArg((d as { trackSlug?: unknown })?.trackSlug, 'track') }))
  .handler(async ({ data, context }): Promise<TrackProgress> => {
    const supabase = context.supabase
    await assertPublished(supabase, data.trackSlug)
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
  .middleware([userMiddleware])
  .validator((d: unknown) => ({ trackSlug: slugArg((d as { trackSlug?: unknown })?.trackSlug, 'track') }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    await assertPublished(supabase, data.trackSlug)
    const { error } = await supabase
      .from('user_tracks')
      .upsert({ track_slug: data.trackSlug }, { onConflict: 'user_id,track_slug', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  })

export const setCompletedFn = createServerFn({ method: 'POST' })
  .middleware([userMiddleware])
  .validator((d: unknown) => {
    const x = (d ?? {}) as { trackSlug?: unknown; itemSlug?: unknown; done?: unknown }
    return { trackSlug: slugArg(x.trackSlug, 'track'), itemSlug: slugArg(x.itemSlug, 'item'), done: x.done === true }
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    await assertPublished(supabase, data.trackSlug)
    await assertItem(supabase, data.trackSlug, data.itemSlug)
    const q = data.done
      ? supabase
          .from('progress')
          .upsert({ track_slug: data.trackSlug, item_slug: data.itemSlug }, { onConflict: 'user_id,track_slug,item_slug', ignoreDuplicates: true })
      : supabase.from('progress').delete().eq('track_slug', data.trackSlug).eq('item_slug', data.itemSlug)
    const { error } = await q
    if (error) throw new Error(error.message)
  })

export const logPracticeFn = createServerFn({ method: 'POST' })
  .middleware([userMiddleware])
  .validator((d: unknown) => {
    const x = (d ?? {}) as { trackSlug?: unknown; minutes?: unknown; note?: unknown }
    const minutes = Number(x.minutes)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) throw new Error('Minutes must be 1-600')
    const note = typeof x.note === 'string' ? x.note.trim().slice(0, 1000) : ''
    return { trackSlug: slugArg(x.trackSlug, 'track'), minutes, note: note || null }
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    await assertPublished(supabase, data.trackSlug)
    const { error } = await supabase
      .from('practice_logs')
      .insert({ track_slug: data.trackSlug, minutes: data.minutes, note: data.note })
    if (error) throw new Error(error.message)
  })
