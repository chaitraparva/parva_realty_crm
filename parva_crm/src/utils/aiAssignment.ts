import type { Employee, Lead, WorkloadStatus } from '../types'

const CAPACITY_THRESHOLDS = {
  available: 0.4,   // < 40% capacity used
  normal: 0.7,      // 40–70%
  high: 0.9,        // 70–90%
  overloaded: 1.0,  // > 90%
}

export function getWorkloadStatus(emp: Employee): WorkloadStatus {
  const ratio = emp.leadsAssigned / emp.capacityLimit
  if (ratio < CAPACITY_THRESHOLDS.available) return 'available'
  if (ratio < CAPACITY_THRESHOLDS.normal) return 'normal'
  if (ratio < CAPACITY_THRESHOLDS.high) return 'high'
  return 'overloaded'
}

export function getWorkloadColor(status: WorkloadStatus): string {
  switch (status) {
    case 'available': return '#10B981'
    case 'normal': return '#F59E0B'
    case 'high': return '#F97316'
    case 'overloaded': return '#DC2626'
  }
}

export function getWorkloadLabel(status: WorkloadStatus): string {
  switch (status) {
    case 'available': return 'Available'
    case 'normal': return 'Normal'
    case 'high': return 'High Load'
    case 'overloaded': return 'Overloaded'
  }
}

export function getCapacityPct(emp: Employee): number {
  return Math.min(100, Math.round((emp.leadsAssigned / emp.capacityLimit) * 100))
}

// Weighted AI scoring for a candidate agent/manager to receive a lead.
// Higher score = better suited. Returns a score 0–100.
function scoreCandidate(candidate: Employee, allCandidates: Employee[]): number {
  if (candidate.status !== 'active') return -1
  if (candidate.leadsAssigned >= candidate.capacityLimit) return -1

  let score = 100

  // Workload penalty — heavily penalise overloaded agents
  const ratio = candidate.leadsAssigned / candidate.capacityLimit
  score -= Math.round(ratio * 60)

  // Performance bonus — conversion rate adds up to 20 points
  const totalLeads = allCandidates.reduce((s, c) => s + c.leadsAssigned, 0) || 1
  const avgLeads = totalLeads / allCandidates.length
  const perfBonus = candidate.conversions / Math.max(1, candidate.leadsAssigned) * 20
  score += Math.min(20, perfBonus)

  // Balance bonus — reward agents whose load is below average
  const balanceBonus = Math.max(0, (avgLeads - candidate.leadsAssigned) / avgLeads * 15)
  score += balanceBonus

  return Math.max(0, Math.min(100, score))
}

// Returns agents ranked by suitability for a new lead.
// Filters to a specific office if provided.
export function rankCandidates(
  candidates: Employee[],
  options: { office?: 'Bangalore' | 'Dubai' } = {}
): Array<{ employee: Employee; score: number; status: WorkloadStatus }> {
  const eligible = candidates.filter(
    (e) => e.role === 'agent' && e.status === 'active' && (!options.office || e.office === options.office)
  )

  return eligible
    .map((e) => ({
      employee: e,
      score: scoreCandidate(e, eligible),
      status: getWorkloadStatus(e),
    }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
}

// Distributes N new leads across eligible candidates, returning an assignment map leadIndex → employeeId
export function aiDistributeLeads(
  count: number,
  candidates: Employee[],
  options: { office?: 'Bangalore' | 'Dubai' } = {}
): string[] {
  const eligible = candidates.filter(
    (e) => e.role === 'agent' && e.status === 'active' && (!options.office || e.office === options.office) && e.leadsAssigned < e.capacityLimit
  )
  if (eligible.length === 0) return []

  // Clone lead counts for round-robin simulation
  const counts = Object.fromEntries(eligible.map((e) => [e.id, e.leadsAssigned]))
  const assignments: string[] = []

  for (let i = 0; i < count; i++) {
    // Pick the candidate with lowest current simulated load
    const best = eligible
      .filter((e) => counts[e.id] < e.capacityLimit)
      .sort((a, b) => {
        const ratioA = counts[a.id] / a.capacityLimit
        const ratioB = counts[b.id] / b.capacityLimit
        if (Math.abs(ratioA - ratioB) > 0.05) return ratioA - ratioB
        // Tie-break by conversion performance
        const perfA = a.conversions / Math.max(1, a.leadsAssigned)
        const perfB = b.conversions / Math.max(1, b.leadsAssigned)
        return perfB - perfA
      })[0]

    if (!best) break
    assignments.push(best.id)
    counts[best.id]++
  }

  return assignments
}

// How many more leads before this employee hits a given threshold
export function remainingCapacity(emp: Employee, threshold: number = 1.0): number {
  return Math.max(0, Math.floor(emp.capacityLimit * threshold) - emp.leadsAssigned)
}
