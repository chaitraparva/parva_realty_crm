const express = require('express')
const { protect, requireRole } = require('../middleware/auth')
const asyncHandler = require('../utils/asyncHandler')
const ctrl = require('../controllers/employeeController')

const router = express.Router()

router.get('/', protect, asyncHandler(ctrl.list))
router.get('/:id', protect, asyncHandler(ctrl.getOne))
router.post('/', protect, requireRole('admin'), asyncHandler(ctrl.create))
router.patch('/:id', protect, requireRole('admin'), asyncHandler(ctrl.update))
router.delete('/:id', protect, requireRole('admin'), asyncHandler(ctrl.deactivate))

module.exports = router
