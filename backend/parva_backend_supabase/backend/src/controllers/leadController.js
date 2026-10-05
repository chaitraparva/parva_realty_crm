const { supabaseAdmin } = require('../config/supabase')

const SELECT =
  '*, offices(id, name), lead_activities(*, author:employees(name)), assignee:employees!leads_assigned_to_fkey(id, name)'

function toPublic(l) {
  if (!l) return null
  return {
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email,
    source: l.source,
    status: l.status,
    office: l.offices ? l.offices.name : null,
    officeId: l.office_id,
    assignedTo: l.assigned_to,
    agentName: l.assignee ? l.assignee.name : null,
    budget: l.budget,
    propertyType: l.property_type,
    location: l.location,
    followUpDate: l.follow_up_date,
    notes: l.notes,
    activities: (l.lead_activities || [])
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((a) => ({
        id: a.id,
        type: a.type,
        description: a.description,
        timestamp: a.created_at,
        by: a.author ? a.author.name : a.created_by,
      })),
    shortlistedUnitIds: l.shortlisted_unit_ids || [],
    cancellationReason: l.cancellation_reason,
    previousStatus: l.previous_status,
    transferredFrom: l.transferred_from,
    transferredAt: l.transferred_at,
    escalationReason: l.escalation_reason,
    escalationStatus: l.escalation_status,
    escalationComment: l.escalation_comment,
    aiAssigned: l.ai_assigned,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  }
}

function scopedQuery(user) {
  let q = supabaseAdmin.from('leads').select(SELECT)
  if (user.role === 'agent') q = q.eq('assigned_to', user.id)
  // A manager sees their own office's leads, plus any lead they transferred to
  // another office (so Bangalore can still see its Dubai hand-overs).
  else if (user.role === 'manager') q = q.or(`office_id.eq.${user.officeId},transferred_from.eq.${user.id}`)
  return q
}

// GET /api/leads — scoped by role, filterable by status/source/office
exports.list = async (req, res) => {
  let q = scopedQuery(req.user).order('created_at', { ascending: false })

  const { status, source, office } = req.query
  if (status) q = q.eq('status', status)
  if (source) q = q.eq('source', source)
  if (office && req.user.role === 'admin') {
    const { data: officeRow } = await supabaseAdmin.from('offices').select('id').eq('name', office).maybeSingle()
    if (officeRow) q = q.eq('office_id', officeRow.id)
  }

  const { data, error } = await q
  if (error) return res.status(500).json({ message: error.message })
  res.json((data || []).map(toPublic))
}

// GET /api/leads/:id
exports.getOne = async (req, res) => {
  const { data, error } = await supabaseAdmin.from('leads').select(SELECT).eq('id', req.params.id).maybeSingle()
  if (error) return res.status(500).json({ message: error.message })
  if (!data) return res.status(404).json({ message: 'Lead not found' })

  if (req.user.role === 'agent' && data.assigned_to !== req.user.id) {
    return res.status(403).json({ message: 'Access denied' })
  }
  if (req.user.role === 'manager' && data.office_id !== req.user.officeId) {
    return res.status(403).json({ message: 'Access denied' })
  }
  res.json(toPublic(data))
}

// POST /api/leads
exports.create = async (req, res) => {
  const b = req.body
  const row = {
    name: b.name,
    phone: b.phone,
    email: b.email || null,
    source: b.source || null,
    status: b.status || 'Lead Generation',
    office_id: b.officeId || req.user.officeId || null,
    assigned_to: b.assignedTo || null,
    budget: b.budget || null,
    property_type: b.propertyType || null,
    location: b.location || null,
    follow_up_date: b.followUpDate || null,
    notes: b.notes || null,
  }
  const { data, error } = await supabaseAdmin.from('leads').insert(row).select(SELECT).single()
  if (error) return res.status(400).json({ message: error.message })
  res.status(201).json(toPublic(data))
}

