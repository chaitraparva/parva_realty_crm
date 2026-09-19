import { useMemo, useState } from 'react'
import { Plus, MapPin, User, Clock, CheckCircle2, XCircle, CalendarClock, UserPlus, ShieldQuestion } from 'lucide-react'
import { projects } from '../data/mockData'
import { useData } from '../contexts/DataContext'
import Modal from '../components/ui/Modal'
import type { Role, SiteVisit, Notification } from '../types'
import { currentUserByRole } from './Messages'

const statusCfg: Record<SiteVisit['status'], { cls: string; icon: React.ReactNode }> = {
  'Pending Assignment': { cls: 'bg-amber-50 text-amber-700', icon: <ShieldQuestion size={12} /> },
  Scheduled: { cls: 'bg-sky-50 text-sky-700', icon: <CalendarClock size={12} /> },
  Completed: { cls: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 size={12} /> },
  Cancelled: { cls: 'bg-gray-100 text-gray-600', icon: <XCircle size={12} /> },
  'No-show': { cls: 'bg-red-50 text-red-700', icon: <XCircle size={12} /> },
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr)
  return { weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }), day: d.getDate(), month: d.toLocaleDateString('en-IN', { month: 'short' }) }
}

interface SiteVisitsProps {
  role: Role
  visitList: SiteVisit[]
  setVisitList: React.Dispatch<React.SetStateAction<SiteVisit[]>>
  onAddNotification?: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  currentUserId?: string
}

