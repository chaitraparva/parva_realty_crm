// Vercel serverless entry point. Vercel treats any file under /api that
// exports a function of (req, res) as a serverless function — an Express
// app satisfies that signature directly, so we just re-export it.
//
// Deploy this backend as its OWN Vercel project with its Root Directory set
// to `backend/parva_backend_supabase/backend` and Vercel will pick this up
// automatically (zero-config) because it's the only file under /api.
//
// All existing routes (/api/health, /api/auth/*, /api/users, /api/leads,
// /api/approvals) are unchanged — this file changes nothing about routing,
// it only changes how the app is booted.
const app = require('../src/app')

module.exports = app
