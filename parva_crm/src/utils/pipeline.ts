import type { LeadStatus } from '../types'

// The ordered sales pipeline per the company SOP. 'Cancelled' is a terminal
// exit state, not part of the linear progression.
export const PIPELINE_STAGES: LeadStatus[] = [
  'Lead Generation',
  'Initial Approach',
  'Qualified Lead',
  'Consultative Approach',
  'Client Onboarding',
  'Property Highlights',
  'Property Recommendation',
  'Property Finalization',
  'Dubai Paperwork Overview',
  'Investment Terms & Structure',
  'Documentation & Deal Finalization',
]

export const FINAL_STAGE: LeadStatus = 'Documentation & Deal Finalization'
export const FIRST_STAGE: LeadStatus = 'Lead Generation'

export const STAGE_COLORS: Record<LeadStatus, string> = {
  'Lead Generation': '#0F766E',
  'Initial Approach': '#0891B2',
  'Qualified Lead': '#8B5CF6',
  'Consultative Approach': '#6366F1',
  'Client Onboarding': '#D946EF',
  'Property Highlights': '#F59E0B',
  'Property Recommendation': '#F97316',
  'Property Finalization': '#EA580C',
  'Dubai Paperwork Overview': '#0D9488',
  'Investment Terms & Structure': '#2563EB',
  'Documentation & Deal Finalization': '#10B981',
  Cancelled: '#DC2626',
}

// Simple 4-bucket grouping for compact summary views (Team Overview cards, etc.)
export function stageBucket(status: LeadStatus): 'New' | 'In Progress' | 'Closed' | 'Cancelled' {
  if (status === 'Cancelled') return 'Cancelled'
  if (status === FIRST_STAGE) return 'New'
  if (status === FINAL_STAGE) return 'Closed'
  return 'In Progress'
}
