import type { LeadStatus, LeadSource } from '../../types'

const statusConfig: Record<LeadStatus, { bg: string; text: string; dot: string }> = {
  'Lead Generation': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  'Initial Approach': { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  'Qualified Lead': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  'Consultative Approach': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  'Client Onboarding': { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', dot: 'bg-fuchsia-500' },
  'Property Highlights': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'Property Recommendation': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  'Property Finalization': { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-600' },
  'Dubai Paperwork Overview': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  'Investment Terms & Structure': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Documentation & Deal Finalization': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
}

// Shorter labels for compact table cells — full names are long SOP stage names
const statusShortLabel: Partial<Record<LeadStatus, string>> = {
  'Investment Terms & Structure': 'Investment Terms',
  'Documentation & Deal Finalization': 'Deal Finalization',
  'Dubai Paperwork Overview': 'Paperwork Overview',
}

const sourceConfig: Record<LeadSource, { bg: string; text: string }> = {
  'Housing.com': { bg: 'bg-[#1C2B4A]/10', text: 'text-[#1C2B4A]' },
  'Social Media': { bg: 'bg-pink-50', text: 'text-pink-700' },
  Referral: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'Walk-in': { bg: 'bg-gray-100', text: 'text-gray-700' },
}

export function StatusBadge({ status, compact = false }: { status: LeadStatus; compact?: boolean }) {
  const cfg = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {compact ? statusShortLabel[status] || status : status}
    </span>
  )
}

export function SourceBadge({ source }: { source: LeadSource }) {
  const cfg = sourceConfig[source]
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {source}
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: 'Low' | 'Medium' | 'High' }) {
  const cfg = {
    Low: 'bg-teal-50 text-teal-700',
    Medium: 'bg-amber-50 text-amber-700',
    High: 'bg-red-50 text-red-700',
  }[severity]
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${cfg}`}>{severity}</span>
}

export function PayrollStatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    'pending-manager': 'bg-amber-50 text-amber-700',
    'pending-admin': 'bg-violet-50 text-violet-700',
    disbursed: 'bg-emerald-50 text-emerald-700',
  }
  const labels: Record<string, string> = {
    'pending-manager': 'Awaiting Manager',
    'pending-admin': 'Awaiting Admin',
    disbursed: 'Disbursed',
  }
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${configs[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  )
}

export function AttendanceBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    present: 'bg-emerald-50 text-emerald-700',
    absent: 'bg-red-50 text-red-700',
    late: 'bg-amber-50 text-amber-700',
    'half-day': 'bg-teal-50 text-teal-700',
  }
  const labels: Record<string, string> = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    'half-day': 'Half Day',
  }
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${configs[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  )
}

export function LeaveBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${configs[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}

export function LeadScoreBadge({ score, label }: { score: number; label: 'Hot' | 'Warm' | 'Cold' }) {
  const cfg = {
    Hot: 'bg-red-50 text-red-600',
    Warm: 'bg-amber-50 text-amber-600',
    Cold: 'bg-sky-50 text-sky-600',
  }[label]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg}`}>
      {label} · {score}
    </span>
  )
}

import { getWorkloadColor, getWorkloadLabel, getCapacityPct } from '../../utils/aiAssignment'
import type { WorkloadStatus } from '../../types'

export function WorkloadBadge({ status, pct, showBar = false }: { status: WorkloadStatus; pct: number; showBar?: boolean }) {
  const color = getWorkloadColor(status)
  const label = getWorkloadLabel(status)
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
        style={{ backgroundColor: color + '18', color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      {showBar && (
        <div className="flex items-center gap-1.5">
          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
          <span className="text-[10px] text-muted-foreground">{pct}%</span>
        </div>
      )}
    </div>
  )
}
