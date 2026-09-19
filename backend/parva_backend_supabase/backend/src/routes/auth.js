const express = require('express')
const { protect } = require('../middleware/auth')
const asyncHandler = require('../utils/asyncHandler')
const ctrl = require('../controllers/authController')

const router = express.Router()

router.post('/login', asyncHandler(ctrl.login))
router.get('/me', protect, ctrl.me)
router.patch('/change-password', protect, asyncHandler(ctrl.changePassword))

module.exports = router
