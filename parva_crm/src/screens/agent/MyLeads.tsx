import { useState, useEffect, useRef } from 'react'
import { Search, Filter, Plus, Phone, Clock, ChevronRight, AlertTriangle, Flag as FlagIcon, Mail, Pencil, UserCog, Building2 } from 'lucide-react'
import { siteVisits } from '../../data/mockData'
import { useData, mapLead } from '../../contexts/DataContext'
import { leadsApi, ApiError } from '../../services/api'
import { getCurrentEmployeeSettings } from '../../services/employeeSettings'
import { StatusBadge, LeadScoreBadge } from '../../components/ui/Badge'
import KPICard from '../../components/ui/KPICard'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import { getLeadScore, findDuplicatePhones } from '../../utils/leadScore'
import { PIPELINE_STAGES, FIRST_STAGE, FINAL_STAGE } from '../../utils/pipeline'
import type { LeadSource, LeadStatus, Notification, Flag, Role, Office } from '../../types'

const sources: (LeadSource | 'All')[] = ['All', 'Housing.com', 'Social Media', 'Referral', 'Walk-in']
const statuses: (LeadStatus | 'All')[] = ['All', ...PIPELINE_STAGES, 'Cancelled']
const offices: (Office | 'All')[] = ['All', 'Bangalore', 'Dubai']
const LONG_PRESS_MS = 450

interface MyLeadsProps {
  navigate: (screen: string, params?: Record<string, string>) => void
  setFlagList?: React.Dispatch<React.SetStateAction<Flag[]>>
  onAddNotification?: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  onAddAudit?: (action: string, details: string) => void
  currentUserId?: string
  currentUserName?: string
  role?: Role
}

