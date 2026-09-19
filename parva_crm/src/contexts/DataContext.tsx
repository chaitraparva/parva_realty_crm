import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { usersApi, leadsApi, ApiError } from '../services/api'
import { FINAL_STAGE } from '../utils/pipeline'
import type { Employee, Lead, Office, LeadSource, LeadStatus } from '../types'

// ── Backend → frontend mapping ───────────────────────────────────
// The backend (Supabase-backed) is the single source of truth for
// employees and leads. It doesn't track a few UI-only/derived fields the
// frontend types expect (team label, conversions, response time) — those
// are filled in here from what we *do* have, never invented as fake stats.

function mapEmployee(e: Record<string, any>): Employee {
  return {
    id: e.id,
    name: e.name,
    role: e.role,
    email: e.email,
    phone: e.phone || '',
    team: e.department || (e.office ? `${e.office} Team` : 'Unassigned'),
    office: (e.office || 'Bangalore') as Office,
    managerId: e.managerId ?? undefined,
    joinDate: e.joinDate || '',
    status: e.status === 'inactive' ? 'inactive' : 'active',
    department: e.department || '',
    leadsAssigned: 0, // filled in below once leads are known
    conversions: 0,
    baseSalary: 0,
    responseTime: 'N/A',
    capacityLimit: e.capacityLimit ?? 35,
    employeeId: e.employeeId ?? undefined,
  }
}

export function mapLead(l: Record<string, any>): Lead {
  const activities = (l.activities || []).map((a: Record<string, any>) => ({
    id: a.id,
    type: a.type,
    description: a.description,
    timestamp: a.timestamp,
    by: a.by || 'Unknown',
  }))
  const lastActivity =
    activities.length > 0 ? activities[activities.length - 1].timestamp : (l.updatedAt || l.createdAt || '')

  return {
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email || '',
    source: (l.source || 'Referral') as LeadSource,
    status: (l.status || 'Lead Generation') as LeadStatus,
    assignedTo: l.assignedTo || '',
    agentName: l.agentName || '',
    budget: l.budget || '',
    propertyType: (l.propertyType || 'Apartment') as Lead['propertyType'],
    location: l.location || '',
    office: (l.office || 'Bangalore') as Office,
    createdAt: l.createdAt || '',
    lastActivity: typeof lastActivity === 'string' ? lastActivity.slice(0, 10) : '',
    activities,
    followUpDate: l.followUpDate ?? undefined,
    notes: l.notes ?? undefined,
    shortlistedUnitIds: l.shortlistedUnitIds ?? [],
    cancellationReason: l.cancellationReason ?? undefined,
    previousStatus: l.previousStatus ?? undefined,
    transferredFrom: l.transferredFrom ?? undefined,
    transferredAt: l.transferredAt ?? undefined,
    escalationReason: l.escalationReason ?? undefined,
    escalationStatus: l.escalationStatus ?? undefined,
    escalationComment: l.escalationComment ?? undefined,
    aiAssigned: l.aiAssigned ?? undefined,
  }
}

interface DataContextValue {
  employees: Employee[]
  leads: Lead[]
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [rawEmployees, setRawEmployees] = useState<Employee[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const [empData, leadData] = await Promise.all([usersApi.getAll(), leadsApi.getAll()])
      setRawEmployees((empData as Record<string, any>[]).map(mapEmployee))
      setLeads((leadData as Record<string, any>[]).map(mapLead))
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not reach the backend.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (enabled) refresh()
    else {
      setRawEmployees([])
      setLeads([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Derive leadsAssigned/conversions per employee from the real leads list
  // rather than tracking them separately (avoids the two ever drifting).
  const employees = useMemo(() => {
    return rawEmployees.map((e) => {
      const own = leads.filter((l) => l.assignedTo === e.id && l.status !== 'Cancelled')
      return {
        ...e,
        leadsAssigned: own.length,
        conversions: own.filter((l) => l.status === FINAL_STAGE).length,
      }
    })
  }, [rawEmployees, leads])

  const value = useMemo(
    () => ({ employees, leads, setLeads, loading, error, refresh }),
    [employees, leads, loading, error, refresh]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within a DataProvider')
  return ctx
}
