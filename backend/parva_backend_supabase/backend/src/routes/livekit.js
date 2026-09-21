const express = require('express')
const { protect } = require('../middleware/auth')
const asyncHandler = require('../utils/asyncHandler')
const ctrl = require('../controllers/livekitController')

const router = express.Router()

// Safe health/configuration check (no secrets exposed)
router.get('/health', asyncHandler(ctrl.getHealth))

// Generate LiveKit room token — strictly requires CRM authentication
router.post('/token', protect, asyncHandler(ctrl.getToken))

module.exports = router
