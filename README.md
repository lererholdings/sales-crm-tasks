# sales-crm-tasks

A personal sales task management system for tracking pre-sale and post-sale activities across customers, prospects, partners, and distributors.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) |
| Hosting | Vercel |
| Database | Supabase (Postgres) |
| Auth | Clerk |
| Version control | GitHub |

## Repository structure

```
sales-crm-tasks/
  docs/
    design.md        ← full PRD + Technical Design Document
    mockups/
      main-view-v3.html  ← final approved UI mockup (open in browser)
  db/
    schema.sql       ← flattened reference copy of the schema (not the applied source)
  supabase/
    migrations/       ← Supabase CLI migrations — the applied source of truth
  frontend/          ← React app
  api/               ← Vercel serverless functions
```

## Database migrations

Schema changes are deployed via the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started):

```
npx supabase login                          # one-time, opens browser
npx supabase link --project-ref <ref>       # one-time, links this repo to your Supabase project
npx supabase db push                        # applies any pending migrations in supabase/migrations/
```

To make a schema change, add a new file to `supabase/migrations/` (timestamp-prefixed, e.g. `npx supabase migration new <name>`) rather than editing existing migrations.

## Getting started

See `docs/design.md` for the full system design, data model, and implementation plan.

## Status

- [x] System design
- [x] Data model + schema
- [x] API spec
- [x] UI mockup (docs/mockups/main-view-v3.html)
- [x] Frontend component map
- [x] Implementation plan
- [ ] Deployment
