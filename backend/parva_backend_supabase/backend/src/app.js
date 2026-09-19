require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

// Fail fast if Supabase env vars are missing (also validated in config/supabase.js).
require('./config/supabase')

const authRoutes = require('./routes/auth')
const employeeRoutes = require('./routes/employees')
const leadRoutes = require('./routes/leads')
const approvalRoutes = require('./routes/approvals')
const errorHandler = require('./middleware/errorHandler')

const app = express()

app.set('trust proxy', 1)
app.use(helmet())

// CORS — allow only the configured frontend origin(s). No wildcard in
// production. FRONTEND_URL may be a single origin or a comma-separated list
// (e.g. your production domain + a Vercel preview-deployment URL).
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || '').split(',').map((o) => o.trim()).filter(Boolean),
  'http://localhost:5173',
  'http://localhost:3000',
]
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
)

app.use(express.json({ limit: '10mb' }))

// Basic rate limiting — tighter on auth endpoints to slow brute-force attempts.
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }))
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }))

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }))

// Routes — /api/users kept (not /api/employees) for frontend compatibility.
app.use('/api/auth', authRoutes)
app.use('/api/users', employeeRoutes)
app.use('/api/leads', leadRoutes)
app.use('/api/approvals', approvalRoutes)

// 404
app.use((_, res) => res.status(404).json({ message: 'Route not found' }))

app.use(errorHandler)

module.exports = app
