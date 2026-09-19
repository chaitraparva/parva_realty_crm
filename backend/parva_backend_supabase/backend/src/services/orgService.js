const { supabaseAdmin } = require('../config/supabase')

/**
 * Determine the Sales Manager who should review a lead/item from a given
 * office. Never hardcoded — always looked up from the current employees
 * table. If an office has more than one active manager (e.g. Bangalore
 * currently has two — Nagesh N and Vijaya Vaishnavi A — org.docx does not
 * disambiguate between them), the one with the fewest currently-open
 * approvals assigned is chosen, so load is spread rather than picking
 * arbitrarily. Callers can override by naming a manager explicitly.
 */
async function resolveManagerForOffice(officeId) {
  const { data: managers, error } = await supabaseAdmin
    .from('employees')
    .select('id, name, office_id')
    .eq('office_id', officeId)
    .eq('role', 'manager')
    .eq('status', 'active')

  if (error) throw error
  if (!managers || managers.length === 0) return null
  if (managers.length === 1) return managers[0]

  const { data: counts } = await supabaseAdmin
    .from('approvals')
    .select('assigned_approver')
    .in('assigned_approver', managers.map((m) => m.id))
    .in('stage', ['pending_manager'])

  const load = {}
  for (const m of managers) load[m.id] = 0
  for (const row of counts || []) load[row.assigned_approver] = (load[row.assigned_approver] || 0) + 1

  return managers.sort((a, b) => load[a.id] - load[b.id])[0]
}

/** The organization's Super Admin(s) — currently just Chaitra. */
async function resolveSuperAdmins() {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, name, email')
    .eq('role', 'admin')
    .eq('status', 'active')

  if (error) throw error
  return data || []
}

module.exports = { resolveManagerForOffice, resolveSuperAdmins }