export default function MyLeads({ navigate, setFlagList, onAddNotification, onAddAudit, currentUserId = '', currentUserName = 'You', role = 'agent' }: MyLeadsProps) {
  // Leads come from the real backend/Supabase (scoped to this user's role
  // server-side — agents see their own, managers their office, admins
  // everyone) — see DataContext. setAgentLeads applies optimistic local
  // updates that are also persisted via leadsApi below.
  const { leads: agentLeads, setLeads: setAgentLeads, employees } = useData()
  const canManage = role === 'manager' || role === 'admin'
  const [actionError, setActionError] = useState('')
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'All'>('All')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'All'>('All')
  const [officeFilter, setOfficeFilter] = useState<Office | 'All'>('All')
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'All'>('All')
  const [showLogModal, setShowLogModal] = useState(false)
  const [logForm, setLogForm] = useState({ type: 'call', notes: '', followUp: '', leadId: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>('Initial Approach')
  const [page, setPage] = useState(1)
  const pageSize = 6
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressMoved = useRef(false)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagSeverity, setFlagSeverity] = useState<'Low' | 'Medium' | 'High'>('Low')
  const [showFilters, setShowFilters] = useState(false)
  const [showNewLeadModal, setShowNewLeadModal] = useState(false)
  const [newLeadForm, setNewLeadForm] = useState({ name: '', phone: '', email: '', source: 'Referral' as LeadSource, budget: '', propertyType: 'Apartment' as 'Apartment' | 'Villa' | 'Plot', location: '' })
  const [creatingLead, setCreatingLead] = useState(false)
  const [editLeadId, setEditLeadId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', budget: '', propertyType: 'Apartment' as 'Apartment' | 'Villa' | 'Plot', location: '', notes: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null)
  const [assignTo, setAssignTo] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => { setPage(1) }, [search, sourceFilter, statusFilter, officeFilter, assigneeFilter])
  useEffect(() => { if (selected.size === 0) setSelectionMode(false) }, [selected])

  const submitNewLead = async () => {
    if (!newLeadForm.name.trim() || !newLeadForm.phone.trim()) return

    setCreatingLead(true)
    setActionError('')

    try {
      const settings = await getCurrentEmployeeSettings()

      /*
       * Agent-created leads stay with the creating agent so their new lead
       * does not disappear from an agent-scoped workspace.
       *
       * Manager/Admin-created leads can use the employee's saved
       * auto-assignment settings.
       */
      let assignedTo: string | undefined

      if (role === 'agent') {
        assignedTo = currentUserId || undefined
      } else if (settings.autoAssign) {
        const currentEmployee = employees.find(
          (employee) => employee.id === currentUserId
        )

        const eligibleAgents = employees
          .filter(
            (employee) =>
              employee.role === 'agent' &&
              employee.status === 'active' &&
              (role === 'admin' ||
                !currentEmployee?.office ||
                employee.office === currentEmployee.office)
          )
          .sort((a, b) => a.name.localeCompare(b.name))

        if (eligibleAgents.length > 0) {
          if (settings.roundRobin) {
            /*
             * Find the most recently assigned eligible agent, then choose
             * the next agent in the stable alphabetical rotation.
             */
            let lastAssignedAgentId: string | null = null
            let latestCreatedAt = ''

            for (const lead of agentLeads) {
              if (
                lead.assignedTo &&
                eligibleAgents.some(
                  (employee) => employee.id === lead.assignedTo
                )
              ) {
                const createdAt = lead.createdAt || ''

                if (createdAt >= latestCreatedAt) {
                  latestCreatedAt = createdAt
                  lastAssignedAgentId = lead.assignedTo
                }
              }
            }

            if (lastAssignedAgentId) {
              const lastIndex = eligibleAgents.findIndex(
                (employee) => employee.id === lastAssignedAgentId
              )

              assignedTo =
                eligibleAgents[
                  (lastIndex + 1) % eligibleAgents.length
                ]?.id
            } else {
              assignedTo = eligibleAgents[0]?.id
            }
          } else {
            /*
             * Auto-assign is enabled but round-robin is disabled:
             * choose the active agent currently carrying the fewest leads.
             */
            const selectedAgent = eligibleAgents.reduce(
              (best, candidate) => {
                if (!best) return candidate

                const bestCount = agentLeads.filter(
                  (lead) =>
                    lead.assignedTo === best.id &&
                    lead.status !== 'Cancelled'
                ).length

                const candidateCount = agentLeads.filter(
                  (lead) =>
                    lead.assignedTo === candidate.id &&
                    lead.status !== 'Cancelled'
                ).length

                return candidateCount < bestCount ? candidate : best
              },
              eligibleAgents[0]
            )

            assignedTo = selectedAgent?.id
          }
        }
      }

      const created = await leadsApi.create({
        name: newLeadForm.name.trim(),
        phone: newLeadForm.phone.trim(),
        email: newLeadForm.email.trim() || undefined,
        source: newLeadForm.source,
        status: FIRST_STAGE,
        assignedTo,
        budget: newLeadForm.budget.trim() || undefined,
        propertyType: newLeadForm.propertyType,
        location: newLeadForm.location.trim() || undefined,
      })

      setAgentLeads((prev) => [
        mapLead(created as Record<string, unknown>),
        ...prev,
      ])

      const createdLeadName = newLeadForm.name.trim()

      onAddAudit?.(
        'Lead Created',
        assignedTo
          ? `${currentUserName} added "${createdLeadName}" and it was automatically assigned.`
          : `${currentUserName} added "${createdLeadName}" with no automatic assignment.`
      )

      setShowNewLeadModal(false)

      setNewLeadForm({
        name: '',
        phone: '',
        email: '',
        source: 'Referral',
        budget: '',
        propertyType: 'Apartment',
        location: '',
      })
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not create this lead — please retry.'
      )
    } finally {
      setCreatingLead(false)
    }
  }

  const dupePhones = findDuplicatePhones(agentLeads)

  const openEdit = (leadId: string) => {
    const l = agentLeads.find((x) => x.id === leadId)
    if (!l) return
    setEditForm({ name: l.name, phone: l.phone, email: l.email || '', budget: l.budget || '', propertyType: l.propertyType, location: l.location || '', notes: l.notes || '' })
    setEditLeadId(leadId)
  }

  const submitEdit = () => {
    if (!editLeadId || !editForm.name.trim() || !editForm.phone.trim()) return
    const id = editLeadId
    const patch = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim(),
      budget: editForm.budget.trim(),
      propertyType: editForm.propertyType,
      location: editForm.location.trim(),
      notes: editForm.notes.trim() || undefined,
    }
    setSavingEdit(true)
    setActionError('')
    leadsApi.update(id, patch)
      .then(() => {
        setAgentLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
        onAddAudit?.('Lead Updated', `${currentUserName} updated details for "${editForm.name.trim()}"`)
        setEditLeadId(null)
      })
      .catch((err) => setActionError(err instanceof ApiError ? err.message : 'Could not save these changes — please retry.'))
      .finally(() => setSavingEdit(false))
  }

  const openAssign = (leadId: string) => {
    const l = agentLeads.find((x) => x.id === leadId)
    setAssignTo(l?.assignedTo || '')
    setAssignLeadId(leadId)
  }

  const submitAssign = () => {
    if (!assignLeadId || !assignTo) return
    const id = assignLeadId
    const agent = employees.find((e) => e.id === assignTo)
    setAssigning(true)
    setActionError('')
    leadsApi.assign(id, assignTo)
      .then(() => {
        setAgentLeads((prev) => prev.map((l) => (l.id === id ? { ...l, assignedTo: assignTo, agentName: agent?.name || '' } : l)))
        onAddAudit?.('Lead Reassigned', `${currentUserName} assigned a lead to ${agent?.name || assignTo}`)
        setAssignLeadId(null)
      })
      .catch((err) => setActionError(err instanceof ApiError ? err.message : 'Could not reassign this lead — please retry.'))
      .finally(() => setAssigning(false))
  }

  const filtered = agentLeads.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
    const matchSource = sourceFilter === 'All' || l.source === sourceFilter
    const matchStatus = statusFilter === 'All' || l.status === statusFilter
    const matchOffice = officeFilter === 'All' || l.office === officeFilter
    const matchAssignee = assigneeFilter === 'All' || l.assignedTo === assigneeFilter
    return matchSearch && matchSource && matchStatus && matchOffice && matchAssignee
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const clearSelection = () => { setSelected(new Set()); setSelectionMode(false) }
  const applyBulkStatus = () => {
    const ids = Array.from(selected)
    setAgentLeads((prev) => prev.map((l) => selected.has(l.id) ? { ...l, status: bulkStatus } : l))
    clearSelection()
    setActionError('')
    Promise.all(ids.map((id) => leadsApi.update(id, { status: bulkStatus }))).catch((err) => {
      setActionError(err instanceof ApiError ? err.message : 'Could not save the status change — please retry.')
    })
  }

  const startPress = (id: string) => {
    pressMoved.current = false
    pressTimer.current = setTimeout(() => {
      if (!pressMoved.current) { setSelectionMode(true); toggleSelect(id) }
    }, LONG_PRESS_MS)
  }
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current) }
  const handleRowClick = (id: string) => selectionMode ? toggleSelect(id) : navigate('lead-detail', { leadId: id })

  const submitActivity = () => {
    if (!logForm.leadId || !logForm.notes.trim()) return
    const leadId = logForm.leadId
    const today = new Date().toISOString().slice(0, 10)
    const followUp = logForm.followUp
    setAgentLeads((prev) => prev.map((l) =>
      l.id === leadId ? {
        ...l, lastActivity: today, followUpDate: followUp || l.followUpDate,
        activities: [...l.activities, { id: `act-${Date.now()}`, type: logForm.type as 'call', description: logForm.notes.trim(), timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '), by: currentUserName }]
      } : l
    ))
    setLogForm({ type: 'call', notes: '', followUp: '', leadId: '' })
    setShowLogModal(false)
    setActionError('')
    leadsApi.addActivity(leadId, { type: logForm.type, description: logForm.notes.trim() })
      .then(() => { if (followUp) return leadsApi.update(leadId, { followUpDate: followUp }) })
      .catch((err) => setActionError(err instanceof ApiError ? err.message : 'Could not save this activity — please retry.'))
  }

  const submitFlag = () => {
    if (!flagReason.trim()) return
    const flag: Flag = { id: `flag-${Date.now()}`, employeeId: currentUserId, employeeName: currentUserName, type: 'Self-Reported', description: flagReason.trim(), severity: flagSeverity, issuedBy: 'Self', date: new Date().toISOString().slice(0, 10), status: 'Open' }
    setFlagList?.((prev) => [flag, ...prev])
    onAddNotification?.({ type: 'flag', title: 'Flag Raised by Agent', message: `Flag raised: ${flagReason.trim()}`, priority: flagSeverity === 'High' ? 'high' : flagSeverity === 'Medium' ? 'medium' : 'low' })
    onAddAudit?.('Flag Raised (Self)', `Flag raised — ${flagReason.trim()}`)
    setFlagReason(''); setFlagSeverity('Low'); setShowFlagModal(false)
  }

  const stats = {
    total: agentLeads.length,
    new: agentLeads.filter((l) => l.status === FIRST_STAGE).length,
    siteVisit: siteVisits.filter((v) => v.status === 'Scheduled').length,
    closed: agentLeads.filter((l) => l.status === FINAL_STAGE).length,
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6">
        <KPICard title="Total Leads" value={stats.total} sub={role === 'agent' ? 'Assigned to you' : role === 'manager' ? "Your office's pipeline" : 'Across the company'} accent />
        <KPICard title="New" value={stats.new} sub="First contact needed" trend={{ value: '2', up: true }} />
        <KPICard title="Site Visits" value={stats.siteVisit} sub="Scheduled" />
        <KPICard title="Closed" value={stats.closed} sub="This month" trend={{ value: '1', up: true }} />
      </div>

      {actionError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
          <AlertTriangle size={14} className="shrink-0" /> {actionError}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm">
        {/* Search + action bar */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone…" className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors shrink-0">
              <Filter size={14} />
            </button>
            <button onClick={() => setShowFlagModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0 hidden sm:flex">
              <FlagIcon size={13} /> Flag
            </button>
            <button onClick={() => setShowNewLeadModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0">
              <Plus size={14} /><span className="hidden sm:inline">New Lead</span>
            </button>
            <button onClick={() => setShowLogModal(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shrink-0" style={{ backgroundColor: '#C9A96E', color: '#1C2B4A' }}>
              <Plus size={15} /><span className="hidden sm:inline">Log Activity</span>
            </button>
          </div>
          {showFilters && (
            <div className="flex gap-2 flex-wrap">
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'All')} className="flex-1 min-w-32 px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none">
                {sources.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'All')} className="flex-1 min-w-40 px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none">
                {statuses.map((s) => <option key={s}>{s}</option>)}
              </select>
              {canManage && (
                <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value as Office | 'All')} className="flex-1 min-w-32 px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none">
                  {offices.map((o) => <option key={o} value={o}>{o === 'All' ? 'All Offices' : o}</option>)}
                </select>
              )}
              {canManage && (
                <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="flex-1 min-w-40 px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none">
                  <option value="All">All Employees</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              )}
              <button onClick={() => setShowFlagModal(true)} className="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground">
                <FlagIcon size={12} /> Raise Flag
              </button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Hold a lead for 0.5s to select multiple for bulk status change.</p>
        </div>

        {selected.size > 0 && (
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap" style={{ backgroundColor: 'rgba(201,169,110,0.08)' }}>
            <span className="text-sm font-medium text-foreground">{selected.size} selected</span>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as LeadStatus)} className="px-2 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none flex-1 min-w-40">
              {PIPELINE_STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button onClick={applyBulkStatus} className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0" style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}>Change</button>
            <button onClick={clearSelection} className="ml-auto text-xs text-muted-foreground hover:text-foreground shrink-0">Clear</button>
          </div>
        )}

        {/* Card list — no table, works on all sizes */}
        <div className="divide-y divide-border select-none">
          {paged.map((lead) => {
            const { score, label } = getLeadScore(lead)
            const isDupe = dupePhones.has(lead.phone)
            const isSelected = selected.has(lead.id)
            return (
              <div
                key={lead.id}
                onClick={() => handleRowClick(lead.id)}
                onPointerDown={() => startPress(lead.id)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerMove={() => { pressMoved.current = true }}
                className="flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors active:bg-muted/50"
                style={{ backgroundColor: isSelected ? 'rgba(201,169,110,0.08)' : undefined }}
              >
                {selectionMode && (
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5" style={{ borderColor: isSelected ? '#C9A96E' : '#D7CFC2', backgroundColor: isSelected ? '#C9A96E' : 'transparent' }}>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold text-foreground">{lead.name}</p>
                    {isDupe && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone size={10} />{lead.phone}</span>
                    {lead.email && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail size={10} />{lead.email}</span>}
                    {lead.followUpDate && <span className="flex items-center gap-1 text-xs font-medium text-amber-600"><Clock size={10} />{lead.followUpDate}</span>}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-3 flex-wrap mt-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 size={10} />{lead.office}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><UserCog size={10} />{lead.agentName || 'Unassigned'}</span>
                      {lead.createdAt && <span className="text-xs text-muted-foreground">Created {lead.createdAt.slice(0, 10)}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <LeadScoreBadge score={score} label={label} />
                    <StatusBadge status={lead.status} compact />
                    <span className="text-xs font-semibold text-foreground ml-auto">{lead.budget}</span>
                  </div>
                </div>
                {!selectionMode && (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(lead.id)} title="Edit lead" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Pencil size={14} />
                    </button>
                    {canManage && (
                      <button onClick={() => openAssign(lead.id)} title="Assign lead" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <UserCog size={14} />
                      </button>
                    )}
                    <ChevronRight size={16} className="text-muted-foreground mt-0.5" onClick={() => navigate('lead-detail', { leadId: lead.id })} />
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-14 text-muted-foreground">
              <Mail size={28} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No leads match your filters</p>
            </div>
          )}
        </div>
        <Pagination page={currentPage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
      </div>

      <Modal open={showNewLeadModal} onClose={() => setShowNewLeadModal(false)} title="New Lead">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Client Name</label>
            <input value={newLeadForm.name} onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })} placeholder="Full name" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
            <input value={newLeadForm.phone} onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })} placeholder="Phone number" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email (optional)</label>
            <input value={newLeadForm.email} onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })} placeholder="Email address" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Source</label>
              <select value={newLeadForm.source} onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value as LeadSource })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                {sources.filter((s) => s !== 'All').map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Property Type</label>
              <select value={newLeadForm.propertyType} onChange={(e) => setNewLeadForm({ ...newLeadForm, propertyType: e.target.value as 'Apartment' | 'Villa' | 'Plot' })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                {['Apartment', 'Villa', 'Plot'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Budget (optional)</label>
              <input value={newLeadForm.budget} onChange={(e) => setNewLeadForm({ ...newLeadForm, budget: e.target.value })} placeholder="e.g. ₹1.5 Cr" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Location (optional)</label>
              <input value={newLeadForm.location} onChange={(e) => setNewLeadForm({ ...newLeadForm, location: e.target.value })} placeholder="e.g. JVC, Dubai" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowNewLeadModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={submitNewLead}
              disabled={!newLeadForm.name.trim() || !newLeadForm.phone.trim() || creatingLead}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: (!newLeadForm.name.trim() || !newLeadForm.phone.trim() || creatingLead) ? 0.5 : 1 }}
            >
              {creatingLead ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editLeadId} onClose={() => setEditLeadId(null)} title="Edit Lead">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Client Name</label>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
            <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
            <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Budget</label>
              <input value={editForm.budget} onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Property Type</label>
              <select value={editForm.propertyType} onChange={(e) => setEditForm({ ...editForm, propertyType: e.target.value as 'Apartment' | 'Villa' | 'Plot' })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                {['Apartment', 'Villa', 'Plot'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Location</label>
            <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes</label>
            <textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditLeadId(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={submitEdit}
              disabled={!editForm.name.trim() || !editForm.phone.trim() || savingEdit}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: (!editForm.name.trim() || !editForm.phone.trim() || savingEdit) ? 0.5 : 1 }}
            >
              {savingEdit ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!assignLeadId} onClose={() => setAssignLeadId(null)} title="Assign Lead">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Employee</label>
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
              <option value="">Select an employee…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.office})</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setAssignLeadId(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={submitAssign}
              disabled={!assignTo || assigning}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: (!assignTo || assigning) ? 0.5 : 1 }}
            >
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showLogModal} onClose={() => setShowLogModal(false)} title="Log Activity">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Activity Type</label>
            <div className="flex gap-2 flex-wrap">
              {['call', 'email', 'whatsapp', 'site-visit', 'note'].map((t) => (
                <button key={t} onClick={() => setLogForm({ ...logForm, type: t })} className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all" style={{ backgroundColor: logForm.type === t ? '#1C2B4A' : '#F5F2EC', color: logForm.type === t ? '#FAF8F5' : '#7A7065' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Select Lead</label>
            <select value={logForm.leadId} onChange={(e) => setLogForm({ ...logForm, leadId: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
              <option value="">Select a lead…</option>
              {agentLeads.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.status}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes</label>
            <textarea rows={3} placeholder="Describe the activity…" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Schedule Follow-up</label>
            <input type="date" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" value={logForm.followUp} onChange={(e) => setLogForm({ ...logForm, followUp: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowLogModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={submitActivity} disabled={!logForm.leadId || !logForm.notes.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity" style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: (!logForm.leadId || !logForm.notes.trim()) ? 0.5 : 1 }}>Log Activity</button>
          </div>
        </div>
      </Modal>

      <Modal open={showFlagModal} onClose={() => setShowFlagModal(false)} title="Raise a Flag">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Flag something to your manager and admin — a difficult client, workload concern, or anything worth their attention.</p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Urgency</label>
            <div className="flex gap-2">
              {(['Low', 'Medium', 'High'] as const).map((s) => (
                <button key={s} onClick={() => setFlagSeverity(s)} className="flex-1 py-2 rounded-lg text-xs font-medium transition-all" style={{ backgroundColor: flagSeverity === s ? '#1C2B4A' : '#F5F2EC', color: flagSeverity === s ? '#FAF8F5' : '#7A7065' }}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">What's going on?</label>
            <textarea rows={4} placeholder="Describe the issue…" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowFlagModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={submitFlag} disabled={!flagReason.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity" style={{ backgroundColor: '#DC2626', color: '#fff', opacity: flagReason.trim() ? 1 : 0.5 }}>Submit Flag</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
