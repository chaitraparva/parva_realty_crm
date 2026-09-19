const express = require('express')
const { protect } = require('../middleware/auth')
const asyncHandler = require('../utils/asyncHandler')
const ctrl = require('../controllers/approvalController')

const router = express.Router()

router.get('/', protect, asyncHandler(ctrl.list))
router.post('/', protect, asyncHandler(ctrl.submit))
router.patch('/:id/decision', protect, asyncHandler(ctrl.decide))

module.exports = router
