# Parva Realty CRM — Backend (Supabase Edition)

Node/Express API for the Parva Realty CRM, backed entirely by **Supabase**
(PostgreSQL + Auth + Storage). MongoDB/Mongoose has been fully removed.

Read **`MIGRATION_REPORT.md`** first — it documents real conflicts found
between `org.docx` and `PA_employee_Details_.xlsx`, and one employee
(Chaitra) who currently has no email on file and therefore cannot be given a
login yet.

---

## 1. Supabase setup

1. **Create/open your Supabase project** at supabase.com (you said you already have a paid project — use it).
2. **Run the schema.** Dashboard → SQL Editor → paste the entire contents of `supabase/schema.sql` → Run. It is safe to re-run.
3. **Run the seed.** Same way, paste `supabase/seed.sql` → Run. This inserts the 3 offices (Bangalore, Dubai, Dehradun) and the 6 real employees found in the source files. It does **not** create any logins or passwords.
4. **Configure Auth:**
   - Dashboard → Authentication → Providers → make sure **Email** is enabled.
   - Dashboard → Authentication → URL Configuration → set your Site URL to your Vercel frontend URL.
5. **Configure Storage:** the schema already creates three buckets (`property-images`, `employee-photos` — public; `lead-documents` — private). Nothing else to do unless you want different bucket names.
6. **RLS** is already enabled and policies are created by `schema.sql`. The backend uses the service-role key (which bypasses RLS by design), so RLS here is the defense-in-depth layer if anything ever talks to Supabase directly with a user's own session.
7. **Create the Supabase Auth users** — see below. Do this last, after the seed has run.

### Creating Supabase Auth users (the secure way)

Never put passwords in SQL. Two supported options:

**Option A — Dashboard invite (recommended for a handful of people):**
Authentication → Users → Invite user → enter the employee's exact email
address (must match `employees.email` from the seed, e.g.
`nagesh@parvarealty.ae`). Supabase emails them a secure link to set their own
password. A `profiles` row is created automatically by the `on_auth_user_created`
trigger, linking their login to their existing employee record.

**Option B — Script it** with the service role key, run locally/once, never committed:

```js
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

await supabase.auth.admin.inviteUserByEmail('nagesh@parvarealty.ae')
```

**Chaitra cannot be onboarded yet** — no email exists for her in either
uploaded source. Once you have her real email: (1) `update public.employees
set email = 'her-real-email' where name = 'Chaitra';` then (2) invite her the
same way.

**Shradha** uses a different email domain (`diagofinace.com`) and a
different employee-code prefix (`DF`) than everyone else — confirm she
should actually have a Parva Realty CRM login before inviting her. See
`MIGRATION_REPORT.md` §D.

---

## 2. Backend — local development

```bash
cd backend
npm install
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY from
# Supabase Dashboard → Project Settings → API
npm run dev
```

Test it:

```bash
curl http://localhost:5000/api/health
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nagesh@parvarealty.ae","password":"<the password they set via invite>"}'
```

---

## 3. Backend — production deployment

The Express API is a normal long-running Node server (not converted to
Vercel serverless functions — see `MIGRATION_REPORT.md` §I for why). Deploy
it to any Node host: Render, Railway, Fly.io, a VM, etc. Steps are the same
everywhere:

1. Push this `backend/` folder to its own repo (or a subfolder your host can target).
2. Set the build command to `npm install` and start command to `npm start`.
3. Set the environment variables from `.env.example` (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `FRONTEND_URL`,
   `NODE_ENV=production`, `PORT` — most hosts set `PORT` for you).
4. Deploy. Confirm `GET /api/health` responds.

---

## 4. Frontend (Vercel)

Frontend changes needed are listed in `MIGRATION_REPORT.md` §G. In short:
keep `VITE_API_URL` pointing at wherever you deployed the backend above; no
other frontend changes are required for the endpoints this backend
implements, because the request/response shapes were kept compatible with
`services/api.ts`.

1. Connect the `parva_crm` repo to Vercel.
2. Project Settings → Environment Variables → add `VITE_API_URL=https://your-backend-host.example.com`.
3. Deploy.
4. Project Settings → Domains → add your Parva Realty custom domain once ready. Then update the backend's `FRONTEND_URL` env var to match and redeploy the backend (CORS is origin-restricted).

---

## 5. File structure

```
backend/
├── src/
│   ├── config/supabase.js        # service-role + anon Supabase clients
│   ├── middleware/
│   │   ├── auth.js               # verifies Supabase Auth token, loads employee/role
│   │   └── errorHandler.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── employeeController.js
│   │   ├── leadController.js
│   │   └── approvalController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── employees.js          # mounted at /api/users (compatibility)
│   │   ├── leads.js
│   │   └── approvals.js
│   ├── services/orgService.js    # resolves the correct Sales Manager / Super Admin
│   ├── utils/asyncHandler.js
│   └── index.js
├── supabase/
│   ├── schema.sql
│   └── seed.sql
├── .env.example
├── package.json
└── README.md
```

See `MIGRATION_REPORT.md` and `API_COMPATIBILITY.md` for the full audit.
