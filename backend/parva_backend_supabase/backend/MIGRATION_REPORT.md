# Parva Realty CRM — Migration Report

## A. Migration Summary: MongoDB → Supabase

The original backend (`parva_backend`) was ~615 lines: Mongoose models for
`User` and `Lead`, JWT signed/verified by hand, bcrypt hashing done in a
Mongoose pre-save hook, and a seed script containing **12 fictional
employees** that do not appear anywhere in your uploaded organization data.

That has been fully replaced:

- **Database:** MongoDB/Mongoose → Supabase PostgreSQL, accessed via
  `@supabase/supabase-js` with the service-role key server-side only.
- **Auth:** hand-rolled bcrypt + JWT → **Supabase Auth**. No password is
  ever stored or seen by this backend; `POST /api/auth/login` now calls
  `supabase.auth.signInWithPassword`.
- **Seed data:** the 12 fictional employees were deleted entirely and
  replaced with the **6 real people** found in `PA_employee_Details_.xlsx`
  and `org.docx`.
- **New capability:** an approvals/escalations model (`approvals` table +
  `/api/approvals` routes), because the org's documented approval flow (CRM
  → Sales Manager → Super Admin) had no backing implementation at all in the
  original code — the frontend screens for it (`EscalationAdmin.tsx`,
  `manager/Flags.tsx`) existed with no API behind them.
- `mongoose`, `bcryptjs`, and `jsonwebtoken` were removed from
  `package.json`. Verified: no MongoDB connection string, query, model, or
  environment variable remains anywhere in the codebase.

## B. Database Schema: MongoDB model → Supabase table mapping

