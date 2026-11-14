# Guitar School

A guided roadmap for learning guitar: what to practice, where to look next, and a record of your progress.
Fewer video lessons, more "go here next". Built with TanStack Start, deployed to Cloudflare Workers, Supabase for auth and data.

## Structure

- **Paths:** Acoustic (Traditional, Fingerstyle) and Electric (Rhythm, Lead). Only **Electric Lead** is published; the rest show as "coming soon".
- **Curriculum lives in code:** `src/content/`. To add a track, create a `Track` file, register it in `src/content/index.ts`, and set `published: true`. Edits ship with a normal deploy.
- **Supabase stores only user data:** tracks started, completed items, practice logs. See `supabase/migrations/`. All tables use RLS (users only see their own rows).
- **"Where to look next":** each item links to search URLs (tabs, lessons, backing tracks) built from the item, so links never go stale.

## Develop

```sh
pnpm install
cp .dev.vars.example .dev.vars   # fill in your Supabase URL + publishable key
pnpm dev                         # http://localhost:3000
pnpm test
```

## Supabase setup

1. Create a project and apply `supabase/migrations/*.sql` (SQL editor, or `supabase db push`).
2. Auth settings: enable Email provider; set Site URL to your deployed URL.
3. Put the project URL and **publishable** key in `.dev.vars`. Never use the service-role key in this app.

## Deploy (Cloudflare Workers)

```sh
pnpm wrangler secret put SUPABASE_URL
pnpm wrangler secret put SUPABASE_PUBLISHABLE_KEY
pnpm deploy
```
