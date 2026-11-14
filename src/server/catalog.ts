import { createServerFn } from '@tanstack/react-start'
import type { CatalogEntry, Chord, Item, Notation, Phase, Track } from '~/content/types'
import { getSupabase } from '~/lib/supabase.server'

type Db = ReturnType<typeof getSupabase>

export function publicFileUrl(path: string) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/tabs/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function rowToChord(r: { id: string; name: string; frets: number[]; fingers: number[]; barre: Chord['barre'] }): Chord {
  return { id: r.id, name: r.name, frets: r.frets, fingers: r.fingers, barre: r.barre ?? undefined }
}

/** Loads one track with phases, items, chord diagrams and notation. RLS decides what the caller may see. */
export async function loadTrack(supabase: Db, slug: string): Promise<Track | null> {
  const { data: t, error } = await supabase.from('tracks').select('*').eq('slug', slug).maybeSingle()
  if (error) throw new Error(error.message)
  if (!t) return null

  const [phasesRes, itemsRes, chordsRes] = await Promise.all([
    supabase.from('phases').select('*').eq('track_slug', slug).order('position'),
    supabase.from('items').select('*').eq('track_slug', slug).order('position'),
    supabase.from('chords').select('*'),
  ])
  for (const r of [phasesRes, itemsRes, chordsRes]) if (r.error) throw new Error(r.error.message)

  const items = itemsRes.data ?? []
  const notationRes = items.length
    ? await supabase.from('notations').select('*').in('item_id', items.map((i) => i.id)).order('position')
    : { data: [], error: null }
  if (notationRes.error) throw new Error(notationRes.error.message)

  const chordById = new Map((chordsRes.data ?? []).map((c) => [c.id, rowToChord(c)]))
  const notationsByItem = new Map<string, Notation[]>()
  for (const n of notationRes.data ?? []) {
    const list = notationsByItem.get(n.item_id) ?? []
    list.push({
      id: n.id,
      title: n.title,
      caption: n.caption,
      tex: n.format === 'alphatex' ? n.tex : null,
      fileUrl: n.format === 'file' && n.file_path ? publicFileUrl(n.file_path) : null,
    })
    notationsByItem.set(n.item_id, list)
  }

  const toItem = (i: (typeof items)[number]): Item => {
    const itemChords = i.chords.map((id: string) => chordById.get(id)).filter((c: Chord | undefined): c is Chord => !!c)
    const notation = notationsByItem.get(i.id)
    return {
      id: i.id,
      slug: i.slug,
      kind: i.kind,
      title: i.title,
      detail: i.detail,
      query: i.query,
      media:
        itemChords.length || notation?.length
          ? { chords: itemChords.length ? itemChords : undefined, chordNote: i.chord_note, notation }
          : undefined,
    }
  }

  const phases: Phase[] = (phasesRes.data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    months: p.months,
    summary: p.summary,
    milestone: { slug: p.milestone_slug, text: p.milestone_text },
    items: items.filter((i) => i.phase_id === p.id).map(toItem),
  }))

  return {
    slug: t.slug,
    path: t.path,
    style: t.style,
    title: t.title,
    blurb: t.blurb,
    tagline: t.tagline,
    status: t.status,
    warmupSlug: t.warmup_slug,
    habits: t.habits,
    graduation: t.graduation,
    phases,
  }
}

export const getCatalogFn = createServerFn({ method: 'GET' }).handler(async (): Promise<CatalogEntry[]> => {
  const { data, error } = await getSupabase()
    .from('tracks')
    .select('slug, path, style, title, blurb, status')
    .neq('status', 'draft')
    .order('position')
  if (error) throw new Error(error.message)
  return data ?? []
})

export const getTrackFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => ({ slug: String((d as { slug?: unknown })?.slug ?? '') }))
  .handler(async ({ data }) => loadTrack(getSupabase(), data.slug))
