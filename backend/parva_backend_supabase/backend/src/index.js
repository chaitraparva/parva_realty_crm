// Traditional long-running server entry point — used for Render, Railway,
// Fly.io, a VM, or local development (`npm run dev` / `npm start`).
//
// This is NOT used on Vercel: Vercel calls api/index.js instead, which
// imports the same Express app from ./app.js and never calls app.listen().
const app = require('./app')

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 Parva CRM API (Supabase) running on port ${PORT}`))
