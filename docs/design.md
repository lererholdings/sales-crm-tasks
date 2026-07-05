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
7. [API design](#7-api-design)
8. [Frontend components](#8-frontend-components)
9. [Implementation plan](#9-implementation-plan)
10. [Deployment guide](#10-deployment-guide) ← to be completed
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

~5 internal users today — not a hard ceiling, see "User scale ambition" in section 12. Two roles:

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
| country | TEXT | Required. Filterable via `GET /api/accounts?country=` (added post-Milestone-3, issue #7) |
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

Schema is managed as Supabase CLI migrations in `supabase/migrations/`. Deploy with `npx supabase db push` (see Milestone 1). `db/schema.sql` is kept as a flattened human-readable copy of the current cumulative schema — not the applied source.

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
- `country` — filter by country (partial match) — added post-Milestone-3, see [issue #7](https://github.com/lererholdings/sales-crm-tasks/issues/7). Supersedes the original "country — not searchable" note in the schema table.
- `sort_by` / `sort_dir` — `name` (default), `country`, `acv`, `updated_at`; `asc` (default) or `desc`. Archived accounts always sort last regardless.
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
- `account_id` — optional, must exist if provided (nullable — see "Partner-only tasks" in section 12)
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

### Application shell

```
App
  ├── ClerkProvider              (wraps everything — session context)
  ├── RouterProvider             (client-side routing)
  └── Layout
        ├── Navbar               (logo, nav links, theme toggle, user avatar)
        └── ProtectedRoute       (checks Clerk session → redirects to Clerk hosted login if not authenticated)
              └── Page (outlet)
```

---

### Pages and route map

| Path | Page component | Access |
|---|---|---|
| `/` | Redirect → `/tasks` | — |
| `/tasks` | TasksPage | Any authenticated user |
| `/accounts` | AccountsPage | Any authenticated user |
| `/admin` | AdminPage | Admin role only — members redirected |
| `/sso-callback` | Clerk callback handler | Clerk SDK, not our code |

---

### Page: /tasks

```
TasksPage
  ├── TaskToolbar
  │     ├── SearchInput            (free text across task name, account, notes)
  │     ├── FilterChip             (reusable — one per filter: Status, Assignee,
  │     │                           Priority, Type, Partner)
  │     ├── ColumnManager          (popover panel — show/hide/reorder columns)
  │     └── NewTaskButton          (opens NewTaskModal)
  │
  ├── TaskTable
  │     ├── TaskGroupHeader        (account + partner label, task count, collapse toggle)
  │     └── TaskRow                (one per task, clickable → opens TaskSidePanel)
  │           ├── TaskNameCell     (task name in green + ⋯ context menu trigger)
  │           │     └── ContextMenu
  │           │           ├── ContextMenuItem  "Edit task"
  │           │           ├── ContextMenuItem  "Duplicate"
  │           │           ├── ContextMenuItem  "Link to account"  (partner-only tasks only)
  │           │           └── ContextMenuItem  "Delete task"  (triggers ConfirmDialog)
  │           ├── StatusPill       (colour-coded enum pill, inline)
  │           ├── PriorityBadge    (colour-coded enum pill)
  │           ├── AssigneeChip     (avatar circle + name)
  │           └── NotesPreview     (last N notes inline, N from user preferences)
  │
  ├── TaskSidePanel                (slides in from right on row click)
  │     ├── PanelHeader            (task name, StatusPill, PriorityBadge)
  │     ├── AccountBlock           (account dropdown, partner, distributor — all editable)
  │     │     └── SFDCLinks        (account link + task link, each opens new tab)
  │     ├── TaskDetailBlock        (type, subtype, ETA date picker, AssigneeChip, next action)
  │     ├── LastUpdatedLine        (updated by [user] · [timestamp])
  │     └── NotesTimeline
  │           ├── NoteItem         (avatar, author, timestamp, markdown content)
  │           │     └── EditNoteForm  (inline edit — author + last-note rule enforced)
  │           ├── LoadMoreButton   (pagination — loads next 25 notes)
  │           └── AddNoteForm      (markdown textarea + Post button)
  │
  └── NewTaskModal                 (modal overlay)
        ├── SearchableSelect       (account — type to filter)
        ├── SearchableSelect       (task type/subtype)
        ├── SearchableSelect       (assignee — mandatory)
        ├── TextInput              (task name)
        ├── TextInput              (partner name)
        ├── TextInput              (next action)
        ├── DatePicker             (ETA)
        ├── SearchableSelect       (priority)
        ├── SearchableSelect       (status)
        └── ConfirmButton / CancelButton
```

---

### Page: /accounts

```
AccountsPage
  ├── AccountToolbar
  │     ├── SearchInput
  │     └── NewAccountButton       (opens NewAccountModal)
  │
  ├── AccountTable
  │     └── AccountRow             (clickable → opens AccountSidePanel)
  │
  ├── AccountSidePanel
  │     ├── AccountDetailBlock     (name, country, ACV, SFDC link — all editable)
  │     └── LinkedTasksList        (tasks belonging to this account, clickable)
  │
  └── NewAccountModal
        ├── TextInput              (name — required)
        ├── TextInput              (country — required)
        ├── TextInput              (ACV)
        └── TextInput              (SFDC account URL)
```

---

### Page: /admin

```
AdminPage                          (admin role only)
  ├── AdminNav                     (tab strip: Task Types | Users | Audit Log)
  │
  ├── TaskTypesPanel
  │     ├── TaskTypeList
  │     │     └── TaskTypeRow      (name, category pill, active toggle)
  │     └── NewTaskTypeForm        (inline — name + category dropdown)
  │
  ├── UsersPanel
  │     └── UserList
  │           └── UserRow          (avatar, name, email, role dropdown)
  │
  └── AuditLogPanel
        ├── AuditFilterBar         (user, entity type, action, date range)
        ├── AuditTable
        │     └── AuditRow         (timestamp, user, entity, action, changed fields diff)
        └── AuditPagination
```

---

### Shared / reusable components

```
components/ui/
  ├── SearchableSelect     (dropdown + type-to-filter — used in all forms and filters)
  ├── StatusPill           (colour-coded pill for task_status enum)
  ├── PriorityBadge        (colour-coded pill for task_priority enum)
  ├── AssigneeChip         (initials avatar circle — green/blue only — + display name)
  ├── DatePicker           (ETA field)
  ├── MarkdownRenderer     (renders note content as HTML)
  ├── MarkdownEditor       (textarea with preview toggle for note input)
  ├── ConfirmDialog        (used for delete task warning — lists what will be deleted)
  ├── SidePanel            (generic slide-in container — reused for tasks and accounts)
  ├── ContextMenu          (floating menu — renders items + handles outside-click dismiss)
  └── LoadingSpinner
```

---

### State and data layer

```
hooks/
  ├── useAuth              (current user id + role — from Clerk + /api/users)
  ├── useTasks             (fetch list with filters/sort, optimistic status/priority updates)
  ├── useTask              (single task detail + notes pagination)
  ├── useAccounts          (fetch + search)
  ├── useTaskTypes         (active types for dropdowns)
  ├── useUsers             (all users for assignee dropdown)
  ├── usePreferences       (column order/visibility, notes preview count — auto-saved)
  └── useAuditLog          (admin only — paginated with filters)

lib/
  ├── apiClient.js         (fetch wrapper — attaches Clerk JWT to every request automatically)
  └── constants.js         (column keys, status/priority enum values, colour maps)
```

---

## 9. Implementation plan

### Guiding principles

- Ship something usable as early as possible — core task table before filters, admin, or audit
- Each milestone ends with a working, deployable state — never leave the app broken between sessions
- Build backend before frontend for each feature — data layer first, UI second
- Test each API endpoint manually (Postman or curl) before building UI on top of it
- Be mindful about Security, Authentication, and Authorization during the implementation
- Every milestone adds automated tests for what it built that milestone (Vitest — `api/**/*.test.js` for endpoints, `frontend/src/**/__tests__` for components). A GitHub Actions workflow (`.github/workflows/ci.yml`) runs the full suite plus a production build on every push. Milestone 9 revalidates everything end to end and fills any coverage gaps.

---

### Milestone 1 — Project scaffold and infrastructure
_Goal: empty app deployed live with auth working_

**Tasks:**
1. Scaffold React + Vite frontend in `frontend/`
2. Configure Tailwind CSS with emerald/green theme tokens matching the mockup
3. Set up Vercel project connected to the GitHub repo (`lererholdings/sales-crm-tasks`)
4. Create Supabase project — copy connection string
5. `npx supabase login`, then `npx supabase link --project-ref <ref>` and `npx supabase db push` to deploy `supabase/migrations/` — verify all tables created
6. Create Clerk application — configure allowed origins, copy keys
7. Add environment variables to Vercel: `DATABASE_URL`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — `DATABASE_URL` scoped per environment (Production → prod Supabase project, Preview/Development → dev Supabase project, see section 12 "Environment separation")
8. Scaffold `api/` folder with one test endpoint `GET /api/health → { ok: true }`
9. Wire Clerk `<ClerkProvider>` into the React app
10. Add `ProtectedRoute` — unauthenticated users redirect to Clerk hosted login
11. Deploy to Vercel — verify login flow works end to end
12. Add Vitest to both `api/` and `frontend/`; smoke tests for this milestone: `api/health.test.js`, render tests for the placeholder pages. Add `.github/workflows/ci.yml` — installs, builds frontend, runs both test suites on every push

**Checkpoint ✅**
- App loads at Vercel URL
- Unauthenticated visit redirects to Clerk login
- After login, user sees a blank page (no content yet — that's fine)
- `GET /api/health` returns `{ ok: true }`
- All tables exist in Supabase
- CI is green on push

---

### Milestone 2 — Auth middleware and user sync
_Goal: every API call knows who the user is and what role they have_

**Tasks:**
1. Create a second Supabase project for dev/preview use; keep the Milestone 1 project as production. Push `supabase/migrations/` to both (see section 12, "Environment separation")
2. Add `api/_lib/db.js` — `pg.Pool` against `DATABASE_URL` (pooled/transaction-mode connection string, see section 12 "Database access pattern")
3. Build `validateSession` middleware (`api/_lib/auth.js`) — verifies Clerk JWT, resolves `clerk_user_id` → internal `users` row, attaches `{ id, role, ... }` to the handler via a `withAuth` wrapper
4. Build user auto-provisioning — if Clerk user has no row in `users` table yet, create one on first login (display name + email pulled from Clerk)
5. `GET /api/users` — list all users (used for assignee dropdowns)
6. `PATCH /api/users/:id` — update role (admin only)
7. Seed one admin user manually in Supabase (your own account) — log in once to auto-provision the row, then `UPDATE users SET role = 'admin' WHERE email = '...'`
8. Add `lib/apiClient.js` to frontend — fetch wrapper that attaches Clerk JWT to every request
9. Scope `DATABASE_URL` per environment in Vercel: Production → prod Supabase project, Preview + Development → dev Supabase project
10. Add the test auth bypass (`TEST_AUTH_BYPASS_SECRET`, see section 12) and a real integration test suite (`api/**/*.integration.test.js`, run via `npm run test:integration`) that exercises the actual handlers against the real dev DB — added because manually logging in as a browser tester for every milestone doesn't scale. Wired into CI as a separate step with `DATABASE_URL`/`TEST_AUTH_BYPASS_SECRET` GitHub Actions secrets (dev DB only)
11. Tests: `validateSession` middleware (valid / missing / expired / malformed token, bypass path unreachable when unset), user auto-provisioning (first login creates a row, second login doesn't duplicate), `PATCH /api/users/:id` 403s for non-admin

**Checkpoint ✅**
- Login creates a user row in Supabase automatically
- `GET /api/users` returns the user list with roles
- Non-admin cannot change roles (403 returned)
- All subsequent API calls will have user context available
- CI is green

---

### Milestone 3 — Accounts API and UI
_Goal: create and view accounts_

**Tasks:**
1. `GET /api/accounts` — list with optional `search` and `?include=acv`
2. `POST /api/accounts` — create account
3. `GET /api/accounts/:id` — get single account with ACV
4. `PATCH /api/accounts/:id` — update including ACV (audit logged)
5. Build `AccountsPage` with `AccountTable` and `AccountRow`
6. Build `AccountSidePanel` — view and edit account details
7. Build `NewAccountModal` — create account form with `SearchableSelect` and `TextInput` components
8. Wire `useAccounts` hook to API
9. Tests: accounts endpoints (create, list + search, get single with ACV, patch writes audit_log entry with `{from, to}`), render test for `AccountTable`/`AccountRow` with mocked data

**Checkpoint ✅**
- Can create an account with name, country, ACV, SFDC link
- Accounts list and search works
- Can edit an account — ACV change visible in Supabase audit_log
- CI is green

---

### Milestone 4 — Tasks API
_Goal: full task CRUD available, testable via Postman_

**Tasks:**
1. `GET /api/tasks` — list with all filter/sort params, notes inline (default 2), soft-delete filter
2. `POST /api/tasks` — create with validation (task_name, account_id nullable, assignee_id required)
3. `GET /api/tasks/:id` — single task with paginated notes
4. `PATCH /api/tasks/:id` — update any field
5. `DELETE /api/tasks/:id` — soft delete task + cascade soft delete notes + audit both
6. `GET /api/task-types` — list (active only for members, all for admin)
7. Build audit middleware — wraps all mutating endpoints, writes to `audit_log` automatically
8. Wire `useTaskTypes` hook
9. Tests: full CRUD lifecycle, validation (missing `task_name`/`assignee_id`/`task_type_id` rejected, nullable `account_id` accepted), soft-delete filtering (hidden from members, visible to admins with `?include_deleted=true`), audit middleware writes an entry per mutation

**Checkpoint ✅**
- Full task lifecycle works via API: create → read → update → soft delete
- Deleted tasks invisible to members, retrievable by admins via `?include_deleted=true` — **API-level only, no UI yet** (see [issue #10](https://github.com/lererholdings/sales-crm-tasks/issues/10) — no UI is planned anywhere in the spec to actually use this until Milestone 6)
- Audit log has entries for every mutation
- Task types seed data visible via `GET /api/task-types`
- CI is green

---

### Milestone 5 — Core task UI
_Goal: the main working view — task table with grouping and side panel_

**Tasks:**
1. Build `TaskTable` with `TaskGroupHeader` and `TaskRow`
   - Group rows by account + partner using the three labelling rules
   - Render `StatusPill`, `PriorityBadge`, `AssigneeChip`, `NotesPreview` components
2. Build `TaskNameCell` with `ContextMenu` (Edit, Duplicate, Delete, Link to account for partner-only)
3. Build `ConfirmDialog` — used for delete confirmation
4. Build `TaskSidePanel`
   - `AccountBlock` (editable dropdowns, SFDC links open in new tab)
   - `TaskDetailBlock` (type, subtype, ETA, assignee, next action)
   - `LastUpdatedLine`
5. Build `NotesTimeline`
   - `NoteItem` with `MarkdownRenderer`
   - `EditNoteForm` (author + last-note rule enforced client and server side)
   - `LoadMoreButton` (pagination — loads next 25)
   - `AddNoteForm` with `MarkdownEditor`
6. Notes API endpoints:
   - `GET /api/tasks/:id/notes` (preview mode + paginated mode)
   - `POST /api/tasks/:id/notes`
   - `PATCH /api/tasks/:id/notes/:noteId` (permission checks server-side)
7. Wire `useTasks` and `useTask` hooks
8. Build `NewTaskModal` with all `SearchableSelect` fields — account auto-populates partner/distributor on selection
9. Tests: notes endpoints — the author + last-note edit rule is the trickiest logic in the spec, cover it directly (author can edit their own latest note; author blocked once a newer note exists; non-author always blocked), preview vs paginated note modes, grouping logic for the three group-label rules, `TaskRow`/`TaskGroupHeader` render tests

**Checkpoint ✅**
- Task table loads and groups correctly by account + partner
- All three group label rules render correctly
- Clicking a row opens the side panel with full detail
- Notes timeline loads, paginates, and new notes can be added
- Note edit respects author + last-note rule
- New task can be created via modal — appears in table immediately
- Soft delete via context menu shows confirm dialog, removes from view
- CI is green

**Also bundled into this milestone** (per user request, not in the original task list above): issue #5 part 1 — admin-only account archiving with an active-task guard, archived accounts shown greyed out everywhere rather than hidden. See the decision log entries above for the archive UX and the `NewTaskModal` partner/distributor prefill.

**Gap found and fixed via review, not deferred**: `TaskDetailBlock` in the original component tree never listed status/priority as editable, but the hooks section explicitly says `useTasks` should support "optimistic status/priority updates" — a task genuinely had no way to be marked done. Added Status and Priority as two more `SearchableSelect` fields in `TaskSidePanel`'s existing Task detail section, through the same Save flow as every other field there (not a separate optimistic/inline-edit pattern, which stays a possible fast-follow if a one-click table-row edit is wanted later). Also: `NewTaskModal`'s status dropdown excludes "Done" — a new task starting pre-closed isn't a sensible default.

---

### Milestone 6 — Filters, sorting, and column preferences
_Goal: the toolbar is fully functional_

**Tasks:**
1. Build `FilterChip` components — Status, Assignee, Priority, Type, Partner
2. Wire filter state to `GET /api/tasks` query params
3. Build `SearchInput` — debounced free text search
4. Build `ColumnManager` popover — show/hide columns, drag to reorder
5. `GET /api/preferences` and `PATCH /api/preferences` endpoints
6. Wire `usePreferences` hook — column state persists to DB on change
7. Apply sort on column header click (sort_by + sort_dir params)
8. Tests: `GET /api/tasks` filter param combinations (status, assignee, priority, type, partner, search, sort_by/sort_dir), preferences endpoints (partial-update semantics), `ColumnManager` reorder/toggle interaction test

**Also bundled into this milestone** (per [issue #10](https://github.com/lererholdings/sales-crm-tasks/issues/10), tagged to Milestone 6 since it's the same filter-UI infrastructure): an admin-only "Show deleted" toggle in the toolbar, wiring the already-existing `?include_deleted=true` API param (Milestone 4) to the task table for the first time. Deleted tasks render with a `(deleted)` tag and dimmed row, matching the existing archived-account convention (see [issue #5](https://github.com/lererholdings/sales-crm-tasks/issues/5)'s decision log entry) rather than inventing a new visual pattern. Members never see the control; the backend 403s them regardless if attempted directly.

**Revised per review before merge:** Status and Priority became multi-select (checkboxes, `IN (...)` server-side instead of `=`) rather than single-value — day-to-day triage usually means "show me backlog + in progress + waiting," not one status at a time. The Status filter also now defaults to every status except Done on first load (still just a starting selection — fully visible/togglable via the chip), since completed work isn't what you're triaging.

**Checkpoint ✅**
- Filtering by status, assignee, priority, type, partner all work
- Free text search filters the table in real time
- Column show/hide and reorder persists across browser refresh and devices
- Sorting by any column works
- Admins can toggle visibility of soft-deleted tasks; members never see the control or the tasks
- CI is green

---

### Milestone 7 — Dark mode
_Goal: theme toggle working in the real app, matching the mockup_

**Tasks:**
1. Define CSS custom properties for all theme tokens (light + dark) in global stylesheet — matching the mockup colour values exactly
2. Implement `data-theme` toggle on `<html>` element
3. Add round icon-only theme toggle button to `Navbar` (moon / sun)
4. Persist theme preference to `user_preferences` table (add `theme` field — new migration in `supabase/migrations/`)
5. Respect OS `prefers-color-scheme` on first load if no saved preference
6. Tests: migration adds the column without breaking existing rows (default), toggle updates `data-theme` and fires the `PATCH /api/preferences` call, first-load fallback to OS preference when no saved theme exists

**Checkpoint ✅**
- Toggle switches between light and dark instantly
- Theme persists across sessions and devices
- OS dark mode preference respected on first visit
- CI is green

---

### Milestone 8 — Admin panel
_Goal: task types, user management, audit log viewer_

**Tasks:**
1. Build `AdminPage` with tab navigation
2. `TaskTypesPanel` — list, add, rename, activate/deactivate subtypes
   - `POST /api/task-types` and `PATCH /api/task-types/:id` endpoints
3. `UsersPanel` — list users, change roles
4. `AuditLogPanel` — paginated table with filter bar
   - `GET /api/audit-log` endpoint (admin only, with all filter params)
5. Add role guard to `AdminPage` — redirect members to `/tasks`
6. Tests: task-types endpoints admin-only enforcement (403 for members), audit-log endpoint 403 for non-admins + filter param combinations, `AdminPage` role guard redirects a member user

**Checkpoint ✅**
- Admin can add a new task subtype — appears in task creation dropdown immediately
- Admin can change a user's role
- Audit log shows all changes with user, timestamp, and diff
- Member visiting `/admin` is redirected
- CI is green

---

### Milestone 9 — Hardening and edge cases
_Goal: production-ready error handling, edge case coverage, and full test revalidation_

**Tasks:**
1. API error handling — consistent error response shape `{ error: string, code: string }` across all endpoints
2. Frontend error states — empty states, loading spinners, failed fetch messages
3. Form validation feedback — inline errors on required fields
4. Handle partner-only task flow end to end — "Link to account" context menu opens account selector, PATCH updates task
5. Session expiry handling — Clerk token refresh on 401, redirect to login if session truly expired
6. Rate limiting on API routes (Vercel edge config)
7. Input sanitisation on all text fields
8. **Full regression pass:** re-run every test added in Milestones 1–8 against the current codebase — nothing added since should have silently broken earlier behavior. Fix any drift before adding new coverage.
9. **Gap audit:** go endpoint by endpoint and component by component against `docs/design.md` section 7 (API design) and section 8 (Frontend components) and confirm each has at least one test. Add tests for anything found untested — expect this to surface gaps around the new error-handling shape, rate limiting, and input sanitisation added in tasks 1–7 above, since those didn't exist when earlier milestones were tested.
10. End-to-end smoke test of all API endpoints and UI flows against a deployed preview

**Checkpoint ✅**
- No unhandled errors visible to users — all failures show a friendly message
- Partner-only → link to account flow works end to end
- Session expiry redirects cleanly to login then back to original page
- All forms validate and show inline errors
- Full test suite (all milestones) passes in CI with no known gaps against the design doc

---

### Milestone 10 — Deployment and go-live
_See Section 10: Deployment guide (to be completed)_

**Tasks:**
1. Configure custom domain (optional)
2. Set production environment variables in Vercel
3. Set Vercel Deployment Protection to "Only Preview Deployments" so Clerk is the sole access gate for production ([issue #1](https://github.com/lererholdings/sales-crm-tasks/issues/1))
4. Seed admin user(s) in the production DB ([issue #3](https://github.com/lererholdings/sales-crm-tasks/issues/3)) — Milestone 2's seeding only covered the dev project
5. Confirm CI is green on `main` before announcing go-live
6. Final end-to-end test with all 5 users
7. Brief all users on login flow and basic usage

**Checkpoint ✅**
- All 5 users can log in and create/update tasks
- App is stable under normal usage
- Audit log is capturing activity
- CI is green on `main`

---

### Summary timeline

| Milestone | What you get | Effort estimate |
|---|---|---|
| 1 — Scaffold | Live empty app with auth | 2–3 hours |
| 2 — Auth middleware | Secure API, user sync | 1–2 hours |
| 3 — Accounts | Full account management | 2–3 hours |
| 4 — Tasks API | Full task CRUD (no UI) | 3–4 hours |
| 5 — Core task UI | **Usable app** — table, panel, notes | 6–8 hours |
| 6 — Filters + columns | Full toolbar functionality | 3–4 hours |
| 7 — Dark mode | Theme toggle | 1–2 hours |
| 8 — Admin panel | Task types, users, audit log | 3–4 hours |
| 9 — Hardening | Production-ready | 2–3 hours |
| 10 — Go-live | Live for all 5 users | 1 hour |

**Total estimate: 24–34 hours of Claude Code sessions.**

These are active working hours — not elapsed time. You can pause between any milestone and the app will be in a stable, deployable state.

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
| Access gate ownership | Clerk is the sole access gate; Vercel Deployment Protection restricted to "Only Preview Deployments" | Avoids running two overlapping auth systems in production. Vercel protection is useful for previews (keeps in-progress work private) but must not gate production once real users need to log in via Clerk. See [issue #1](https://github.com/lererholdings/sales-crm-tasks/issues/1). |
| Task column reorder/toggle scope | `task_name` excluded from `ColumnManager` — always first, never hidden | It hosts `TaskNameCell`'s context menu (edit/duplicate/delete/link-to-account); hiding it would hide those actions with no replacement affordance. The other 8 columns are fully reorderable and toggleable per the spec. |
| Partner filter chip | Free-text input, not a dropdown of exact values | `GET /api/tasks`'s `partner_name` param is matched with `ILIKE '%...%'` (substring), not `=` — there's no partners table to source an exact option list from, and a text filter matches the backend's actual matching semantics. |
| User scale ambition | Architecture should not assume a hard ceiling of ~5 users | Team is ~5 today, but avoid decisions that make later growth expensive: keep list endpoints paginated/indexed rather than fetch-all, keep Clerk/Supabase on tiers with headroom (Clerk free tier supports up to 10,000 MAU), and revisit rate limiting + `audit_log` retention in Milestone 9 with growth in mind, not just current volume. Not a reason to over-engineer now — just don't paint into a corner. |
| Database access pattern | Direct Postgres via the `pg` driver against a pooled connection string, not `@supabase/supabase-js` | Matches the stated migration goal in section 4 — moving off Supabase later means changing `DATABASE_URL`, not rewriting every query to drop `.from()`/PostgREST calls. Vercel functions are serverless/short-lived, so `DATABASE_URL` must be the Transaction pooler string (port 6543, Supavisor/pgbouncer), not the direct :5432 connection — direct connections exhaust Postgres's connection cap under serverless concurrency. |
| Environment separation | Two Supabase projects: one for dev/preview, one for production | Set up in Milestone 2 rather than deferred, since no real data existed yet — the cheapest point to do this. Mirrors the Vercel Preview/Production split already in place. `DATABASE_URL` is scoped per-environment in Vercel; migrations are pushed to both projects (`supabase link --project-ref <ref>` per project, no single persistent link). |
| Test auth bypass | `validateSession` (`lib/auth.js`) accepts a header-based bypass gated by `TEST_AUTH_BYPASS_SECRET`, instead of minting real Clerk sessions for testing | Clerk session tokens are short-lived and only obtainable via a real browser login — there's no "personal access token" model to lean on. The bypass skips Clerk JWT verification only; DB lookup/auto-provisioning still run for real, so tests exercise real behavior. Safety boundary: the env var must never be set in Vercel's Production environment — if unset, the bypass branch is unreachable regardless of what headers a request sends. Set in `.env.local` (local dev), as a GitHub Actions repo secret (CI integration tests, `npm run test:integration`), and in Vercel's Preview environment only. |
| Live preview verification in CI | A CI job (`verify-preview-deployment`) waits for the real Vercel Preview deployment to come up, then hits it over real HTTP with the Vercel protection bypass + test auth bypass headers | In-process integration tests (calling handlers directly) prove the logic works but not that the *deployed artifact* works — they can't catch env var scoping mistakes, `vercel.json` routing issues, or cold-start problems specific to what's actually live. Testing stays scoped to pre-prod: this only ever targets Preview URLs (`if: github.ref != 'refs/heads/main'`), never Production, and `TEST_AUTH_BYPASS_SECRET` being absent from Production means the bypass would fail there even if this job were misconfigured to try. |
| SPA rewrite must exclude `/api/*` | `vercel.json`'s catch-all rewrite is `"source": "/((?!api/).*)"`, not `"/(.*)"` | **Found via Milestone 3 manual HTTP verification, and it was already live on production**: the original catch-all rewrite (added in Milestone 1) was silently swallowing dynamic bracket routes (`api/users/[id].js`, `api/accounts/[id].js`) — the SPA's cached `index.html` was served instead of routing to the function (`X-Vercel-Cache: HIT`, `Content-Disposition: inline; filename="index.html"`). Static function paths (`/api/health`, `/api/accounts`) worked fine, masking the bug from every test so far — mocked unit tests and in-process integration tests both call handlers directly and never touch Vercel's actual HTTP routing layer, so this specific class of bug can *only* be caught by real HTTP verification against a live deployment. This is exactly why "Live preview verification in CI" (above) exists, but that job's own smoke test only hit `GET /api/users` (list, no `:id`) — worth remembering that a passing smoke test only proves the specific paths it touches, not the whole API surface. |
| Shared backend code lives in `lib/` (repo root), not `api/_lib/` | Moved during Milestone 4 | **Found via a real Milestone 4 deployment failure**: "No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan." Per Vercel's own docs, every `.js` file directly under `api/` maps to one Function when not using a framework — there's no underscore-prefix exclusion for shared helper modules the way frameworks like Next.js provide. `api/_lib/*.js` (db.js, auth.js, audit.js, tasks.js) were each being counted individually, alongside the real endpoint files, pushing the total to the Hobby limit. Fix: shared code must live structurally outside `api/` entirely (a root-level `lib/`), not just be named/prefixed a certain way — naming conventions don't exempt a file from being scanned as a route. Worth checking this count before adding new files under `api/` in future milestones, since the ceiling (12) is fixed regardless of how many are genuinely real endpoints vs. helpers. |
| Never compare a round-tripped `TIMESTAMPTZ` back against its own DB row by value alone | Exclude by primary key too (`AND id != $n`), not just `created_at > $n` | **Found via a real Milestone 5 integration test failure** (mocked unit tests couldn't catch this — they don't have real timestamp precision to trip over): the note-edit "no newer note exists" check fetched a note's `created_at`, then compared it back against the table (`created_at > $2`) to look for newer siblings. `node-postgres` reads `TIMESTAMPTZ` into a JS `Date`, which only has millisecond precision, while Postgres stores microseconds — so the round-tripped value came back slightly *less* than the DB's own stored value for that same row, making the query see the note as "newer than itself" and incorrectly reject every edit with a 403. Fix: exclude the row's own id explicitly in the comparison rather than relying on timestamp equality/ordering to naturally exclude self-matches. Worth remembering for any future "is this the latest X" query built the same way. |
| Accounts get a different soft-delete UX than tasks: archived, not hidden | `accounts.deleted_at`/`deleted_by` (added Milestone 5, `20260705000534_accounts_soft_delete.sql`), but list/picker queries never filter `WHERE deleted_at IS NULL` the way tasks' do | Issue #5: archiving an account is admin-only, and only allowed when it has no active (`status != 'done'`, non-deleted) task against it. Unlike tasks, archived accounts are **not** hidden by default anywhere — they still show up in the main Accounts list and in every account picker (`NewTaskModal`, `TaskSidePanel`), just sorted last (`ORDER BY (deleted_at IS NOT NULL), name`) and rendered greyed out with an "(archived)" label, since a task can legitimately still reference an already-archived account. No restore/unarchive endpoint yet — that's tied to [issue #15](https://github.com/lererholdings/sales-crm-tasks/issues/15) (suggest-restore on similar create), not built until that's picked up. |
| `NewTaskModal` prefills partner/distributor from the account's most-recent task | Client-side only — derived from the already-loaded `tasks` list, no new endpoint | Lightweight alternative to the deferred partner/distributor-as-entity redesign (see "Open questions" below): selecting an account looks up that account's most-recently-*updated* task among what's already loaded for the table, and copies its `partner_name`/`distributor_name` as an editable default. Also added a `distributor_name` `TextInput` to `NewTaskModal` (not in the original Milestone 5 component list) so there's somewhere to show/edit the prefilled value at creation time, not just after the fact in `TaskSidePanel`. |
| Notes timeline is newest-first, not oldest-first | `AddNoteForm` sits above the notes list; the list itself scrolls independently (`max-h-96 overflow-y-auto`) rather than growing the whole side panel | **Overrides the original mockup** ("Notes timeline (chronological, oldest first)") — found via Milestone 5 review feedback that newest-first (most recent activity at the top, next to where you post) reads better in practice. This flips the internal data model too: `hooks/useTask.js` no longer reverses fetched pages, since the API's own newest-first pagination order now matches the desired display order directly — "load more" appends older pages to the end, a freshly-posted note goes at the front, and the "editable = latest note" check (`NotesTimeline.jsx`) now looks at `notes[0]` instead of the last element. |

### Open questions (not yet decided)

These are raised but deliberately **not** resolved yet — don't build against them until they're promoted to a decision above.

- **Partner/distributor as entities, not free text.** Today `tasks.partner_name` / `distributor_name` are plain TEXT columns (see "Account fields on task" decision above). Raised during Milestone 5: should partner/distributor become real entities (their own table), with `accounts` holding a nullable "assigned partner/distributor" reference that a `NewTaskModal` account selection could prefill from — and a save-time prompt to update the account's reference if a task's chosen partner/distributor differs from it? This would reopen and supersede the Milestone 3 decision, and touches schema, backend, and multiple UI surfaces. Tracked as [issue #14](https://github.com/lererholdings/sales-crm-tasks/issues/14), not yet scheduled to a milestone. Milestone 5 shipped with today's simpler free-text model.
