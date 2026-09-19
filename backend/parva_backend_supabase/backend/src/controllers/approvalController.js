const { supabaseAdmin } = require('../config/supabase')
const { resolveManagerForOffice, resolveSuperAdmins } = require('../services/orgService')

const SELECT = `
  *,
  lead:leads(id, name, phone, office_id),
  submitter:employees!approvals_submitted_by_fkey(id, name),
  approver:employees!approvals_assigned_approver_fkey(id, name)
`

function toPublic(a) {
  if (!a) return null
  return {
    id: a.id,
    leadId: a.lead_id,
    leadName: a.lead ? a.lead.name : null,
    submittedBy: a.submitted_by,
    submittedByName: a.submitter ? a.submitter.name : null,
    stage: a.stage,
    assignedApprover: a.assigned_approver,
    assignedApproverName: a.approver ? a.approver.name : null,
    comments: a.comments,
    submittedAt: a.submitted_at,
    reviewedAt: a.reviewed_at,
    approvedBy: a.approved_by,
    rejectedBy: a.rejected_by,
    rejectionReason: a.rejection_reason,
    escalatedTo: a.escalated_to,
    escalatedAt: a.escalated_at,
  }
}

// GET /api/approvals — scoped: admin sees all, manager sees ones assigned to
// them (or escalated to them if also admin — n/a here), agent sees ones they submitted
exports.list = async (req, res) => {
  let q = supabaseAdmin.from('approvals').select(SELECT).order('submitted_at', { ascending: false })
  if (req.user.role === 'admin') {
    // no filter
  } else if (req.user.role === 'manager') {
    q = q.eq('assigned_approver', req.user.id)
  } else {
    q = q.eq('submitted_by', req.user.id)
  }
  const { data, error } = await q
  if (error) return res.status(500).json({ message: error.message })
  res.json((data || []).map(toPublic))
}

// POST /api/approvals — Stage 1: CRM/user submits an item for approval.
// The Sales Manager is resolved from the lead's office — never hardcoded.
exports.submit = async (req, res) => {
  const { leadId, comments } = req.body
  if (!leadId) return res.status(400).json({ message: 'leadId is required' })

  const { data: lead, error: leadError } = await supabaseAdmin
    .from('leads').select('id, office_id').eq('id', leadId).maybeSingle()
  if (leadError) return res.status(500).json({ message: leadError.message })
  if (!lead) return res.status(404).json({ message: 'Lead not found' })
  if (!lead.office_id) return res.status(400).json({ message: 'Lead has no office set; cannot route for approval' })

  const manager = await resolveManagerForOffice(lead.office_id)
  if (!manager) {
    return res.status(422).json({ message: 'No active Sales Manager found for this lead\'s office' })
  }

  const { data, error } = await supabaseAdmin
    .from('approvals')
    .insert({
      lead_id: leadId,
      submitted_by: req.user.id,
      stage: 'pending_manager',
      assigned_approver: manager.id,
      comments: comments || null,
    })
    .select(SELECT)
    .single()

  if (error) return res.status(400).json({ message: error.message })

  await supabaseAdmin.from('lead_activities').insert({
    lead_id: leadId,
    type: 'approval',
    description: `Submitted for approval — routed to ${manager.name} (Sales Manager)`,
    created_by: req.user.id,
  })

  res.status(201).json(toPublic(data))
}

// PATCH /api/approvals/:id/decision — Stage 2/3: the assigned Sales Manager
// (or an admin) approves, rejects, or escalates to Super Admin.
exports.decide = async (req, res) => {
  const { action, comments } = req.body // action: 'approve' | 'reject' | 'escalate'
  const { data: approval, error: findError } = await supabaseAdmin
    .from('approvals').select('*').eq('id', req.params.id).maybeSingle()
  if (findError) return res.status(500).json({ message: findError.message })
  if (!approval) return res.status(404).json({ message: 'Approval not found' })

  if (req.user.role !== 'admin' && approval.assigned_approver !== req.user.id) {
    return res.status(403).json({ message: 'Only the assigned approver can act on this item' })
  }

  const patch = { comments: comments || approval.comments, reviewed_at: new Date().toISOString() }

  if (action === 'approve') {
    patch.stage = 'approved'
    patch.approved_by = req.user.id
  } else if (action === 'reject') {
    patch.stage = 'rejected'
    patch.rejected_by = req.user.id
    patch.rejection_reason = comments || null
  } else if (action === 'escalate') {
    // Stage 4: Sales Manager → Super Admin
    const admins = await resolveSuperAdmins()
    if (admins.length === 0) {
      return res.status(422).json({
        message: 'No active Super Admin account exists to escalate to. ' +
          'Chaitra is recorded as Super Admin but has no email/login yet — see MIGRATION_REPORT.md.',
      })
    }
    patch.stage = 'pending_admin'
    patch.assigned_approver = admins[0].id
    patch.escalated_to = admins[0].id
    patch.escalated_at = new Date().toISOString()
  } else {
    return res.status(400).json({ message: "action must be 'approve', 'reject', or 'escalate'" })
  }

  const { data, error } = await supabaseAdmin
    .from('approvals').update(patch).eq('id', req.params.id).select(SELECT).single()
  if (error) return res.status(400).json({ message: error.message })

  await supabaseAdmin.from('lead_activities').insert({
    lead_id: approval.lead_id,
    type: 'approval',
    description: `Approval ${action}d by ${req.user.name}${comments ? `: ${comments}` : ''}`,
    created_by: req.user.id,
  })

  res.json(toPublic(data))
}

exports.toPublic = toPublic
