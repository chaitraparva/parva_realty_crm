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
        attachmentPath: a.attachment_path || null,
        attachmentName: a.attachment_name || null,
        attachmentType: a.attachment_type || null,
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
    createdBy: l.created_by || null,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  }
}

// IDs of the employees who report directly to this user.
async function teamIds(userId) {
  const { data } = await supabaseAdmin.from('employees').select('id').eq('manager_id', userId)
  return (data || []).map((e) => e.id)
}

// A Lead Acquisition Manager sees the leads they created, the leads assigned to
// them, and every lead assigned to someone who reports to them.
async function acquisitionFilter(user) {
  const ids = await teamIds(user.id)
  const parts = [`created_by.eq.${user.id}`, `assigned_to.eq.${user.id}`]
  if (ids.length) parts.push(`assigned_to.in.(${ids.join(',')})`)
  return parts.join(',')
}

async function canAccessLead(user, lead) {
  if (user.role === 'admin') return true
  if (user.role === 'agent') return lead.assigned_to === user.id
  if (user.role === 'manager') return lead.office_id === user.officeId
  if (user.role === 'acquisition_manager') {
    if (lead.created_by === user.id || lead.assigned_to === user.id) return true
    if (!lead.assigned_to) return false
    const ids = await teamIds(user.id)
    return ids.includes(lead.assigned_to)
  }
  return false
}

// Must stay synchronous: a Supabase query builder is a thenable, so returning it
// from an async function would run the query instead of handing back the builder.
function scopedQuery(user, acquisitionOr) {
  let q = supabaseAdmin.from('leads').select(SELECT)
  if (user.role === 'agent') q = q.eq('assigned_to', user.id)
  else if (user.role === 'acquisition_manager') q = q.or(acquisitionOr)
  // A manager sees their own office's leads, plus any lead they transferred to
  // another office (so Bangalore can still see its Dubai hand-overs).
  else if (user.role === 'manager') q = q.or(`office_id.eq.${user.officeId},transferred_from.eq.${user.id}`)
  return q
}

// GET /api/leads — scoped by role, filterable by status/source/office
exports.list = async (req, res) => {
  const acquisitionOr = req.user.role === 'acquisition_manager' ? await acquisitionFilter(req.user) : null
  let q = scopedQuery(req.user, acquisitionOr).order('created_at', { ascending: false })

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

  if (!(await canAccessLead(req.user, data))) {
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
    // A Lead Acquisition Manager has already generated the lead, so it starts
    // at the next stage of the sales process.
    status: b.status || (req.user.role === 'acquisition_manager' ? 'Initial Approach' : 'Lead Generation'),
    created_by: req.user.id,
    office_id: b.officeId || req.user.officeId || null,
    assigned_to: b.assignedTo || null,
    budget: b.budget || null,
    property_type: b.propertyType || null,
    location: b.location || null,
    follow_up_date: b.followUpDate || null,
    notes: b.notes || null,
  }
  // Anyone but an agent/employee creating for themselves must be allowed to hand the lead on.
  if (req.user.role === 'acquisition_manager' && row.assigned_to && row.assigned_to !== req.user.id) {
    const ids = await teamIds(req.user.id)
    if (!ids.includes(row.assigned_to)) {
      return res.status(403).json({ message: 'You can only assign leads to people in your team' })
    }
  }
  const { data, error } = await supabaseAdmin.from('leads').insert(row).select(SELECT).single()
  if (error) return res.status(400).json({ message: error.message })

  // Tell the person the lead was handed to.
  if (row.assigned_to && row.assigned_to !== req.user.id) {
    const { error: notifError } = await supabaseAdmin.from('notifications').insert({
      id: require('crypto').randomUUID(),
      employee_id: row.assigned_to,
      type: 'unassigned-lead',
      title: 'New lead assigned to you',
      message: `${row.name} was assigned to you by ${req.user.name}.`,
      is_read: false,
      link: `lead-detail:${data.id}`,
    })
    if (notifError) console.error('Failed to create assignment notification:', notifError.message)
  }
  res.status(201).json(toPublic(data))
}

// PATCH /api/leads/:id
exports.update = async (req, res) => {
  const { data: existing, error: findError } = await supabaseAdmin
    .from('leads').select('id, assigned_to, office_id, created_by').eq('id', req.params.id).maybeSingle()
  if (findError) return res.status(500).json({ message: findError.message })
  if (!existing) return res.status(404).json({ message: 'Lead not found' })

  if (!(await canAccessLead(req.user, existing))) {
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
  const { type, description, attachmentPath, attachmentName, attachmentType } = req.body
  const row = {
    lead_id: req.params.id,
    type,
    description,
    created_by: req.user.id,
  }
  if (attachmentPath) {
    row.attachment_path = attachmentPath
    row.attachment_name = attachmentName || null
    row.attachment_type = attachmentType || null
  }
  const { error: insertError } = await supabaseAdmin.from('lead_activities').insert(row)
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
    .from('leads').select('id, name, office_id, assigned_to, created_by').eq('id', req.params.id).maybeSingle()
  if (findError) return res.status(500).json({ message: findError.message })
  if (!existing) return res.status(404).json({ message: 'Lead not found' })
  if (req.user.role === 'manager' && existing.office_id !== req.user.officeId) {
    return res.status(403).json({ message: 'Access denied' })
  }
  if (req.user.role === 'acquisition_manager') {
    // Can only hand leads to themselves or to people who report to them.
    const ids = await teamIds(req.user.id)
    if (assignee.id !== req.user.id && !ids.includes(assignee.id)) {
      return res.status(403).json({ message: 'You can only assign leads to people in your team' })
    }
    if (!(await canAccessLead(req.user, existing))) {
      return res.status(403).json({ message: 'Access denied' })
    }
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