| MongoDB (before) | Supabase table (after) | Notes |
|---|---|---|
| `User` (flat document, password field) | `employees` (business data) + `auth.users`/`profiles` (credentials) | Split per your instruction #7 — auth identity is separate from business data. |
| `User.role: enum[agent,manager,admin]` | `employees.role: user_role enum('agent','manager','admin')` | Same values kept, mapped to org.docx's "Sales Manager"→`manager`, "Super Admin"→`admin`, to minimize frontend changes. |
| `User.office: enum[Bangalore,Dubai]` | `offices` table + `employees.office_id` FK | Normalized; **Dehradun added** (real data requires it — Shradha). |
| `Lead` (flat document w/ embedded `activities[]`) | `leads` + `lead_activities` (child table) | Embedded Mongo sub-documents don't map to relational rows well as embedded JSON, so activities became a proper FK-linked table (also lets you index/query them). |
| *(none — didn't exist)* | `approvals` | New: implements the documented approval/escalation flow. |

## C. Employee Import — field mapping

Source: `PA_employee_Details_.xlsx`, sheet `Sheet1`, columns as given.

| xlsx column | → | `employees` column | Notes |
|---|---|---|---|
| `Employee d` | → | `employee_code` | Blank for Ajoy/Ankitha in the source; left `NULL`, not invented. |
| `Name` | → | `name` | Trimmed trailing spaces present in the source cells. |
| `Official Mail ID` | → | `email` | Unique key used for idempotent seeding. |
| `Phone no` | → | `phone` | Stored as-is (no reformatting). |
| `Designation` | → | `designation` | Kept **verbatim** from the xlsx, even where it conflicts with org.docx's role label (see §D). |
| `Report Manager` | → | `manager_id` | Resolved by name lookup after all rows exist (all five point to "Chaitra"). |
| `Location` | → | `office_id` | Resolved via the `offices` table (Bangalore, Dubai, Dehradun). |
| *(not in xlsx)* | → | `role` | Taken from `org.docx` instead (see §D) — it's the source that actually defines the approval hierarchy. |

## D. Organization Structure & Conflicts (read this carefully)

**Hierarchy derived from `org.docx`:**

```
Chaitra — Super Admin / Director
├── Nagesh N          — Sales Manager — Bangalore
├── Vijaya Vaishnavi A — Sales Manager — Bangalore
├── Ajoy               — Sales Manager — Dubai
├── Ankitha            — Sales Manager — Dubai
└── Shradha            — Sales Manager — Dehradun (labelled "India office" in org.docx)
```

Approval format, verbatim from `org.docx`: **CRM → Sales Manager → Super
Admin**.

**Real conflicts found between the two uploaded files** (per your
instruction, flagged rather than silently resolved):

1. **Designation mismatch — Nagesh N & Vijaya Vaishnavi A.** `org.docx`
   calls both "sales Manager". The xlsx `Designation` column says
   **"Marketing & Business Development Associate"** for both of them —
   not Sales Manager. I used `org.docx`'s role for RBAC/approval routing
   (because that document is the one that actually defines the approval
   hierarchy and permissions), and preserved the xlsx wording verbatim in
   the `designation` field so nothing is lost. **You should confirm which
   is correct** — if they are not actually Sales Managers, they should not
   be routing/approving leads.

2. **Chaitra has no record in the xlsx.** She's referenced only as
   *everyone else's* "Report Manager" value — no employee ID, email, phone,
   or office for her exists in either uploaded file. She was seeded with
   `role='admin'`, `designation='Director'` (from org.docx) but
   `email = NULL`. **She cannot be given a Supabase Auth login until you
   supply a real email address for her.** Until then, the Super-Admin stage
   of the approval flow (escalation from a Sales Manager) has no one to
   route to — `POST /api/approvals/:id/decision` with `action=escalate`
   will return a 422 explaining this.

3. **Shradha's email domain and ID prefix don't match anyone else.**
   Everyone else uses `@parvarealty.ae` and a `PA######` employee code;
   Shradha's email is `shradha@diagofinace.com` and her code is `DF23004`.
   This is consistent within itself but inconsistent with the rest of the
   company, and suggests she may be an external contact (e.g. from a
   finance-company partner called "Diago Finance") rather than a Parva
   Realty employee. She was seeded exactly as given, with a `source_note`
   flag on her row — **please confirm before granting her a Parva Realty
   CRM login.**

4. **Office naming.** org.docx calls Shradha's location "India office";
   the xlsx says her actual `Location` is "Dehradun". Both are true
   (Dehradun is in India) but the app's existing `Office` type only knows
   `'Bangalore' | 'Dubai'` — Dehradun is a genuinely new office, added as a
   third row in the `offices` table. **Frontend change required** — see §G.

5. **No frontline "CRM"/agent employees exist in either source file.** The
   approval flow's first stage ("CRM") implies someone below a Sales
   Manager submits leads, but every person in the dataset is a Sales
   Manager or the Super Admin. Nothing was invented to fill this gap: the
   `agent` role still exists in the schema for when real agent employees
   are supplied, but today Sales Managers are the ones who would submit
   leads via `POST /api/approvals`.

6. **Bangalore has two Sales Managers, and org.docx doesn't say how to
   choose between them.** `orgService.resolveManagerForOffice()` handles
   this by picking whichever of the two currently has fewer pending
   approvals assigned (load balancing), documented in code — not a
   silent/arbitrary choice, but also not something either source file
   specified, so flagging it here too.

## E. Approval Flow (as implemented)

1. **Stage 1 — Submit.** `POST /api/approvals { leadId, comments }`. The
   backend looks up the lead's office and resolves the correct Sales
   Manager (never hardcoded — see `orgService.resolveManagerForOffice`).
2. **Stage 2 — Sales Manager reviews.** `PATCH /api/approvals/:id/decision
   { action: 'approve' | 'reject' | 'escalate', comments }`. Only the
   assigned manager (or an admin) may act.
3. **Stage 3 — Approve/Reject.** Terminal states; a `lead_activities` entry
   is recorded automatically.
4. **Stage 4 — Escalate → Super Admin.** `action: 'escalate'` re-assigns the
   approval to an active `admin`-role employee. Today this fails with a
   clear 422 message, because Chaitra (the only Super Admin) has no email
   on file yet (§D.2).

## F. API Compatibility

See `API_COMPATIBILITY.md` for the full endpoint-by-endpoint table.
Summary: every original endpoint preserved at the same path/method; three
new `/api/approvals` endpoints added; no endpoint removed.

## G. Frontend Changes Required

Kept to a minimum on purpose. Files that need edits:

1. **`src/types.ts`** — `export type Office = 'Bangalore' | 'Dubai'` must
   become `'Bangalore' | 'Dubai' | 'Dehradun'` to represent Shradha's real
   office. `Role` (`'agent' | 'manager' | 'admin'`) needs **no change** —
   the backend was deliberately kept aligned to it.
2. **`src/services/api.ts`** — no required changes; `authApi`, `usersApi`,
   `leadsApi` all call the same paths with the same shapes. Optionally add
   an `approvalsApi` (new, additive) to use the new `/api/approvals`
   endpoints from `EscalationAdmin.tsx` / `manager/Flags.tsx`, which
   currently read from `mockData.ts` instead of a real API.
3. **`src/screens/admin/EscalationAdmin.tsx` and
   `src/screens/manager/Flags.tsx`** — currently backed by `mockData.ts`.
   To go live, point them at the new approvals endpoints instead (optional;
   out of scope unless you want it done now).
4. **`src/data/mockData.ts`** — contains its own fictional employee/office
   data used for local/dev fallback. Not required to change for production,
   but worth pruning later so it doesn't drift further from reality.

No change is required to `src/screens/Login.tsx` or any component calling
`authApi`, `usersApi`, or `leadsApi` — request/response shapes were kept
identical.

## H. Environment Variables

**Backend (server-only, never in the frontend build):**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # secret — server only
SUPABASE_ANON_KEY=
FRONTEND_URL=
NODE_ENV=
PORT=
```

**Frontend (Vercel project settings):**
```
VITE_API_URL=https://your-backend-host.example.com
```

`SUPABASE_SERVICE_ROLE_KEY` must never be prefixed `VITE_` and must never
reach the React bundle.

## I. Deployment Steps

See `README.md` sections 1–4 for the full walkthrough: Supabase (schema →
seed → Auth → Storage → invite users) → Backend (env vars → deploy to a
Node host) → Vercel (env var → deploy → custom domain). The Express API was
**kept as a standalone Node server** rather than force-converted to Vercel
serverless functions — the original app is a small, stateful-enough Express
app (rate limiting, CORS allow-list) that a serverless rewrite would add
risk without a clear benefit; Vercel hosts the frontend only.

## J. Security Checklist

- [x] MongoDB removed (dependency, code, env vars, connection — all gone)
- [x] Supabase connected (`@supabase/supabase-js`, service-role client server-side)
- [x] PostgreSQL schema created (`supabase/schema.sql`)
- [x] Supabase Auth configured (login/logout/session/password via Supabase, no manual password storage)
- [x] RLS configured on every table, policies scoped by role/office/self
- [x] Service role key server-only (never sent to frontend; `.env.example` calls this out explicitly)
- [x] CORS configured (explicit origin allow-list, not `*`)
- [x] RBAC implemented server-side (`req.user.role` always derived from the DB via a verified Supabase token, never trusted from the request body)
- [x] Employee dataset imported (`supabase/seed.sql`, idempotent via `ON CONFLICT (email)`)
- [x] Organization hierarchy implemented (`manager_id`, `office_id`, roles from org.docx)
- [x] Approval workflow implemented (`approvals` table + routes)
- [x] File storage secured (public bucket for property/employee images, private bucket + auth-gated policy for lead documents)
- [x] Input validation implemented (required-field checks, enum/DB constraints, role checks on every write)
- [x] No secrets committed (`.env.example` has empty/placeholder values only)
- [x] Production environment documented (`README.md`)
