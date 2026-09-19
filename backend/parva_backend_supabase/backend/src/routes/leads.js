const express = require('express')
const { protect, requireRole } = require('../middleware/auth')
const asyncHandler = require('../utils/asyncHandler')
const ctrl = require('../controllers/leadController')

const router = express.Router()

router.get('/', protect, asyncHandler(ctrl.list))
router.get('/:id', protect, asyncHandler(ctrl.getOne))
router.post('/', protect, asyncHandler(ctrl.create))
router.patch('/:id', protect, asyncHandler(ctrl.update))
router.post('/:id/activity', protect, asyncHandler(ctrl.addActivity))
router.patch('/:id/assign', protect, requireRole('admin', 'manager'), asyncHandler(ctrl.assign))
router.delete('/:id', protect, requireRole('admin'), asyncHandler(ctrl.remove))

module.exports = router
