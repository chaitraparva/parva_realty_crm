import { useMemo, useState } from 'react'
import { AlertTriangle, Users, BarChart2, RefreshCw, Shuffle, ChevronRight } from 'lucide-react'
import { useData } from '../../contexts/DataContext'
import { leadsApi, ApiError } from '../../services/api'
import { getWorkloadStatus, getWorkloadColor, getWorkloadLabel, getCapacityPct, rankCandidates, aiDistributeLeads } from '../../utils/aiAssignment'
import { WorkloadBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import KPICard from '../../components/ui/KPICard'
import type { Lead, AuditEntry, Notification, Employee } from '../../types'

interface WorkloadDashboardProps {
  leads: Lead[]
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>
  onAddAudit: (action: string, details: string, prev?: string, next?: string, reason?: string) => void
  onAddNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
}

export default function WorkloadDashboard({ leads, setLeads, onAddAudit, onAddNotification }: WorkloadDashboardProps) {
  const { employees } = useData()
  const [showAIModal, setShowAIModal] = useState(false)
  const [newLeadCount, setNewLeadCount] = useState(10)
  const [aiOffice, setAiOffice] = useState<'Bangalore' | 'Dubai'>('Bangalore')
  const [aiResult, setAiResult] = useState<{ name: string; count: number }[]>([])
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [reassignLead, setReassignLead] = useState<Lead | null>(null)
  const [reassignTo, setReassignTo] = useState('')
  const [actionError, setActionError] = useState('')

  const agentEmployees = useMemo(() => employees.filter((e) => e.role === 'agent'), [employees])

  const stats = useMemo(() => {
    const liveLeads = leads.filter((l) => l.status !== 'Cancelled' && l.status !== 'Documentation & Deal Finalization')
    const byAgent = Object.fromEntries(agentEmployees.map((e) => [e.id, liveLeads.filter((l) => l.assignedTo === e.id).length]))
    return { liveLeads: liveLeads.length, byAgent }
  }, [leads, agentEmployees])

  const liveAgents = agentEmployees.map((e) => ({
    ...e,
    leadsAssigned: stats.byAgent[e.id] ?? e.leadsAssigned,
  }))

  const overloaded = liveAgents.filter((e) => getWorkloadStatus(e) === 'overloaded')
  const available = liveAgents.filter((e) => getWorkloadStatus(e) === 'available')
  const adminId = employees.find((e) => e.role === 'admin')?.id
  const unassignedLeads = leads.filter((l) => !l.assignedTo || l.assignedTo === adminId)

  const runAI = () => {
    const assignments = aiDistributeLeads(newLeadCount, liveAgents, { office: aiOffice })
    const counts: Record<string, number> = {}
    assignments.forEach((id) => { counts[id] = (counts[id] || 0) + 1 })
    const result = Object.entries(counts).map(([id, count]) => {
      const emp = employees.find((e) => e.id === id)!
      return { name: emp.name, count }
    })
    setAiResult(result)
    onAddAudit('AI Assignment Preview', `AI previewed distribution of ${newLeadCount} leads across ${Object.keys(counts).length} agents (${aiOffice})`)
  }

  const doReassign = () => {
    if (!reassignLead || !reassignTo) return
    const toAgent = employees.find((e) => e.id === reassignTo)
    const prevAgent = reassignLead.agentName
    setLeads((prev) =>
      prev.map((l) =>
        l.id === reassignLead.id
          ? { ...l, assignedTo: reassignTo, agentName: toAgent?.name || '' }
          : l
      )
    )
    onAddAudit('Manual Reassignment', `Lead "${reassignLead.name}" reassigned from ${prevAgent} to ${toAgent?.name}`, prevAgent, toAgent?.name || '')
    onAddNotification({ type: 'ai-assignment', title: 'Lead Reassigned', message: `${reassignLead.name} reassigned to ${toAgent?.name} by Admin`, priority: 'medium' })
    setActionError('')
    leadsApi.assign(reassignLead.id, reassignTo).catch((err) => {
      setActionError(err instanceof ApiError ? err.message : 'Reassignment could not be saved — please retry.')
    })
    setShowReassignModal(false)
    setReassignLead(null)
    setReassignTo('')
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
          <AlertTriangle size={14} className="shrink-0" /> {actionError}
        </div>
      )}
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard title="Active Leads" value={stats.liveLeads} sub="Across both offices" accent />
        <KPICard title="Overloaded Agents" value={overloaded.length} sub="Require redistribution" trend={overloaded.length > 0 ? { value: String(overloaded.length), up: false } : undefined} />
        <KPICard title="Available Capacity" value={available.length} sub="Agents ready for more" />
        <KPICard title="Unassigned" value={unassignedLeads.length} sub="Needs assignment" />
      </div>

      {/* Overload alerts */}
      {overloaded.length > 0 && (
        <div className="rounded-xl border p-4 flex items-start gap-3" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Overloaded agents: {overloaded.map((e) => e.name).join(', ')}</p>
            <p className="text-xs text-red-500 mt-0.5">Consider redistributing some of their leads to agents with available capacity.</p>
          </div>
          <button
            onClick={() => setShowAIModal(true)}
            className="ml-auto shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: '#DC2626', color: '#fff' }}
          >
            <Shuffle size={13} /> AI Distribute
          </button>
        </div>
      )}

      {/* Agent workload table */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-border flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={17} className="text-accent" />
            <h3 className="font-serif text-base font-semibold text-foreground">Agent Workload</h3>
          </div>
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
          >
            <Shuffle size={14} /> AI Lead Distribution
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Agent', 'Office', 'Team', 'Leads', 'Capacity', 'Workload', 'Conversions', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liveAgents
                .sort((a, b) => getCapacityPct(b) - getCapacityPct(a))
                .map((agent) => {
                  const status = getWorkloadStatus(agent)
                  const pct = getCapacityPct(agent)
                  const color = getWorkloadColor(status)
                  const agentLeads = leads.filter((l) => l.assignedTo === agent.id && l.status !== 'Cancelled')
                  return (
                    <tr key={agent.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: color + '20', color }}
                          >
                            {agent.name.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${agent.office === 'Dubai' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>{agent.office}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{agent.team}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-foreground">{agent.leadsAssigned}<span className="text-muted-foreground font-normal">/{agent.capacityLimit}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <WorkloadBadge status={status} pct={pct} />
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{agent.conversions}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          {agentLeads.length > 0 && (
                            <button
                              onClick={() => {
                                setReassignLead(agentLeads[0])
                                setShowReassignModal(true)
                              }}
                              className="text-xs font-medium text-primary hover:text-accent transition-colors flex items-center gap-1"
                            >
                              Reassign <ChevronRight size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Distribution Modal */}
      <Modal open={showAIModal} onClose={() => { setShowAIModal(false); setAiResult([]) }} title="AI Lead Distribution">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The AI will analyze current workloads and distribute new leads fairly across available agents based on capacity, performance, and current load.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Number of New Leads</label>
              <input
                type="number"
                min={1}
                max={200}
                value={newLeadCount}
                onChange={(e) => setNewLeadCount(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Office</label>
              <select
                value={aiOffice}
                onChange={(e) => setAiOffice(e.target.value as 'Bangalore' | 'Dubai')}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none"
              >
                <option>Bangalore</option>
                <option>Dubai</option>
              </select>
            </div>
          </div>
          <button
            onClick={runAI}
            className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
          >
            <RefreshCw size={14} /> Run AI Distribution
          </button>
          {aiResult.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Recommended Distribution</p>
              <div className="rounded-xl border border-border divide-y divide-border">
                {aiResult.map((r) => (
                  <div key={r.name} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                    <span className="text-sm font-bold text-foreground">{r.count} leads</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 rounded-b-xl">
                  <span className="text-xs font-semibold text-muted-foreground">Total</span>
                  <span className="text-xs font-semibold text-foreground">{aiResult.reduce((s, r) => s + r.count, 0)} leads</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This is a preview. In production, clicking Apply would assign these leads automatically. Super Admin can override any assignment.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Manual Reassign Modal */}
      <Modal open={showReassignModal} onClose={() => { setShowReassignModal(false); setReassignLead(null) }} title="Reassign Lead">
        {reassignLead && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted text-sm text-foreground">
              Reassigning: <span className="font-semibold">{reassignLead.name}</span>
              <span className="text-muted-foreground"> currently with {reassignLead.agentName}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assign To</label>
              <select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none"
              >
                <option value="">Select agent…</option>
                {liveAgents
                  .filter((e) => e.id !== reassignLead.assignedTo)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.office}) — {getWorkloadLabel(getWorkloadStatus(e))}
                    </option>
                  ))}
              </select>
            </div>
            {reassignTo && (
              <div>
                <p className="text-xs text-muted-foreground">AI recommendation:</p>
                {rankCandidates(liveAgents).slice(0, 3).map((r) => (
                  <div key={r.employee.id} className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium text-foreground">{r.employee.name}</span>
                    <WorkloadBadge status={r.status} pct={getCapacityPct(r.employee)} />
                    <span className="text-xs text-muted-foreground">score: {r.score.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowReassignModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={doReassign}
                disabled={!reassignTo}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: reassignTo ? 1 : 0.5 }}
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