export default function SiteVisits({ role, visitList, setVisitList, onAddNotification, currentUserId: propUserId }: SiteVisitsProps) {
  const { leads, employees } = useData()
  const currentUserId = propUserId || currentUserByRole[role]
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ leadId: '', projectId: '', date: '', time: '', agentId: '', managerId: '' })
  const [assigningVisitId, setAssigningVisitId] = useState<string | null>(null)
  const [pickedAgentId, setPickedAgentId] = useState('')

  const managers = employees.filter((e) => e.role === 'manager')
  const myTeamAgents = employees.filter((e) => e.managerId === currentUserId && e.role === 'agent')

  const scoped =
    role === 'agent'
      ? visitList.filter((v) => v.agentId === currentUserId)
      : role === 'manager'
      ? visitList.filter((v) => v.assignedManagerId === currentUserId || myTeamAgents.some((a) => a.id === v.agentId))
      : visitList
  const sorted = [...scoped].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  const pendingForMe = role === 'manager' ? visitList.filter((v) => v.status === 'Pending Assignment' && v.assignedManagerId === currentUserId) : []

  const days = useMemo(() => {
    const unique = Array.from(new Set(sorted.map((v) => v.date))).sort()
    return unique.map((date) => ({ date, count: sorted.filter((v) => v.date === date).length }))
  }, [sorted])

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const visible = selectedDay ? sorted.filter((v) => v.date === selectedDay) : sorted

  const eligibleLeads = role === 'agent' ? leads.filter((l) => l.assignedTo === currentUserId) : leads

  const schedule = () => {
    const lead = leads.find((l) => l.id === form.leadId)
    const project = projects.find((p) => p.id === form.projectId)
    if (!lead || !project || !form.date || !form.time) return

    if (role === 'admin') {
      if (!form.managerId) return
      const manager = employees.find((e) => e.id === form.managerId)
      const newVisit: SiteVisit = {
        id: `sv-${Date.now()}`,
        leadId: lead.id,
        leadName: lead.name,
        projectName: project.name,
        assignedManagerId: form.managerId,
        assignedManagerName: manager?.name,
        date: form.date,
        time: form.time,
        status: 'Pending Assignment',
      }
      setVisitList((prev) => [...prev, newVisit])
      onAddNotification?.({
        type: 'site-visit',
        title: 'Site Visit Delegated',
        message: `Sent to ${manager?.name} to assign an agent — ${lead.name} at ${project.name} on ${form.date}`,
        priority: 'low',
      })
    } else if (role === 'manager') {
      if (!form.agentId) return
      const agent = employees.find((e) => e.id === form.agentId)
      const newVisit: SiteVisit = {
        id: `sv-${Date.now()}`,
        leadId: lead.id,
        leadName: lead.name,
        projectName: project.name,
        agentId: form.agentId,
        agentName: agent?.name,
        date: form.date,
        time: form.time,
        status: 'Scheduled',
      }
      setVisitList((prev) => [...prev, newVisit])
      onAddNotification?.({
        type: 'site-visit',
        title: 'Site Visit Scheduled',
        message: `${agent?.name} assigned to ${lead.name} — ${project.name} on ${form.date} at ${form.time}`,
        priority: 'low',
      })
    } else {
      const newVisit: SiteVisit = {
        id: `sv-${Date.now()}`,
        leadId: lead.id,
        leadName: lead.name,
        projectName: project.name,
        agentId: lead.assignedTo,
        agentName: lead.agentName,
        date: form.date,
        time: form.time,
        status: 'Scheduled',
      }
      setVisitList((prev) => [...prev, newVisit])
      onAddNotification?.({
        type: 'site-visit',
        title: 'Site Visit Scheduled',
        message: `${lead.name} — ${project.name} on ${form.date} at ${form.time}`,
        priority: 'low',
      })
    }
    setForm({ leadId: '', projectId: '', date: '', time: '', agentId: '', managerId: '' })
    setShowModal(false)
  }

  const assignAgent = (visitId: string) => {
    if (!pickedAgentId) return
    const agent = employees.find((e) => e.id === pickedAgentId)
    const visit = visitList.find((v) => v.id === visitId)
    setVisitList((prev) =>
      prev.map((v) => (v.id === visitId ? { ...v, agentId: pickedAgentId, agentName: agent?.name, status: 'Scheduled' as const } : v))
    )
    if (visit && agent) {
      onAddNotification?.({
        type: 'site-visit',
        title: 'Site Visit Assigned',
        message: `${agent.name} assigned to ${visit.leadName} — ${visit.projectName} on ${visit.date}`,
        priority: 'low',
      })
    }
    setAssigningVisitId(null)
    setPickedAgentId('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">Site Visits</h2>
          <p className="text-xs text-muted-foreground">
            {role === 'agent' ? 'Your scheduled and completed visits' : role === 'manager' ? 'Your team\'s site visit schedule' : 'Company-wide site visit schedule'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ backgroundColor: '#C9A96E', color: '#1C2B4A' }}
        >
          <Plus size={15} /> Schedule Visit
        </button>
      </div>

      {pendingForMe.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: '#FCD34D', backgroundColor: '#FFFBEB' }}>
          <p className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-1.5">
            <ShieldQuestion size={15} /> {pendingForMe.length} visit{pendingForMe.length > 1 ? 's' : ''} from Admin need{pendingForMe.length === 1 ? 's' : ''} an agent assigned
          </p>
          <div className="space-y-2">
            {pendingForMe.map((v) => (
              <div key={v.id} className="flex items-center gap-3 flex-wrap bg-white rounded-lg p-3">
                <div className="flex-1 min-w-40">
                  <p className="text-sm font-semibold text-foreground">{v.leadName}</p>
                  <p className="text-xs text-muted-foreground">{v.projectName} · {v.date} at {v.time}</p>
                </div>
                {assigningVisitId === v.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={pickedAgentId}
                      onChange={(e) => setPickedAgentId(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none"
                    >
                      <option value="">Select agent…</option>
                      {myTeamAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <button onClick={() => assignAgent(v.id)} disabled={!pickedAgentId} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: pickedAgentId ? 1 : 0.5 }}>
                      Confirm
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAssigningVisitId(v.id); setPickedAgentId('') }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
                  >
                    <UserPlus size={13} /> Assign Agent
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day strip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedDay(null)}
          className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all"
          style={{
            backgroundColor: selectedDay === null ? '#1C2B4A' : '#fff',
            color: selectedDay === null ? '#FAF8F5' : '#7A7065',
            borderColor: selectedDay === null ? '#1C2B4A' : '#E5DFD5',
          }}
        >
          All Upcoming
        </button>
        {days.map(({ date, count }) => {
          const { weekday, day, month } = dayLabel(date)
          const active = selectedDay === date
          return (
            <button
              key={date}
              onClick={() => setSelectedDay(active ? null : date)}
              className="shrink-0 w-16 py-2 rounded-xl text-center border transition-all"
              style={{ backgroundColor: active ? '#1C2B4A' : '#fff', borderColor: active ? '#1C2B4A' : '#E5DFD5' }}
            >
              <p className="text-[10px] font-medium" style={{ color: active ? 'rgba(250,248,245,0.6)' : '#7A7065' }}>{weekday}</p>
              <p className="text-lg font-bold" style={{ color: active ? '#FAF8F5' : '#1C2B4A' }}>{day}</p>
              <p className="text-[10px]" style={{ color: active ? 'rgba(250,248,245,0.6)' : '#7A7065' }}>{month} · {count}</p>
            </button>
          )
        })}
      </div>

      {/* Visit list */}
      <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
        {visible.map((v) => {
          const cfg = statusCfg[v.status]
          return (
            <div key={v.id} className="p-4 flex items-center gap-4 flex-wrap">
              <div className="w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(28,43,74,0.08)' }}>
                <span className="text-[10px] font-medium text-primary uppercase">{dayLabel(v.date).month}</span>
                <span className="text-sm font-bold text-primary leading-none">{dayLabel(v.date).day}</span>
              </div>
              <div className="flex-1 min-w-48">
                <p className="text-sm font-semibold text-foreground">{v.leadName}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={11} />{v.projectName}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={11} />{v.time}</span>
                  {role !== 'agent' && v.agentName && <span className="flex items-center gap-1 text-xs text-muted-foreground"><User size={11} />{v.agentName}</span>}
                  {v.status === 'Pending Assignment' && v.assignedManagerName && (
                    <span className="flex items-center gap-1 text-xs text-amber-600"><User size={11} />Awaiting {v.assignedManagerName}</span>
                  )}
                </div>
                {v.outcome && <p className="text-xs text-muted-foreground mt-1.5 italic">"{v.outcome}"</p>}
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
                {cfg.icon} {v.status}
              </span>
            </div>
          )
        })}
        {visible.length === 0 && (
          <p className="text-center py-10 text-sm text-muted-foreground">No site visits {selectedDay ? 'on this day' : 'scheduled'}</p>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Schedule Site Visit">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Lead</label>
            <select
              value={form.leadId}
              onChange={(e) => setForm({ ...form, leadId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">Select a lead</option>
              {eligibleLeads.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.location}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Project</label>
            <select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">Select a project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          {role === 'admin' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assign to Manager (they'll pick the agent)</label>
              <select
                value={form.managerId}
                onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="">Select a manager</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.team}</option>)}
              </select>
            </div>
          )}

          {role === 'manager' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assign to Agent</label>
              <select
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="">Select an agent</option>
                {myTeamAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={schedule}
              disabled={!form.leadId || !form.projectId || !form.date || !form.time || (role === 'admin' && !form.managerId) || (role === 'manager' && !form.agentId)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{
                backgroundColor: '#1C2B4A',
                color: '#FAF8F5',
                opacity: (!form.leadId || !form.projectId || !form.date || !form.time || (role === 'admin' && !form.managerId) || (role === 'manager' && !form.agentId)) ? 0.5 : 1,
              }}
            >
              Schedule
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
