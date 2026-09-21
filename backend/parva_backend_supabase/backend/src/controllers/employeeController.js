const { supabaseAdmin } = require('../config/supabase')

const SELECT = '*, offices(id, name)'

function toPublic(e) {
  if (!e) return null
  return {
    id: e.id,
    employeeId: e.employee_code,
    name: e.name,
    email: e.email,
    phone: e.phone,
    role: e.role,
    office: e.offices ? e.offices.name : null,
    officeId: e.office_id,
    managerId: e.manager_id,
    department: e.department,
    designation: e.designation,
    joinDate: e.join_date,
    status: e.status,
    capacityLimit: e.capacity_limit,
  }
}

// GET /api/users — all authenticated employees see the full employee directory.
// Role-based scoping was removed: it caused managers/agents to receive only a
// partial employee list, breaking Team Members, OrgChart, lead assignment pickers,
// and every other screen that requires the complete directory.
exports.list = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select(SELECT)
    .order('name')

  if (error) return res.status(500).json({ message: error.message })
  res.json((data || []).map(toPublic))
}

// GET /api/users/:id  (:id = employee_code or uuid)
exports.getOne = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select(SELECT)
    .or(`employee_code.eq.${req.params.id},id.eq.${req.params.id}`)
    .maybeSingle()

  if (error) return res.status(500).json({ message: error.message })
  if (!data) return res.status(404).json({ message: 'User not found' })

  if (req.user.role === 'agent' && data.id !== req.user.id) {
    return res.status(403).json({ message: 'Access denied' })
  }
  if (req.user.role === 'manager' && data.office_id !== req.user.officeId) {
    return res.status(403).json({ message: 'Access denied' })
  }
  res.json(toPublic(data))
}

// POST /api/users — admin only. Creates the employee record. Does NOT create
// a login — see README "Creating Supabase Auth users" for that step.
exports.create = async (req, res) => {
  const b = req.body
  const row = {
    employee_code: b.employeeId || null,
    name: b.name,
    email: b.email,
    phone: b.phone || null,
    role: b.role,
    office_id: b.officeId || null,
    manager_id: b.managerId || null,
    department: b.department || 'Sales',
    designation: b.designation || null,
    join_date: b.joinDate || null,
    capacity_limit: b.capacityLimit ?? 35,
  }
  const { data, error } = await supabaseAdmin.from('employees').insert(row).select(SELECT).single()
  if (error) {
    const status = error.code === '23505' ? 400 : 400
    return res.status(status).json({ message: error.code === '23505' ? 'Email or employee ID already exists' : error.message })
  }
  res.status(201).json(toPublic(data))
}

// PATCH /api/users/:id — admin only
exports.update = async (req, res) => {
  const b = req.body
  const patch = {}
  if (b.name !== undefined) patch.name = b.name
  if (b.phone !== undefined) patch.phone = b.phone
  if (b.role !== undefined) patch.role = b.role
  if (b.officeId !== undefined) patch.office_id = b.officeId
  if (b.managerId !== undefined) patch.manager_id = b.managerId
  if (b.department !== undefined) patch.department = b.department
  if (b.designation !== undefined) patch.designation = b.designation
  if (b.status !== undefined) patch.status = b.status
  if (b.capacityLimit !== undefined) patch.capacity_limit = b.capacityLimit

  const { data, error } = await supabaseAdmin
    .from('employees')
    .update(patch)
    .or(`employee_code.eq.${req.params.id},id.eq.${req.params.id}`)
    .select(SELECT)
    .maybeSingle()

  if (error) return res.status(400).json({ message: error.message })
  if (!data) return res.status(404).json({ message: 'User not found' })
  res.json(toPublic(data))
}

// DELETE /api/users/:id — soft delete (admin only)
exports.deactivate = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .update({ status: 'inactive' })
    .or(`employee_code.eq.${req.params.id},id.eq.${req.params.id}`)
    .select(SELECT)
    .maybeSingle()

  if (error) return res.status(500).json({ message: error.message })
  if (!data) return res.status(404).json({ message: 'User not found' })
  res.json({ message: 'User deactivated', user: toPublic(data) })
}

exports.toPublic = toPublic
