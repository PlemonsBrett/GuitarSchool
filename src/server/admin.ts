import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerFn } from '@tanstack/react-start'
import type { Chord, Track } from '~/content/types'
import { slugify } from '~/lib/slug'
import { lines, obj, oneOf, optText, parseChord, slug, text, uuid } from '~/lib/validate'
import { adminMiddleware } from './middleware'
import { loadTrack, rowToChord } from './catalog'

// ---------- guards & small helpers -------------------------------------------------------------

type Db = SupabaseClient

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.code === '23505') throw new Error('That slug is already in use here. Pick another.')
    if (res.error.code === '23503') throw new Error('That references something that no longer exists. Reload and try again.')
    throw new Error(res.error.message)
  }
  return res.data
}

async function nextPosition(supabase: Db, table: 'tracks' | 'phases' | 'items' | 'notations', col?: string, val?: string) {
  let q = supabase.from(table).select('position').order('position', { ascending: false }).limit(1)
  if (col && val) q = q.eq(col, val)
  const rows = check(await q)
  return (rows?.[0]?.position ?? -1) + 1
}

async function removeFiles(supabase: Db, paths: string[]) {
  if (paths.length) await supabase.storage.from('tabs').remove(paths) // best effort: orphan files are harmless
}

// ---------- reads ------------------------------------------------------------------------------

export const getAdminCatalogFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware]).handler(async ({ context }) => {
  const supabase = context.supabase
  const rows = check(
    await supabase.from('tracks').select('slug, path, style, title, status, position, phases(count)').order('position'),
  )
  return (rows ?? []).map((r) => ({
    slug: r.slug as string,
    path: r.path as 'acoustic' | 'electric',
    style: r.style as string,
    title: r.title as string,
    status: r.status as 'draft' | 'coming_soon' | 'published',
    phaseCount: (r.phases as unknown as { count: number }[])?.[0]?.count ?? 0,
  }))
})

export const getAdminTrackFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => ({ slug: slug(obj(d).slug) }))
  .handler(async ({ data, context }): Promise<{ track: Track; chords: Chord[] }> => {
    const supabase = context.supabase
    const track = await loadTrack(supabase, data.slug, context.supabaseUrl)
    if (!track) throw new Error('Track not found')
    const chords = check(await supabase.from('chords').select('*').order('id'))
    return { track, chords: (chords ?? []).map(rowToChord) }
  })

export const getAdminChordsFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware]).handler(async ({ context }) => {
  const supabase = context.supabase
  const [chords, items] = await Promise.all([
    supabase.from('chords').select('*').order('id'),
    supabase.from('items').select('title, track_slug, chords'),
  ])
  const used = new Map<string, number>()
  for (const i of check(items) ?? []) for (const id of i.chords as string[]) used.set(id, (used.get(id) ?? 0) + 1)
  return (check(chords) ?? []).map((c) => ({ ...rowToChord(c), usedBy: used.get(c.id) ?? 0 }))
})

// ---------- tracks -----------------------------------------------------------------------------

export const saveTrackFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => {
    const x = obj(d)
    return {
      isNew: x.isNew === true,
      slug: slug(x.slug),
      path: oneOf(x.path, ['acoustic', 'electric'] as const, 'Path'),
      style: text(x.style, 'Style', { min: 1, max: 40 }),
      title: text(x.title, 'Title', { min: 1, max: 80 }),
      blurb: text(x.blurb, 'Blurb', { max: 200 }),
      tagline: text(x.tagline, 'Tagline', { max: 300 }),
      status: oneOf(x.status, ['draft', 'coming_soon', 'published'] as const, 'Status'),
      warmupSlug: x.warmupSlug ? slug(x.warmupSlug, 'Warm-up') : null,
      habits: lines(x.habits, 'Habits'),
      graduation: lines(x.graduation, 'Graduation'),
    }
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const { isNew, slug: s, ...fields } = data
    if (fields.warmupSlug) {
      const found = check(await supabase.from('items').select('id').eq('track_slug', s).eq('slug', fields.warmupSlug).maybeSingle())
      if (!found) throw new Error('Warm-up must be an item in this track')
    }
    const row = {
      path: fields.path,
      style: fields.style,
      title: fields.title,
      blurb: fields.blurb,
      tagline: fields.tagline,
      status: fields.status,
      warmup_slug: fields.warmupSlug,
      habits: fields.habits,
      graduation: fields.graduation,
    }
    if (isNew) check(await supabase.from('tracks').insert({ slug: s, ...row, position: await nextPosition(supabase, 'tracks') }))
    else check(await supabase.from('tracks').update(row).eq('slug', s))
  })