// PATCH /api/leads/:id
exports.update = async (req, res) => {
  const { data: existing, error: findError } = await supabaseAdmin
    .from('leads').select('id, assigned_to, office_id').eq('id', req.params.id).maybeSingle()
  if (findError) return res.status(500).json({ message: findError.message })
  if (!existing) return res.status(404).json({ message: 'Lead not found' })

  if (req.user.role === 'agent' && existing.assigned_to !== req.user.id) {
    return res.status(403).json({ message: 'Access denied' })
  }
  if (req.user.role === 'manager' && existing.office_id !== req.user.officeId) {
    return res.status(403).json({ message: 'Access denied' })
  }

  const b = req.body
  const patch = {}
  const map = {
    name: 'name', phone: 'phone', email: 'email', source: 'source', status: 'status',
    budget: 'budget', propertyType: 'property_type', location: 'location',
    followUpDate: 'follow_up_date', notes: 'notes', shortlistedUnitIds: 'shortlisted_unit_ids',
    cancellationReason: 'cancellation_reason', previousStatus: 'previous_status',
    escalationReason: 'escalation_reason', escalationStatus: 'escalation_status',
    escalationComment: 'escalation_comment', aiAssigned: 'ai_assigned',
    transferredFrom: 'transferred_from',
  }
  for (const [k, col] of Object.entries(map)) if (b[k] !== undefined) patch[col] = b[k]

  const { data, error } = await supabaseAdmin.from('leads').update(patch).eq('id', req.params.id).select(SELECT).single()
  if (error) return res.status(400).json({ message: error.message })
  res.json(toPublic(data))
}

// POST /api/leads/:id/activity
exports.addActivity = async (req, res) => {
  const { type, description } = req.body
  const { error: insertError } = await supabaseAdmin.from('lead_activities').insert({
    lead_id: req.params.id,
    type,
    description,
    created_by: req.user.id,
  })
  if (insertError) return res.status(400).json({ message: insertError.message })

  const { data, error } = await supabaseAdmin.from('leads').select(SELECT).eq('id', req.params.id).maybeSingle()
  if (error) return res.status(500).json({ message: error.message })
  if (!data) return res.status(404).json({ message: 'Lead not found' })
  res.json(toPublic(data))
}

// PATCH /api/leads/:id/assign — admin/manager only.
// The lead moves to the assignee's office too, so a Dubai employee actually
// sees a lead transferred from Bangalore, and the assignee is notified.
exports.assign = async (req, res) => {
  const { assignedTo } = req.body
  if (!assignedTo) return res.status(400).json({ message: 'assignedTo is required' })

  const { data: assignee, error: assigneeError } = await supabaseAdmin
    .from('employees').select('id, name, office_id, status').eq('id', assignedTo).maybeSingle()
  if (assigneeError) return res.status(500).json({ message: assigneeError.message })
  if (!assignee || assignee.status === 'inactive') {
    return res.status(400).json({ message: 'That employee is not active' })
  }

  const { data: existing, error: findError } = await supabaseAdmin
    .from('leads').select('id, name, office_id, assigned_to').eq('id', req.params.id).maybeSingle()
  if (findError) return res.status(500).json({ message: findError.message })
  if (!existing) return res.status(404).json({ message: 'Lead not found' })
  if (req.user.role === 'manager' && existing.office_id !== req.user.officeId) {
    return res.status(403).json({ message: 'Access denied' })
  }

  const patch = { assigned_to: assignee.id }
  if (assignee.office_id) patch.office_id = assignee.office_id

  const { data, error } = await supabaseAdmin
    .from('leads').update(patch).eq('id', req.params.id).select(SELECT).maybeSingle()
  if (error) return res.status(400).json({ message: error.message })
  if (!data) return res.status(404).json({ message: 'Lead not found' })

  // Notify the new owner (never the person who did the assigning).
  if (assignee.id !== req.user.id && existing.assigned_to !== assignee.id) {
    const crossOffice = assignee.office_id && existing.office_id !== assignee.office_id
    const { error: notifError } = await supabaseAdmin.from('notifications').insert({
      id: require('crypto').randomUUID(),
      employee_id: assignee.id,
      type: crossOffice ? 'lead-transfer' : 'unassigned-lead',
      title: crossOffice ? 'Lead transferred to you' : 'New lead assigned to you',
      message: crossOffice
        ? `${existing.name} was transferred to you by ${req.user.name} for the Dubai Paperwork stage.`
        : `${existing.name} was assigned to you by ${req.user.name}.`,
      is_read: false,
      link: `lead-detail:${existing.id}`,
    })
    if (notifError) console.error('Failed to create assignment notification:', notifError.message)
  }

  res.json(toPublic(data))
}

// DELETE /api/leads/:id — admin only
exports.remove = async (req, res) => {
  const { error } = await supabaseAdmin.from('leads').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ message: error.message })
  res.json({ message: 'Lead deleted' })
}

exports.toPublic = toPublic
