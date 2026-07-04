# Operations reference

Concrete "where things live" facts — accounts, project IDs, URLs, and which
secrets live where. Never put actual secret values here, only names and
where to find/rotate them.

- **Why** a decision was made → `docs/design.md` section 12 (Design decisions log)
- **How to** run/test/deploy → `README.md`
- **What currently exists and where** → this file

Update this as new infrastructure gets added each milestone.

_Milestone 4 branch note: this specific edit is a real (non-empty) markdown-only diff, used to verify the Vercel Ignored Build Step correctly cancels Preview builds too, not just direct pushes to `main` (an empty commit isn't a valid test of this — it trivially skips regardless of the exclude patterns actually working)._

---

## Accounts & projects

| Service | Project / org | Dashboard |
|---|---|---|
| GitHub | `lererholdings/sales-crm-tasks` | https://github.com/lererholdings/sales-crm-tasks |
| Vercel | `sales-crm-tasks`, team `lerers-projects` | https://vercel.com/lerers-projects/sales-crm-tasks |
| Supabase — production | `uuuppszvwbgmyyvrgwmy`, region `ap-southeast-2`, org `ocwzsfhgzwcpirnwfoce` | https://supabase.com/dashboard/project/uuuppszvwbgmyyvrgwmy |
| Supabase — dev | `mtloxubtjinllxaenavu`, region `ap-southeast-2`, org `ocwzsfhgzwcpirnwfoce` | https://supabase.com/dashboard/project/mtloxubtjinllxaenavu |
| Clerk | `kind-hedgehog-70` — single instance, used across local/preview/production (no dev/prod split like Supabase has) | https://dashboard.clerk.com |

## URLs

| Environment | URL |
|---|---|
| Production | https://sales-crm-tasks-lerers-projects.vercel.app |
| Preview (per branch) | `https://sales-crm-tasks-git-<branch-slug>-lerers-projects.vercel.app` (branch names should stay lowercase-hyphenated for this to match) |
| Local frontend | http://localhost:5173 |
| Local api (`vercel dev`) | http://localhost:3000 |

**Vercel Deployment Protection is currently on for all deployments** (Production included) — a Vercel login or the bypass header is needed to reach any of them from outside a browser: `x-vercel-protection-bypass: <VERCEL_PROTECTION_BYPASS_SECRET>`. Tracked for removal from Production before go-live: [issue #1](https://github.com/lererholdings/sales-crm-tasks/issues/1).

## Environment variables — where each one lives

| Variable | `.env.local` (root) | `frontend/.env.local` | GitHub Actions secret | Vercel: Production | Vercel: Preview |
|---|---|---|---|---|---|
| `DATABASE_URL` | dev project | — | dev project (integration tests) | **prod** project | **dev** project |
| `CLERK_SECRET_KEY` | yes | — | no | yes | yes |
| `VITE_CLERK_PUBLISHABLE_KEY` | — | yes | no | yes | yes |
| `TEST_AUTH_BYPASS_SECRET` | yes | — | yes | **never** | yes |
| `VERCEL_PROTECTION_BYPASS_SECRET` | yes (verification only — not read by app code) | — | yes | n/a | n/a |

Where to get/rotate each value:
- `DATABASE_URL` — Supabase → Project Settings → Database → Connection Pooling → mode "Transaction" (port 6543, not the direct :5432 one)
- `CLERK_SECRET_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` — Clerk dashboard → API Keys
- `TEST_AUTH_BYPASS_SECRET` — self-generated (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), not tied to any external service
- `VERCEL_PROTECTION_BYPASS_SECRET` — Vercel → Project Settings → Deployment Protection → "Protection Bypass for Automation"

⚠️ Vercel only injects env var values into deployments created *after* the value was set/changed — a fresh push (or manual redeploy) is needed to pick up a change to an existing var.

## GitHub Milestones

Mirror `design.md`'s Milestone 1–10 titles exactly (created 2026-07-02, Milestone 1 closed since merged). Convention: closeable action items → issues tagged with their target milestone; standing architectural decisions → `design.md` section 12 instead (see README.md "Tracking follow-ups").

## Open issues checklist

Living index, grouped by target milestone — **check this section at the start and end of every milestone**, and update it immediately whenever an issue is filed/closed/retagged. Unlike other doc updates, this section is *not* gated by the "docs land with the next milestone's commits" workflow rule — it's a standing checklist, not narrative content tied to a specific milestone's own work.

**Milestone 5 — Core task UI**
- [#5](https://github.com/lererholdings/sales-crm-tasks/issues/5) — Archive/delete accounts + suggest-restore on similar create (blocked on tasks existing)

**Milestone 6 — Filters, sorting, and column preferences**
- [#7](https://github.com/lererholdings/sales-crm-tasks/issues/7) — Accounts list sortable columns + per-column filtering
- [#9](https://github.com/lererholdings/sales-crm-tasks/issues/9) — Accounts list ACV column + per-user column visibility/order
- [#10](https://github.com/lererholdings/sales-crm-tasks/issues/10) — No UI planned for admins to view soft-deleted tasks (needs a UI-level test when built, not just Milestone 4's API-level one)

**Milestone 9 — Hardening and edge cases**
- [#11](https://github.com/lererholdings/sales-crm-tasks/issues/11) — Spike: evaluate Kinde or Auth0 as an alternative to Clerk (throwaway branch, adopt only on a clear win)

**Milestone 10 — Deployment and go-live**
- [#1](https://github.com/lererholdings/sales-crm-tasks/issues/1) — Clerk sole access gate
- [#3](https://github.com/lererholdings/sales-crm-tasks/issues/3) — Prod admin seeding

**Unscheduled**
- [#2](https://github.com/lererholdings/sales-crm-tasks/issues/2) — Display name sync via JWT claims

**Recently closed**
- [#4](https://github.com/lererholdings/sales-crm-tasks/issues/4) — Skip CI for markdown-only changes (fixed in Milestone 3, `paths-ignore` on `**.md` + `docs/mockups/**`). **Known limitation, accepted as-is**: only skips for direct pushes to a branch with no open PR — once a PR exists, the same markdown-only commit still triggers a `pull_request: synchronize` run that isn't skipped (`paths-ignore` evaluates differently for that event, likely against the PR's cumulative diff rather than the latest commit). Verified both cases directly. Decision: docs-only commits within an open PR will still run CI — not pursuing a further fix.
- [#6](https://github.com/lererholdings/sales-crm-tasks/issues/6) — Skip Vercel redeploy for non-code changes. Fixed under Settings → Build and Deployment → Ignored Build Step → Custom: `git diff --quiet HEAD^ HEAD -- . ':(glob,exclude)**/*.md' ':(exclude)docs/mockups/**'`. Verified on a direct push to `main` — commit status shows "Canceled by Ignored Build Step". Caveat: a canceled build still counts against deployment quota/concurrent build slots, unlike CI's paths-ignore which skips the run entirely. Not yet verified whether this also cancels correctly for Preview builds on a branch with an open PR — check next time we're mid-PR, given the analogous GitHub Actions quirk (#4).

## Database

- Two Supabase projects (dev/prod), both Postgres 17, Transaction pooler at `aws-1-ap-southeast-2.pooler.supabase.com:6543`, user `postgres.<project-ref>` — only the ref and password differ between them
- Migrations live in `supabase/migrations/`, applied via the Supabase CLI — see README.md "Database migrations" for the exact commands (has to be pushed to each project individually)
- Current seeded users:
  - Dev: `lererholdings+01@gmail.com` (`clerk_user_id: user_3FwTFiI9OFhQDRhBH0va5mcg7ci`), role `admin`
  - Prod: none yet — see [issue #3](https://github.com/lererholdings/sales-crm-tasks/issues/3)

## Testing infrastructure

Three tiers, all wired into CI — see README.md "Testing" for commands and details:
1. Unit (mocked) — `api/**/*.test.js`, `frontend/src/**/__tests__`
2. Integration (real dev DB, in-process handler calls) — `api/**/*.integration.test.js`
3. Live preview verification (real HTTP against the deployed Preview URL) — CI job `verify-preview-deployment`, skipped on `main`
