const { createClient } = require('@supabase/supabase-js')

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`)
    process.exit(1)
  }
}

// Privileged client — used server-side only. Bypasses RLS. NEVER expose this
// key or this client to the browser/frontend.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Anon client — used only to perform password sign-in on behalf of the
// caller (Supabase Auth validates the credentials; no password ever touches
// our own database).
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

module.exports = { supabaseAdmin, supabaseAnon }
