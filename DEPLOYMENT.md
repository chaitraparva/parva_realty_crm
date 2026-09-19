# Deploying Parva Realty CRM to Vercel

There are two valid ways to deploy this project on Vercel. **Option A (two
projects) is recommended** — it's the simpler, more robust, zero-config path
and is what most teams use for a separate frontend + API. Option B (one
project) is also fully implemented if you specifically want a single domain.

---

## Option A — Two Vercel projects (recommended)

One Vercel project for the frontend, one for the backend API. Both live in
the same GitHub repo; you just point each Vercel project at a different Root
Directory.

### A1. Deploy the backend

1. In Vercel: **Add New → Project**, import this repo.
2. Set **Root Directory** to `backend/parva_backend_supabase/backend`.
3. Framework Preset: "Other" (Vercel auto-detects `api/index.js` as a
   serverless function — no build step needed).
4. Add these **Environment Variables** (Production, and Preview if you use
   preview deployments):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (Project Settings → API) — **secret, server-only** |
   | `SUPABASE_ANON_KEY` | Supabase anon/public key |
   | `FRONTEND_URL` | your frontend's Vercel URL, e.g. `https://parva-crm.vercel.app` (comma-separate more than one if needed) |
   | `NODE_ENV` | `production` |

   `PORT` is not needed on Vercel (only used by `npm start` on a traditional server).
5. Deploy. Note the resulting URL, e.g. `https://parva-crm-api.vercel.app`.
6. Confirm it works: `curl https://parva-crm-api.vercel.app/api/health` → `{"status":"ok",...}`.

### A2. Deploy the frontend

1. **Add New → Project** again, same repo, this time set **Root Directory**
   to `parva_crm`.
2. Framework Preset: Vercel auto-detects **Vite**.
3. Add these **Environment Variables**:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | same Supabase project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase **publishable/anon** key only — never the service-role key |
   | `VITE_API_URL` | the backend URL from step A1, e.g. `https://parva-crm-api.vercel.app` |

4. Deploy.
5. Go back to the **backend** project's env vars and make sure `FRONTEND_URL`
   matches this frontend's final URL exactly (including `https://`, no
   trailing slash), then redeploy the backend if you changed it.

That's it — two projects, both on Vercel, no separate server to run.

---

## Option B — One Vercel project, one domain

Only do this if you specifically want the frontend and API on the exact same
domain (so the frontend can call same-origin `/api/...` paths).

1. **Add New → Project**, import this repo.
2. Set **Root Directory** to `parva` (the folder containing this file and the
   root `vercel.json`).
3. Vercel will read the root `vercel.json`, which builds the Vite frontend
   (`parva_crm`) as a static site and the Express backend
   (`backend/parva_backend_supabase/backend/api/index.js`) as a serverless
   function, routing `/api/*` to the function and everything else to the
   static build.
4. Environment variables — set **all** of these on the single project:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |
   | `VITE_API_URL` | leave **empty** — same-origin `/api` is used automatically |
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — secret, never exposed to the browser |
   | `SUPABASE_ANON_KEY` | Supabase anon key |
   | `FRONTEND_URL` | this same project's URL (CORS is moot for same-origin calls, but harmless to set) |
   | `NODE_ENV` | `production` |

5. Deploy.

**Known trade-off with Option B (and, to a lesser extent, A):** the
backend's login-endpoint rate limiting (`express-rate-limit`) keeps its
counters in memory per serverless instance. On Vercel this resets on cold
starts and isn't shared across concurrent instances, so it's a soft
best-effort throttle rather than a hard guarantee — same limitation any
Express app has when moved from a long-lived server to serverless. If you
need a strict guarantee, that requires a shared store (e.g. Upstash Redis),
which is a deliberate infrastructure decision I haven't made for you.

---

## Supabase Dashboard settings to check

1. **Auth → URL Configuration**: set **Site URL** to your production
   frontend URL, and add it (plus `http://localhost:5173` for local dev) to
   **Redirect URLs**. This is what makes invite links and
   `resetPasswordForEmail` redirects land back on your real app instead of
   `localhost`.
2. **Auth → Email Templates**: confirm the "Invite user" and "Reset
   password" templates use `{{ .ConfirmationURL }}` (default) — no changes
   needed unless you've customized them.
3. Nothing else needs to change — RLS, tables, and existing policies are
   untouched by this update.

---

## One-time SQL to run (only if genuinely needed)

`backend/parva_backend_supabase/backend/supabase/live_fixup_2026-09.sql` —
run this once in the Supabase SQL editor **only if** your live database was
seeded before this update (i.e. if `Shradha` or a missing `Deekshitha M V`
row might already exist there). It's idempotent and safe to run even if
nothing needs fixing. See the file for exactly what it does and why.
