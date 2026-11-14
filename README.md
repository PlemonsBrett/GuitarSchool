# Guitar School

A guided roadmap for learning guitar: what to practice, where to look next, and a record of your progress.
Fewer video lessons, more "go here next". Built with TanStack Start, deployed to Cloudflare Workers, Supabase for auth and data.

## Structure

- **Paths:** Acoustic (Traditional, Fingerstyle) and Electric (Rhythm, Lead). Only **Electric Lead** is published; the rest show as "coming soon".
- **The catalog lives in Supabase and is managed at `/admin`:** tracks, phases, lessons, chord shapes and tabs. Learners' progress lives alongside it. See `supabase/migrations/`. Every table uses RLS: learners see only their own progress, the public sees only published content, and only admins can write.
- **Seed data:** `scripts/seed/` holds the original Electric Lead curriculum. `pnpm seed:generate` turns it into the seed migration. It was a one-time import; after that, edit content in `/admin`.
- **"Where to look next":** each item links to search URLs (tabs, lessons, backing tracks) built from the item, so links never go stale.

## Notation and diagrams

- **Chord diagrams:** shapes are in the chord library (`/admin/chords`) and drawn as SVG. Attach them to a lesson from its editor.
- **Guitar Pro style tab + standard notation:** attach either a Guitar Pro file (`.gp`, `.gp5`, `.gp7`, `.gpx`…) or hand-written [alphaTex](https://alphatab.net/docs/alphatex) with a live preview. Rendered by alphaTab, loaded on demand when someone opens a lesson.
- **Songs:** the seed does not include transcriptions of copyrighted songs; songs link out to licensed tabs. What you upload is up to you. Uploaded files are stored in a **public** bucket, so anyone with the link can download them. Only upload tabs you have the right to share.

## Admin

1. Sign up in the app, then make yourself an admin once, in the Supabase SQL editor:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

   There is deliberately no way to do this from the app or the API.
2. An **Admin** link appears in the header. From there:
   - **Catalog:** tracks by path, with `draft` (admins only), `coming soon` (listed, locked) and `published` status, and ordering.
   - **Track editor:** details, phases, milestones, lessons (drills and songs), chord diagrams, tabs, ordering, and a "preview as learner" link.
   - **Chords:** the shared chord library with a live diagram preview.
3. Slugs for tracks, phases and lessons are set once and never change, because learners' progress is keyed to them.

## Develop

```sh
pnpm install
cp .dev.vars.example .dev.vars   # fill in your Supabase URL + publishable key
pnpm dev                         # http://localhost:3000
pnpm test
```

The site reads its catalog from Supabase, so local development needs a Supabase project (or the local Supabase stack) with the migrations applied.

## Supabase setup

1. Create a project and apply `supabase/migrations/*.sql` in order (SQL editor, or `supabase db push`). That creates the tables, the seed catalog, and the public `tabs` storage bucket.
2. Auth settings: enable Email provider; set Site URL to your deployed URL.
3. Put the project URL and **publishable** key in `.dev.vars`. Never use the service-role key in this app.

## Deploy (Cloudflare Workers)

```sh
pnpm wrangler secret put SUPABASE_URL
pnpm wrangler secret put SUPABASE_PUBLISHABLE_KEY
pnpm deploy
```
