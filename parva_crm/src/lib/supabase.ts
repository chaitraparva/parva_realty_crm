import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  // Fail loudly in dev rather than silently creating a broken client.
  // (Vercel/production builds should always have these set as env vars.)
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. ' +
    'Set them in .env (local) or your Vercel project settings (production).'
  )
}

// This is the ONLY Supabase client in the frontend. It uses the public
// anon/publishable key (safe to expose in the browser) — never the
// service-role key, which must stay backend-only.
//
// persistSession + autoRefreshToken keep the user logged in across page
// refreshes and tab reopens; detectSessionInUrl lets Supabase Auth pick up
// the token from invite / password-reset email links automatically.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'parva-crm-auth',
  },
})
