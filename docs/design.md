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
| country | TEXT | |
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
| account_id | UUID FK → accounts | ON DELETE RESTRICT |
| partner_name | TEXT | Nullable. Editable per task |
| distributor_name | TEXT | Nullable. Editable per task |
| contract_value | NUMERIC(15,2) | Editable per task. Default from account on creation |
| task_type_id | UUID FK → task_types | |
| status | task_status | Default: backlog |
| priority | task_priority | Default: medium |
| eta | DATE | |
| next_action | TEXT | Short description of immediate next step |
| assignee_id | UUID FK → users | Mandatory. One of the 5 internal users |
| sfdc_task_url | TEXT | Opens in new tab |
| external_source | external_source | Default: manual |
| external_id | TEXT | Future: Outlook message ID or SFDC task ID |
| email_ref | TEXT | Future: email message-id header |
| last_updated_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | Auto-updated by trigger |

**Note on account + partner:** Multiple tasks can share the same account + partner combination. There is no uniqueness constraint — a Demo and an RFP for the same account/partner are separate tasks. The table groups rows visually by account + partner on the frontend.

#### task_notes
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| task_id | UUID FK → tasks | ON DELETE CASCADE |
| user_id | UUID FK → users | Author |
| content | TEXT | Markdown supported |
| last_updated_by | UUID FK → users | Populated if note is edited |
| edited_at | TIMESTAMPTZ | Null if never edited |
| created_at | TIMESTAMPTZ | |

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

**Example layout:**
```
▼ Acme Corp — PartnerX
     Demo        High    In Progress   John   15 Jun
     RFP         Medium  Backlog       Sara   30 Jun

▼ Acme Corp — PartnerY
     POC         Critical  In Progress  John  20 Jun

▼ BetaCo — (no partner)
     Follow-up   Low     Waiting       Mike  —
```

**Columns (all reorderable and toggleable per user):**

| Column key | Label | Notes |
|---|---|---|
| task_name | Task | Clickable → opens side panel |
| account | Account | Group header, not repeated per row |
| partner | Partner | Group header, not repeated per row |
| type | Type | Category + subtype |
| assignee | Assignee | User display name |
| next_action | Next action | Short text |
| priority | Priority | Badge: Critical / High / Medium / Low |
| status | Status | Dropdown inline |
| eta | ETA | Date |
| contract_value | Contract value | Numeric |
| country | Country | From account |
| notes_preview | Notes | Last N notes with timestamp |
| last_updated | Last updated | Timestamp + user |

**Toolbar:**
- Filter by: account, country, priority, status, type, subtype, assignee, partner, contract value range
- Sort by: any column
- Free text search: across task name, account name, notes
- "+ New Task" button

**Notes preview inline:**
Shows last N notes (N = user preference, default 2). Format: `2d ago · John: Sent draft RFP...`

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

_To be completed in next design session._

Planned endpoints:

- `POST /auth/*` — delegated to Clerk; middleware validates token
- `GET/POST /tasks` — list with filters, create
- `GET/PATCH/DELETE /tasks/:id` — get detail, update, delete
- `GET/POST /tasks/:id/notes` — list notes, add note
- `PATCH /tasks/:id/notes/:noteId` — edit note
- `GET/POST /accounts` — list, create
- `GET/PATCH /accounts/:id` — get detail, update
- `GET/POST/PATCH /task-types` — admin only
- `GET/PATCH /preferences` — get/set user column preferences
- `GET /audit-log` — admin only, with filters
- `POST /tasks/from-email` — future Outlook plugin hook
- `PATCH /tasks/:id/from-email` — future Outlook plugin hook

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
| Account fields on task | Editable per task | Supports scenario where two different partners target the same prospect — each task can have different partner/distributor/contract value while sharing the same account. |
| SFDC integration | Links only (no API) | Sufficient for current needs. Full API pull deferred to future feature. |
| Audit log visibility | Admin only | Enforced at API middleware. Not a UI-level restriction only. |
| Column layout | User preferences in DB | Per-user column order and visibility stored in `user_preferences` table as JSONB. Survives browser/device changes. |
| Notes | Append log with timestamps | Notes are a communication trail, not a single editable field. Each note is a separate record with author and timestamp. |
