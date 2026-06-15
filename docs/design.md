# Sales CRM Tasks — Design Document

> **Status:** In design  
> **Last updated:** June 2026  
> **Author:** Coby Lerer  

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Users and roles](#2-users-and-roles)
3. [Authentication](#3-authentication)
4. [Stack and infrastructure](#4-stack-and-infrastructure)
5. [Data model](#5-data-model)
6. [UI design](#6-ui-design)
7. [API design](#7-api-design) ← next to be completed
8. [Frontend components](#8-frontend-components) ← next to be completed
9. [Implementation plan](#9-implementation-plan) ← next to be completed
10. [Deployment guide](#10-deployment-guide) ← next to be completed
11. [Future features](#11-future-features)
12. [Design decisions log](#12-design-decisions-log)

---

## 1. Project overview

A personal sales task management system for a team of ~5 users. Tracks pre-sale and post-sale activities across customers, prospects, partners, and distributors. Replaces the need to manually surface tasks from email folders and memory.

### Core capabilities

- Kanban-style task tracking organized as a rich filterable/sortable table
- Tasks grouped visually by account + partner combination
- Pre-sale task types: Demo, POC, RFI, RFP, Follow-up
- Post-sale task types: Support ticket follow-up, Technical session, Best practice advice, Focus demo
- Account task types: Quote/renewal, New contract
- Task types are admin-configurable
- Timestamped notes per task (append-only log, markdown supported)
- Assignee and next action per task
- Priority, status, and ETA tracking
- Links to Salesforce records (account + task level, open in new tab)
- Audit log of all changes and view events (admin only)
- Column reordering and visibility preferences per user

### Out of scope (for now)

- Salesforce API integration (links only)
- Outlook plugin (hooks are in place in the schema)
- Mobile app
- Email notifications / reminders

---

## 2. Users and roles

~5 internal users. Two roles:

| Role | Capabilities |
|---|---|
| **admin** | Full access to tasks and accounts + audit log viewer + manage task types + manage users |
| **member** | Full access to tasks and accounts. No audit log. No admin settings. |

All users see all accounts and all tasks — no visibility restrictions for now.

---

## 3. Authentication

**Provider: Clerk** (free tier, up to 10,000 MAU)

- Clerk handles all password storage, session management, and device tracking
- No passwords stored in our database
- Session duration: 14 days per device
- Our database stores only `clerk_user_id` as a reference
- Auth middleware on every API route validates the Clerk session token and resolves the internal `user_id`
- Role is stored in our `users` table, not in Clerk

**Why Clerk over Supabase Auth:**
Avoids proprietary lock-in to Supabase. Clerk works with any backend and can be swapped out by changing auth middleware only.

---

## 4. Stack and infrastructure

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + Vite | Industry standard, large ecosystem |
| Frontend hosting | Vercel (free tier) | Zero-config deploys from GitHub, free for personal projects |
| Backend | Vercel serverless functions | Co-located with frontend, no separate server to manage |
| Database | Supabase — plain Postgres | Relational data fits perfectly; free tier; hosted Postgres without Supabase proprietary lock-in |
| Auth | Clerk (free tier) | Dedicated auth service, no password storage on our side, easy to migrate |
| Version control | GitHub (private repo under lererholdings org) | Integrates directly with Vercel for auto-deploy |

**Avoiding proprietary lock-in:** Supabase is used purely as a hosted Postgres database. No Supabase Auth, no Supabase Realtime, no auto-generated APIs. All queries go through our own API layer. Migrating to AWS RDS or any other Postgres host in future requires only a connection string change.

**Cost:** Zero. All services used within permanent free tiers. No credit card surprises.

**Future migration path to AWS:** Frontend → S3 + CloudFront (config change only). API → Lambda + API Gateway (repackaging, moderate effort). Database → RDS Postgres (connection string change + data export/import).

---

## 5. Data model

### Entity overview

```
users
  └── tasks (assignee)
  └── task_notes (author)
  └── audit_log (actor)
  └── user_preferences (1:1)

accounts
  └── tasks (1:many)

task_types
  └── tasks (1:many)

tasks
  └── task_notes (1:many)
```

### Enums

| Enum | Values |
|---|---|
| `user_role` | admin, member |
| `task_status` | backlog, in_progress, waiting, done |
| `task_priority` | critical, high, medium, low |
| `task_category` | pre-sale, post-sale, account |
| `audit_action` | created, updated, deleted, viewed |
| `external_source` | manual, outlook, sfdc |

### Tables

#### users
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| clerk_user_id | TEXT UNIQUE | Reference to Clerk |
| display_name | TEXT | |
| email | TEXT UNIQUE | |
| role | user_role | Default: member |
| created_at | TIMESTAMPTZ | |

#### accounts
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |
| country | TEXT | Required. Not searchable via API — display only |
| acv | NUMERIC(15,2) | Annual Contract Value. Patchable. History via audit_log |
| sfdc_account_url | TEXT | Opens in new tab |
| last_updated_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Auto-updated by trigger |

#### task_types
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| category | task_category | |
| name | TEXT | |
| active | BOOLEAN | Default: true. Admin can deactivate |
| | | UNIQUE (category, name) |

#### tasks
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| task_name | TEXT | Short title shown in table |
| account_id | UUID FK → accounts | **Nullable.** Null = partner-only task with no known end customer. Set via "Link to account" action. ON DELETE RESTRICT |
| partner_name | TEXT | Nullable. Editable per task |
| distributor_name | TEXT | Nullable. Editable per task |
| task_type_id | UUID FK → task_types | |
| status | task_status | Default: backlog |
| priority | task_priority | Default: medium |
| eta | DATE | |
| next_action | TEXT | Short description of immediate next step |
| assignee_id | UUID FK → users | Mandatory. ON DELETE RESTRICT |
| sfdc_task_url | TEXT | Opens in new tab |
| external_source | external_source | Default: manual |
| external_id | TEXT | Future: Outlook message ID or SFDC task ID |
| email_ref | TEXT | Future: email message-id header |
| deleted_at | TIMESTAMPTZ | Null = active. Soft delete — row never removed |
| deleted_by | UUID FK → users | Who soft-deleted the task |
| last_updated_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Auto-updated by trigger |

**Notes on tasks:**
- No `country` field — country is on the account only
- No `contract_value` field — ACV is on the account only
- `assignee_id` is mandatory — cannot create or save a task without one
- Soft delete: `DELETE /api/tasks/:id` sets `deleted_at` + `deleted_by`. Non-admin queries always filter `WHERE deleted_at IS NULL`. Admins can pass `?include_deleted=true` (JWT role validated server-side).
- Multiple tasks can share the same account + partner — no uniqueness constraint

#### task_notes
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| task_id | UUID FK → tasks | ON DELETE CASCADE |
| user_id | UUID FK → users | Original author |
| content | TEXT | Markdown supported |
| last_updated_by | UUID FK → users | Populated if note is edited |
| edited_at | TIMESTAMPTZ | Null if never edited |
| deleted_at | TIMESTAMPTZ | Null = active. Soft-deleted when parent task is deleted |
| deleted_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | |

**Edit permission rule:** A note can only be edited by its original author (`user_id`) AND only if no newer note exists on the same task after it. Enforced server-side — not UI only.

#### user_preferences
| Column | Type | Notes |
|---|---|---|
| user_id | UUID PK FK → users | 1:1 with users |
| column_order | JSONB | Ordered array of column keys |
| column_visibility | JSONB | { column_key: true/false } |
| notes_preview_count | INT | How many notes shown inline. Default: 2 |

#### audit_log
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| entity_type | TEXT | task / account / task_note / task_type / user |
| entity_id | UUID | |
| user_id | UUID FK → users | Who performed the action |
| action | audit_action | created / updated / deleted / viewed |
| changed_fields | JSONB | { field: { from: x, to: y } }. Null for viewed |
| timestamp | TIMESTAMPTZ | |

**Audit log access:** Admin role only, enforced at API middleware layer.

**What triggers a viewed event:** Opening the task side panel, expanding all notes, opening account details.

### Database file

See `db/schema.sql` for the complete production-ready DDL including triggers, indexes, and seed data.

---

## 6. UI design

### Layout

Single-page application with four main areas:

1. **Task table** (main view, default on login)
2. **Task side panel** (slides in when a task row is clicked)
3. **Account manager** (create/edit accounts)
4. **Admin settings** (task types, user management, audit log — admin only)

### Task table

The primary working view. Rows are grouped by account + partner combination with collapsible group headers.

**Group header labelling rules:**
- Account + partner → `Acme Corp — PartnerX`
- Account, no partner → `Acme Corp`
- Partner only, no account yet → `PartnerZ` + a "Partner only" pill badge

**Example layout:**
```
▼ Acme Corp — PartnerX          2 tasks
     RFP response   High   In progress   Sara   20 Jun   2d: Sent initial draft
     Product demo   Medium Backlog       John   30 Jun   5d: Scheduled end of month

▼ Acme Corp                     1 task
     Renewal quote  High   Backlog       John   15 Jul   today: Contract expires Aug 1

▼ PartnerZ  [Partner only]      1 task
     Partner RFI    High   Backlog       Mike   25 Jun   1d: Asked about pricing tiers

▼ BetaCo                        1 task
     Support f/up   Low    Waiting       Mike   —        3d: Escalated to tier 2
```

**Columns (all reorderable and toggleable per user):**

| Column key | Label | Notes |
|---|---|---|
| task_name | Task | Clickable → opens side panel. Hover reveals ⋯ context menu |
| type | Type | Category · subtype |
| assignee | Assignee | Avatar (green/blue initials circle) + name |
| next_action | Next action | Short text |
| priority | Priority | Colour-coded pill badge |
| status | Status | Colour-coded pill |
| eta | ETA | Date. Red + bold if overdue or imminent |
| notes_preview | Notes | Last N notes inline (N = user preference, default 2) |
| last_updated | Last updated | Timestamp + user |

**Toolbar:**
- Filter chips: Status, Assignee, Priority, Type, Partner (active chip highlights in green)
- Free text search across task name, account name, notes
- Columns toggle panel (show/hide/reorder)
- "+ New task" button (emerald)

**Context menu (⋯ on row hover):**
Appears as a floating menu on the task name cell. Always contains: Edit task, Duplicate, Delete task. For partner-only tasks (no account): also shows "Link to account" at the top in green.

**Notes preview inline:**
Format: `2d: Sent initial draft to customer`. Shows last N notes (N from user preferences).

### Task side panel

Slides in from the right. Does not navigate away from the table.

```
[Task Name]                              [Status]  [Priority]
──────────────────────────────────────────────────────────────
Account context (editable)
  Account: [dropdown]   Partner: [text field]
  Distributor: [text]   Contract value: [$]
  Country: [read from account]
  SFDC Account ↗        SFDC Task ↗

Task detail
  Type: [dropdown]   Subtype: [dropdown]   ETA: [date]
  Assignee: [user dropdown — mandatory]
  Next action: [text field]
  Last updated by [name] on [date]

Notes timeline (chronological, oldest first)
  [date] [user]  note content (markdown rendered)
  [date] [user]  note content
  ── Add a note ─────────────────────────────────
  [text area]
  [Post note]
```

- SFDC links open in a new tab
- Account defaults (partner, distributor, contract value) pre-populate from the selected account on new task creation but remain editable on the task
- Assignee is mandatory — cannot save a task without one

### New task form

Triggered by "+ New Task" button. Implemented as a modal or side panel.

- All dropdowns support type-to-filter (searchable select)
- Account selection auto-populates partner, distributor, contract value as defaults
- Assignee mandatory with no default
- Status defaults to backlog, priority defaults to medium

### Admin settings

Accessible from nav to admin users only. Three sections:

1. **Task types** — add, rename, activate/deactivate subtypes per category
2. **Users** — view users, change roles
3. **Audit log** — read-only table of all audit events, filterable by user, entity, action, date range

---

## 7. API design

### General conventions

- All endpoints prefixed `/api/`
- All requests and responses are JSON
- All endpoints require a valid Clerk session token: `Authorization: Bearer <token>`
- Auth middleware validates the token, resolves `user_id` + `role`, and attaches both to the request context
- Role checks (admin-only endpoints, `include_deleted`) are enforced at the endpoint level — not middleware only
- Audit logging is handled by middleware — not repeated per endpoint
- HTTP status codes: `200` success, `201` created, `400` bad request, `401` unauthenticated, `403` forbidden, `404` not found, `500` server error

---

### Auth

Clerk handles login/logout/session on the frontend. Our backend has no auth endpoints — only middleware.

```
Middleware: validateSession
  → reads Authorization header
  → verifies token with Clerk SDK
  → resolves clerk_user_id → internal user { id, role }
  → attaches to request context
  → rejects 401 if invalid or expired
```

---

### Accounts

#### `GET /api/accounts`
List all accounts.

**Query params:**
- `search` — filter by name (partial match)
- `include=acv` — include ACV in response (omitted by default)

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Acme Corp",
    "country": "Australia",
    "sfdc_account_url": "https://...",
    "acv": 120000,
    "last_updated_by": { "id": "uuid", "display_name": "John" },
    "updated_at": "2026-06-15T10:00:00Z"
  }
]
```
_`acv` only present when `?include=acv` passed._

---

#### `POST /api/accounts`
Create a new account.

**Body:**
```json
{
  "name": "Acme Corp",
  "country": "Australia",
  "acv": 120000,
  "sfdc_account_url": "https://..."
}
```
_`country` required. `acv` and `sfdc_account_url` optional._

**Response:** `201` — created account object.

---

#### `GET /api/accounts/:id`
Get a single account including ACV.

**Response:** Full account object including `acv`.

---

#### `PATCH /api/accounts/:id`
Update an account. Include only fields being changed.

**Body:** Any subset of `name`, `country`, `acv`, `sfdc_account_url`.

**Notes:** ACV changes are recorded in `audit_log` as `{ acv: { from: 50000, to: 120000 } }` — this is the ACV history trail.

**Response:** Updated account object.

---

### Tasks

#### `GET /api/tasks`
List all tasks. Supports all table filters and sorting.

**Query params:**

| Param | Type | Notes |
|---|---|---|
| `account_id` | UUID | Filter by account |
| `assignee_id` | UUID | Filter by assignee |
| `status` | enum | backlog / in_progress / waiting / done |
| `priority` | enum | critical / high / medium / low |
| `task_type_id` | UUID | Filter by subtype |
| `partner_name` | string | Partial match |
| `search` | string | Free text across task_name and notes |
| `sort_by` | string | Any column key |
| `sort_dir` | asc / desc | Default: asc |
| `notes_limit` | int | Latest N notes to inline. Default: 2 |
| `include_deleted` | bool | **Admin only.** 403 if non-admin. Default: false |

**Response:** Array of task objects (see shape below under `GET /api/tasks/:id`).

---

#### `POST /api/tasks`
Create a new task.

**Body:**
```json
{
  "task_name": "RFP response",
  "account_id": "uuid",
  "partner_name": "PartnerX",
  "distributor_name": null,
  "task_type_id": "uuid",
  "status": "backlog",
  "priority": "high",
  "eta": "2026-06-30",
  "next_action": "Send draft by Friday",
  "assignee_id": "uuid",
  "sfdc_task_url": null
}
```

**Validation:**
- `task_name` — required
- `account_id` — required, must exist
- `assignee_id` — required, must be an active internal user
- `task_type_id` — required, must be active

**Response:** `201` — created task object.

---

#### `GET /api/tasks/:id`
Get a single task with all notes (paginated).

**Query params:**
- `notes_limit` — int, default 25
- `notes_offset` — int, default 0
- `include_deleted` — bool, admin only

**Response:**
```json
{
  "id": "uuid",
  "task_name": "RFP response",
  "account": {
    "id": "uuid",
    "name": "Acme Corp",
    "country": "Australia",
    "acv": 120000,
    "sfdc_account_url": "https://..."
  },
  "partner_name": "PartnerX",
  "distributor_name": null,
  "task_type": { "id": "uuid", "category": "pre-sale", "name": "RFP" },
  "status": "in_progress",
  "priority": "high",
  "eta": "2026-06-30",
  "next_action": "Send draft by Friday",
  "assignee": { "id": "uuid", "display_name": "Sara" },
  "sfdc_task_url": "https://...",
  "last_updated_by": { "id": "uuid", "display_name": "John" },
  "updated_at": "2026-06-15T10:00:00Z",
  "deleted_at": null,
  "notes": [
    {
      "id": "uuid",
      "content": "Sent initial draft",
      "user": { "id": "uuid", "display_name": "Sara" },
      "created_at": "2026-06-14T09:00:00Z",
      "edited_at": null
    }
  ],
  "notes_total": 14
}
```
_`notes_total` allows the frontend to show "load more" pagination._

---

#### `PATCH /api/tasks/:id`
Update a task. Include only fields being changed.

**Body:** Any subset of task fields except `deleted_at`, `deleted_by`.

**Response:** Updated task object.

---

#### `DELETE /api/tasks/:id`
Soft-delete a task and all its notes.

**Auth:** Any authenticated user (frontend shows confirmation warning before calling).

**Behaviour:**
- Sets `deleted_at` = now() and `deleted_by` = requesting user on the task row
- Sets `deleted_at` + `deleted_by` on all related `task_notes` rows
- Writes two audit entries: one for the task, one summarising the note cascade
- Row is never removed from the database
- Non-admin queries will no longer return this task (`WHERE deleted_at IS NULL`)
- Admins can retrieve it via `?include_deleted=true`

**Response:** `200 { "deleted": true, "notes_deleted": 7 }`

---

### Task notes

#### `GET /api/tasks/:id/notes`
List notes for a task. Two modes — mutually exclusive:

**Preview mode** (`?preview=true`)
Returns the last N notes where N = requesting user's `notes_preview_count` preference. Used by the inline table row. Ignores `limit`/`offset`.

**Paginated mode** (default)
- `limit` — default 25
- `offset` — default 0

Both modes filter `WHERE deleted_at IS NULL` unless admin passes `?include_deleted=true`.

**Response:**
```json
{
  "notes": [
    {
      "id": "uuid",
      "content": "Sent initial draft",
      "user": { "id": "uuid", "display_name": "Sara" },
      "created_at": "2026-06-14T09:00:00Z",
      "edited_at": null,
      "last_updated_by": null
    }
  ],
  "total": 14,
  "limit": 25,
  "offset": 0
}
```

---

#### `POST /api/tasks/:id/notes`
Add a new note to a task.

**Body:**
```json
{ "content": "Customer confirmed receipt of draft." }
```

**Response:** `201` — created note object.

---

#### `PATCH /api/tasks/:id/notes/:noteId`
Edit an existing note.

**Server-side permission checks (both must pass — 403 otherwise):**
1. Requesting user is the original author (`user_id` on the note)
2. No newer note exists on the same task (`created_at` later than this note)

**Body:**
```json
{ "content": "Updated note content." }
```

**Response:** Updated note object with `edited_at` populated.

---

### Task types

#### `GET /api/task-types`
List task types. Members see active only. Admins see all.

**Response:**
```json
[
  { "id": "uuid", "category": "pre-sale", "name": "Demo", "active": true }
]
```

---

#### `POST /api/task-types`
Create a new task type. **Admin only.**

**Body:**
```json
{ "category": "pre-sale", "name": "Workshop" }
```

**Response:** `201` — created task type.

---

#### `PATCH /api/task-types/:id`
Update name or active status. **Admin only.**

**Body:** Any subset of `name`, `active`.

**Response:** Updated task type.

---

### User preferences

#### `GET /api/preferences`
Get the current user's column preferences.

**Response:**
```json
{
  "column_order": ["task_name", "account", "partner", "priority", "status", "eta"],
  "column_visibility": { "distributor_name": false },
  "notes_preview_count": 2
}
```

---

#### `PATCH /api/preferences`
Save column preferences. Partial update supported.

**Body:** Any subset of `column_order`, `column_visibility`, `notes_preview_count`.

**Response:** Updated preferences object.

---

### Users

#### `GET /api/users`
List all users. Used to populate assignee dropdowns.

**Response:**
```json
[
  { "id": "uuid", "display_name": "Sara", "email": "sara@...", "role": "member" }
]
```

---

#### `PATCH /api/users/:id`
Update a user's role. **Admin only.**

**Body:** `{ "role": "admin" }`

**Response:** Updated user object.

---

### Audit log

#### `GET /api/audit-log`
**Admin only.** Read-only list of all audit events.

**Query params:**

| Param | Type |
|---|---|
| `user_id` | UUID |
| `entity_type` | task / account / task_note / task_type / user |
| `action` | created / updated / deleted / viewed |
| `from` | ISO date |
| `to` | ISO date |
| `limit` | int (default 100) |
| `offset` | int (default 0) |

**Response:**
```json
[
  {
    "id": "uuid",
    "entity_type": "task",
    "entity_id": "uuid",
    "user": { "id": "uuid", "display_name": "John" },
    "action": "updated",
    "changed_fields": { "status": { "from": "backlog", "to": "in_progress" } },
    "timestamp": "2026-06-15T10:00:00Z"
  }
]
```

---

### Future endpoints (Outlook plugin)

No schema changes needed when these are built:

```
POST  /api/tasks/from-email      → create task from Outlook plugin
PATCH /api/tasks/:id/from-email  → update task from Outlook plugin
```

---

## 8. Frontend components

_To be completed in next design session._

---

## 9. Implementation plan

_To be completed in next design session._

---

## 10. Deployment guide

_To be completed in next design session._

---

## 10b. UI mockups

Visual mockups are saved as standalone interactive HTML files in `docs/mockups/`. Open in any browser.

| File | Description |
|---|---|
| `main-view-v3.html` | Final approved main view — task table with grouping, side panel, context menu, partner-only task row |

**Mockup notes:**
- Colour palette: emerald/green (`#085041` navbar, `#1D9E75` accents, `#9FE1CB` group headers)
- Avatars: green and blue initials circles only — no other colours
- Context menu (⋯): appears on row hover. Partner-only rows show "Link to account" in green at top
- Group labels: `Account — Partner` / `Account` / `Partner [Partner only]`
- Selected row: subtle gray background + green left border (not a coloured fill)
- Task names: soft green (`#1D9E75`) — readable without being harsh
- **Dark mode**: required feature. Toggle in navbar. Also auto-respects OS-level dark mode preference (`prefers-color-scheme`). Dark surfaces: `#1a1f1e` page, `#222927` panels, `#0F4035` group headers

---

## 11. Future features

| Feature | Notes |
|---|---|
| Outlook plugin | Auto-create or update tasks from emails. Schema hooks (`email_ref`, `external_id`, `external_source`) already in place. API endpoints (`/tasks/from-email`) to be added. |
| Salesforce API pull | Pull account and opportunity data automatically instead of manual links. |
| Email digest / reminders | Daily summary of tasks with approaching ETAs sent to assignees. |
| Follow-up auto-ETA | Set a task to auto-calculate ETA as `today + N days` for partner follow-ups. |
| Mobile view | Responsive layout or dedicated mobile UI. |

---

## 12. Design decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Database type | Postgres (not MongoDB) | Data is relational and structured. Postgres is the better architectural fit. MongoDB offers no advantage here. |
| Auth provider | Clerk (not Supabase Auth) | Avoids Supabase proprietary lock-in. No passwords stored on our side. Easier future compliance. |
| Supabase usage | Plain Postgres only | No Supabase Auth, Realtime, or auto-API. Keeps migration path open. |
| Kanban vs table | Rich table with grouped rows | Table provides more data density. Grouping by account + partner gives visual organisation without losing filtering/sorting. |
| Task uniqueness | No unique constraint on account + partner | Multiple concurrent tasks per account + partner is a valid and common scenario (e.g. Demo + RFP running simultaneously). |
| Account fields on task | Partner/distributor editable per task, ACV on account only | Supports scenario where two different partners target the same prospect. ACV is a single source of truth on the account, history tracked via audit log. |
| SFDC integration | Links only (no API) | Sufficient for current needs. Full API pull deferred to future feature. |
| Audit log visibility | Admin only | Enforced at API middleware. Not a UI-level restriction only. |
| Column layout | User preferences in DB | Per-user column order and visibility stored in `user_preferences` table as JSONB. Survives browser/device changes. |
| Notes | Append log with timestamps | Notes are a communication trail, not a single editable field. Each note is a separate record with author and timestamp. |
| Clerk login UI | Clerk hosted page (no custom login UI) | Clerk redirects unauthenticated users to its hosted login and returns them via callback. We own zero login, password reset, or session UI. |
| Clerk session lifetime | Free tier accepted (7-day rolling session) | Clerk uses short-lived JWTs (60s) silently refreshed by the SDK while the user is active. The 7-day window resets on each use, so daily users will never hit the limit. MFA not available on free tier — acceptable for now. If session length or MFA becomes a requirement, upgrading to Clerk Pro ($25/month) requires no stack changes. |
| Partner-only tasks | `account_id` nullable on tasks | A task may originate from a partner query before the end customer is known. The group header shows `PartnerZ [Partner only]`. A "Link to account" option in the context menu sets `account_id` via PATCH. |
| Context menu | ⋯ button on row hover | Keeps the table clean. All task actions (edit, duplicate, delete, link to account) live in the context menu rather than cluttering the row or notes column. |
| UI theme | Emerald/green palette, Clerk-style typography, dark mode | Navbar: `#085041`. Accents: `#1D9E75`. Group headers: `#9FE1CB`. Avatars: green and blue only. Task names: soft green. Selected row: gray bg + green left border. Dark mode toggle in navbar; also respects OS preference. Dark surfaces: `#1a1f1e` / `#222927`. |
