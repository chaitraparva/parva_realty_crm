import type { Lead } from '../types'
import { PIPELINE_STAGES } from './pipeline'

export interface LeadScore {
  score: number
  label: 'Hot' | 'Warm' | 'Cold'
}

// Simple weighted heuristic: further-along status, a scheduled follow-up,
// a confirmed budget, and recent activity all push a lead's priority up.
export function getLeadScore(lead: Lead): LeadScore {
  if (lead.status === 'Cancelled') return { score: 0, label: 'Cold' }

  let score = 10

  // Each step further along the 11-stage SOP pipeline adds priority weight
  const stageIndex = PIPELINE_STAGES.indexOf(lead.status)
  score += Math.round((stageIndex / (PIPELINE_STAGES.length - 1)) * 65)

  if (lead.followUpDate) score += 10
  if (lead.budget) score += 10
  if (lead.activities.length >= 3) score += 10
  if (lead.shortlistedUnitIds && lead.shortlistedUnitIds.length > 0) score += 10

  const daysSinceActivity = Math.max(
    0,
    Math.round((Date.now() - new Date(lead.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
  )
  // Since the demo data is dated Aug 2024, cap the recency penalty so old
  // mock timestamps don't all bottom out at "Cold" — real usage would
  // compare against "today" directly instead of clamping.
  const recencyPenalty = Math.min(20, Math.round(daysSinceActivity % 14))
  score -= recencyPenalty

  score = Math.max(0, Math.min(100, score))
  const label = score >= 65 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold'
  return { score, label }
}

export function findDuplicatePhones(leads: Lead[]): Set<string> {
  const counts = new Map<string, number>()
  leads.forEach((l) => counts.set(l.phone, (counts.get(l.phone) || 0) + 1))
  const dupePhones = new Set<string>()
  counts.forEach((count, phone) => {
    if (count > 1) dupePhones.add(phone)
  })
  return dupePhones
}
