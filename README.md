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

## Workflow

- Each milestone is developed on its own branch (`milestone-N-description`) and merged to `main` via a **GitHub Pull Request** — not a local fast-forward merge. This gives a real, reviewable PR history.
- Nothing gets pushed to any branch (including feature branches, not just `main`) without explicit confirmation first.
- Doc/decision updates that come up mid-conversation are written into the docs immediately but committed as part of the next milestone's work, not as standalone pushes.

## Repository structure

```
sales-crm-tasks/
  docs/
    design.md        ← full PRD + Technical Design Document
    operations.md    ← reference: project IDs, URLs, env var matrix, current state
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

## Dev database maintenance

Both scripts live in `scripts/` and hard-refuse to run unless `DATABASE_URL` contains the dev project ref (`mtloxubtjinllxaenavu`) — that check is the actual safety mechanism, not just a warning. Same shell-sourcing as above is needed to run them locally.

```
npm run db:reset-dev    # clears accounts/tasks/task_notes/audit_log — leaves users and task_types alone. Interactive confirm, or pass --yes
npm run db:seed-dev     # inserts a handful of demo accounts as an optional starting point. Safe to re-run — skips accounts that already exist by name
```

## Testing

Three tiers, all run in CI on every push (the third only for non-`main` branches):

- **Unit tests** (`npm test`, `npm --prefix frontend run test`) — everything external (DB, Clerk) is mocked. Fast, no secrets needed, safe for anyone to run.
- **Integration tests** (`npm run test:integration`) — run the real `api/` handlers *in-process* against the real dev database, authenticated via the test bypass (see `docs/design.md` section 12, "Test auth bypass") instead of a real Clerk login. Requires `DATABASE_URL` (dev project) and `TEST_AUTH_BYPASS_SECRET`. Test rows use a `test_ci_*` `clerk_user_id` prefix and are cleaned up after each run.
- **Live preview verification** (CI job `verify-preview-deployment`) — waits for the actual Vercel Preview deployment to come up, then hits it over real HTTP with the Vercel protection bypass header + the test auth bypass header. This is the only tier that proves the *deployed* app works, not just the code — catches env var scoping mistakes, routing issues, etc. Requires `TEST_AUTH_BYPASS_SECRET` to also be set in Vercel's **Preview** environment (never Production — see design.md section 12).

To run integration tests locally, both vars need to be in your shell environment (not just `.env.local` — vitest doesn't auto-load it the way Vite does for the frontend):

```
set -a && source <(grep -v '^#' .env.local | grep -v '^$') && set +a
npm run test:integration
```

## Tracking follow-ups

- **Concrete, closeable action items** ("fix X before go-live") → [GitHub Issues](https://github.com/lererholdings/sales-crm-tasks/issues)
- **Standing architectural decisions/constraints** that should shape how future work gets built → the "Design decisions log" (`docs/design.md` section 12)

## Getting started

See `docs/design.md` for the full system design, data model, and implementation plan. See `docs/operations.md` for concrete project IDs, URLs, and which secrets live where.

## Status

- [x] System design
- [x] Data model + schema
- [x] API spec
- [x] UI mockup (docs/mockups/main-view-v3.html)
- [x] Frontend component map
- [x] Implementation plan
- [ ] Deployment
