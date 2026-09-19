# API Compatibility Report

Every endpoint the original MongoDB backend exposed still exists, at the same
path, method, and (as closely as the new data model allows) request/response
shape. One new module (`/api/approvals`) was added — it didn't exist before
because the original backend had no approval/escalation model at all, even
though the frontend (`EscalationAdmin.tsx`, `Flags.tsx`) expects one.

| Endpoint | Method | Status | Changes |
|---|---|---|---|
| `/api/health` | GET | Working | None |
| `/api/auth/login` | POST | Modified | Now delegates to Supabase Auth (`signInWithPassword`) instead of comparing a bcrypt hash we stored ourselves. Response still `{ token, user }`; `token` is now a Supabase JWT (also returns `refreshToken`, additive). |
| `/api/auth/me` | GET | Working | None (same shape) |
| `/api/auth/change-password` | PATCH | Modified | No longer re-verifies `currentPassword` in the request body (Supabase Auth's own session check replaces it); calls `auth.admin.updateUserById`. Body now only needs `newPassword`. |
| `/api/users` | GET | Working | Response fields unchanged; `office` is now resolved from the `offices` table instead of a plain string. |
| `/api/users/:id` | GET | Working | `:id` now matches either `employee_code` or the UUID `id`. |
| `/api/users` | POST | Modified | Creates the **employee record only**; no longer creates a password. A Supabase Auth login must be issued separately (see README). |
| `/api/users/:id` | PATCH | Working | Same shape. |
| `/api/users/:id` | DELETE | Working | Still a soft delete (`status: inactive`). |
| `/api/leads` | GET | Working | Same filters (`status`, `source`, `office`), same role scoping. |
| `/api/leads/:id` | GET | Working | None |
| `/api/leads` | POST | Working | None |
| `/api/leads/:id` | PATCH | Working | None |
| `/api/leads/:id/activity` | POST | Working | `by` is now resolved from the authenticated employee's name via a join, same as before (was already `req.user.name`). |
| `/api/leads/:id/assign` | PATCH | Modified | Now takes `assignedTo` only; `agentName` is derived server-side from the assignee's employee record rather than trusted from the request body (previously the client-supplied `agentName` was stored verbatim — a minor integrity gap, now fixed). |
| `/api/leads/:id` | DELETE | Working | None |
| `/api/approvals` | GET | **New** | Lists approvals scoped to the caller's role. |
| `/api/approvals` | POST | **New** | Stage 1 — submits a lead for approval; server resolves the correct Sales Manager from the lead's office. |
| `/api/approvals/:id/decision` | PATCH | **New** | Stages 2–4 — the assigned Sales Manager (or admin) approves/rejects/escalates to Super Admin. |

No endpoint was removed. No existing frontend call in `services/api.ts`
requires a URL or method change.