export const deleteTrackFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => ({ slug: slug(obj(d).slug) }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const files = check(
      await supabase.from('notations').select('file_path, items!inner(track_slug)').eq('items.track_slug', data.slug).not('file_path', 'is', null),
    )
    check(await supabase.from('tracks').delete().eq('slug', data.slug))
    await removeFiles(supabase, (files ?? []).map((f) => f.file_path as string))
  })

// ---------- phases -----------------------------------------------------------------------------

export const savePhaseFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => {
    const x = obj(d)
    const isNew = !x.id
    return {
      id: isNew ? null : uuid(x.id),
      trackSlug: slug(x.trackSlug, 'Track'),
      // slug and milestone slug are progress keys: set once at creation, never edited.
      slug: isNew ? slug(x.slug) : null,
      title: text(x.title, 'Title', { min: 1, max: 80 }),
      months: text(x.months, 'Months', { max: 40 }),
      summary: text(x.summary, 'Summary', { max: 300 }),
      milestoneText: text(x.milestoneText, 'Milestone', { max: 300 }),
    }
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const common = { title: data.title, months: data.months, summary: data.summary, milestone_text: data.milestoneText }
    if (data.id) check(await supabase.from('phases').update(common).eq('id', data.id))
    else
      check(
        await supabase.from('phases').insert({
          track_slug: data.trackSlug,
          slug: data.slug,
          milestone_slug: `milestone-${data.slug}`,
          position: await nextPosition(supabase, 'phases', 'track_slug', data.trackSlug),
          ...common,
        }),
      )
  })

export const deletePhaseFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => ({ id: uuid(obj(d).id) }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const files = check(
      await supabase.from('notations').select('file_path, items!inner(phase_id)').eq('items.phase_id', data.id).not('file_path', 'is', null),
    )
    check(await supabase.from('phases').delete().eq('id', data.id))
    await removeFiles(supabase, (files ?? []).map((f) => f.file_path as string))
  })

// ---------- items ------------------------------------------------------------------------------

export const saveItemFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => {
    const x = obj(d)
    const isNew = !x.id
    return {
      id: isNew ? null : uuid(x.id),
      phaseId: uuid(x.phaseId, 'Phase'),
      slug: isNew ? slug(x.slug) : null,
      kind: oneOf(x.kind, ['drill', 'song'] as const, 'Kind'),
      title: text(x.title, 'Title', { min: 1, max: 120 }),
      detail: text(x.detail, 'Detail', { max: 500 }),
      query: optText(x.query, 'Search hint', 120),
      chords: (Array.isArray(x.chords) ? x.chords : []).slice(0, 12).map((c) => text(c, 'Chord', { min: 1, max: 12 })),
      chordNote: optText(x.chordNote, 'Chord note', 300),
    }
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    if (data.chords.length) {
      const known = check(await supabase.from('chords').select('id').in('id', data.chords))
      const missing = data.chords.filter((c) => !(known ?? []).some((k) => k.id === c))
      if (missing.length) throw new Error(`Unknown chord: ${missing.join(', ')}`)
    }
    const common = {
      kind: data.kind,
      title: data.title,
      detail: data.detail,
      query: data.query,
      chords: data.chords,
      chord_note: data.chordNote,
    }
    if (data.id) {
      check(await supabase.from('items').update(common).eq('id', data.id))
      return
    }
    const phase = check(await supabase.from('phases').select('track_slug').eq('id', data.phaseId).maybeSingle())
    if (!phase) throw new Error('That phase no longer exists. Reload and try again.')
    check(
      await supabase.from('items').insert({
        track_slug: phase.track_slug,
        phase_id: data.phaseId,
        slug: data.slug,
        position: await nextPosition(supabase, 'items', 'phase_id', data.phaseId),
        ...common,
      }),
    )
  })

export const moveItemFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => ({ id: uuid(obj(d).id), phaseId: uuid(obj(d).phaseId, 'Phase') }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const [item, phase] = await Promise.all([
      supabase.from('items').select('track_slug, phase_id').eq('id', data.id).maybeSingle(),
      supabase.from('phases').select('track_slug').eq('id', data.phaseId).maybeSingle(),
    ])
    const it = check(item)
    const ph = check(phase)
    if (!it || !ph) throw new Error('That lesson or phase no longer exists. Reload and try again.')
    if (it.track_slug !== ph.track_slug) throw new Error('Lessons can only move within their own track.')
    if (it.phase_id === data.phaseId) return
    // Learners' progress is keyed by the lesson's slug, so moving it keeps everyone's checkmarks.
    check(
      await supabase
        .from('items')
        .update({ phase_id: data.phaseId, position: await nextPosition(supabase, 'items', 'phase_id', data.phaseId) })
        .eq('id', data.id),
    )
  })

