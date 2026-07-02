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

## Database access

`api/` functions talk to Postgres directly via the `pg` driver (`DATABASE_URL`), not the Supabase JS client — see `docs/design.md` section 12, "Database access pattern," for why. `DATABASE_URL` must be the **Transaction pooler** connection string (port 6543), not the direct :5432 one — serverless functions need pooled connections.

There are two Supabase projects (see section 12, "Environment separation"):
- **Production** (`uuuppszvwbgmyyvrgwmy`) — used by the Vercel Production deployment (`main`)
- **Dev** (`mtloxubtjinllxaenavu`) — used by local development and Vercel Preview deployments

`DATABASE_URL` is scoped per-environment in Vercel accordingly. Both use the Transaction pooler at `aws-1-ap-southeast-2.pooler.supabase.com:6543`, user `postgres.<project-ref>` — only the ref and password differ.

## Database migrations

Schema changes are deployed via the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started). Since there are two projects, migrations are pushed to each individually — `supabase link` only tracks one project at a time:

```
npx supabase login                                        # one-time, opens browser

npx supabase link --project-ref mtloxubtjinllxaenavu       # switch link to the dev project
npx supabase db push

npx supabase link --project-ref uuuppszvwbgmyyvrgwmy       # switch link to the prod project
npx supabase db push
```

To make a schema change, add a new file to `supabase/migrations/` (timestamp-prefixed, e.g. `npx supabase migration new <name>`) rather than editing existing migrations — then push it to both projects.

## Tracking follow-ups

- **Concrete, closeable action items** ("fix X before go-live") → [GitHub Issues](https://github.com/lererholdings/sales-crm-tasks/issues)
- **Standing architectural decisions/constraints** that should shape how future work gets built → the "Design decisions log" (`docs/design.md` section 12)

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