export const deleteItemFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => ({ id: uuid(obj(d).id) }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const files = check(await supabase.from('notations').select('file_path').eq('item_id', data.id).not('file_path', 'is', null))
    check(await supabase.from('items').delete().eq('id', data.id))
    await removeFiles(supabase, (files ?? []).map((f) => f.file_path as string))
  })

// ---------- notation ---------------------------------------------------------------------------

export const saveNotationFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => {
    const x = obj(d)
    return {
      id: x.id ? uuid(x.id) : null,
      itemId: uuid(x.itemId, 'Item'),
      title: text(x.title, 'Title', { min: 1, max: 120 }),
      caption: optText(x.caption, 'Caption', 300),
      tex: text(x.tex, 'alphaTex', { min: 1, max: 50000 }),
    }
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const row = { title: data.title, caption: data.caption, format: 'alphatex' as const, tex: data.tex, file_path: null }
    if (data.id) check(await supabase.from('notations').update(row).eq('id', data.id))
    else
      check(
        await supabase
          .from('notations')
          .insert({ item_id: data.itemId, position: await nextPosition(supabase, 'notations', 'item_id', data.itemId), ...row }),
      )
  })

const TAB_EXT = ['gp', 'gp3', 'gp4', 'gp5', 'gp7', 'gpx', 'gtp'] as const
const MAX_TAB_BYTES = 5 * 1024 * 1024

export const uploadTabFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error('Expected a form upload')
    return d
  })
  .handler(async ({ data: form, context }) => {
    const supabase = context.supabase
    const itemId = uuid(form.get('itemId'), 'Item')
    const title = text(form.get('title'), 'Title', { min: 1, max: 120 })
    const caption = optText(form.get('caption'), 'Caption', 300)
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) throw new Error('Choose a Guitar Pro file')
    if (file.size > MAX_TAB_BYTES) throw new Error('File is too large (max 5 MB)')
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!(TAB_EXT as readonly string[]).includes(ext)) throw new Error(`Unsupported file type. Use: ${TAB_EXT.map((e) => '.' + e).join(' ')}`)

    const base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'tab'
    const path = `${itemId}/${crypto.randomUUID().slice(0, 8)}-${base}.${ext}`
    const up = await supabase.storage.from('tabs').upload(path, file, { contentType: 'application/octet-stream' })
    if (up.error) throw new Error(`Upload failed: ${up.error.message}`)

    const res = await supabase.from('notations').insert({
      item_id: itemId,
      position: await nextPosition(supabase, 'notations', 'item_id', itemId),
      title,
      caption,
      format: 'file',
      file_path: path,
    })
    if (res.error) {
      await removeFiles(supabase, [path]) // don't leave an orphan if the row failed
      throw new Error(res.error.message)
    }
  })

export const deleteNotationFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => ({ id: uuid(obj(d).id) }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const row = check(await supabase.from('notations').select('file_path').eq('id', data.id).maybeSingle())
    check(await supabase.from('notations').delete().eq('id', data.id))
    if (row?.file_path) await removeFiles(supabase, [row.file_path])
  })

// ---------- ordering ---------------------------------------------------------------------------

export const reorderFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => {
    const x = obj(d)
    const ids = Array.isArray(x.ids) ? x.ids : []
    if (ids.length === 0 || ids.length > 200) throw new Error('Nothing to reorder')
    const kind = oneOf(x.kind, ['phases', 'items', 'notations'] as const, 'Kind')
    return { kind, ids: ids.map((i) => uuid(i)) }
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    // Small lists, so one update per row is fine and keeps each write under RLS.
    const results = await Promise.all(
      data.ids.map((id, position) => supabase.from(data.kind).update({ position }).eq('id', id)),
    )
    for (const r of results) check(r)
  })

export const reorderTracksFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => {
    const slugs = Array.isArray(obj(d).slugs) ? (obj(d).slugs as unknown[]) : []
    return { slugs: slugs.map((s) => slug(s)) }
  })
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const results = await Promise.all(data.slugs.map((s, position) => supabase.from('tracks').update({ position }).eq('slug', s)))
    for (const r of results) check(r)
  })

// ---------- chord library ----------------------------------------------------------------------

export const saveChordFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(parseChord)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const { isNew, id, ...row } = data
    if (isNew) check(await supabase.from('chords').insert({ id, ...row }))
    else check(await supabase.from('chords').update(row).eq('id', id))
  })

export const deleteChordFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator((d: unknown) => ({ id: text(obj(d).id, 'Id', { min: 1, max: 12 }) }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase
    const used = check(await supabase.from('items').select('title').contains('chords', [data.id]))
    if (used?.length) throw new Error(`Used by ${used.length} lesson(s), e.g. "${used[0].title}". Remove it from them first.`)
    check(await supabase.from('chords').delete().eq('id', data.id))
  })
