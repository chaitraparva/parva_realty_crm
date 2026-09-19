import { useState } from 'react'
import { AlertTriangle, Plus, Flag as FlagIcon } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { useData } from '../../contexts/DataContext'
import type { Notification, Flag } from '../../types'

interface FlagsProps {
  flagList: Flag[]
  setFlagList: React.Dispatch<React.SetStateAction<Flag[]>>
  onAddNotification?: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  onAddAudit?: (action: string, details: string) => void
}

const severityCls = { Low: 'bg-sky-50 text-sky-700', Medium: 'bg-amber-50 text-amber-700', High: 'bg-red-50 text-red-700' }
const statusCls = { Open: 'bg-red-50 text-red-600', Acknowledged: 'bg-amber-50 text-amber-600', Resolved: 'bg-emerald-50 text-emerald-700' }

export default function Flags({ flagList, setFlagList, onAddNotification, onAddAudit }: FlagsProps) {
  const { employees } = useData()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ employeeId: '', type: 'Performance' as Flag['type'], severity: 'Low' as Flag['severity'], description: '' })

  const teamMembers = employees.filter((e) => e.role !== 'admin')

  const submit = () => {
    if (!form.employeeId || !form.description.trim()) return
    const emp = employees.find((e) => e.id === form.employeeId)!
    const flag: Flag = {
      id: `flag-${Date.now()}`,
      employeeId: form.employeeId,
      employeeName: emp.name,
      type: form.type,
      description: form.description.trim(),
      severity: form.severity,
      issuedBy: 'Sales Manager',
      date: new Date().toISOString().slice(0, 10),
      status: 'Open',
    }
    setFlagList((prev) => [flag, ...prev])
    onAddNotification?.({ type: 'flag', title: 'Flag Raised', message: `${form.severity} flag on ${emp.name}: ${form.description.trim()}`, priority: form.severity === 'High' ? 'high' : form.severity === 'Medium' ? 'medium' : 'low' })
    onAddAudit?.('Flag Issued', `${form.type} flag issued for ${emp.name}`)
    setForm({ employeeId: '', type: 'Performance', severity: 'Low', description: '' })
    setShowModal(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">Flags & Warnings</h2>
          <p className="text-xs text-muted-foreground">{flagList.filter((f) => f.status === 'Open').length} open flags</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#C9A96E', color: '#1C2B4A' }}>
          <Plus size={15} /> Raise Flag
        </button>
      </div>

      {flagList.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <FlagIcon size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm font-medium text-foreground">No flags raised yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
          {flagList.map((f) => (
            <div key={f.id} className="p-5">
              <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{f.employeeName}</p>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${severityCls[f.severity]}`}>{f.severity}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusCls[f.status]}`}>{f.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">{f.date}</p>
              </div>
              <p className="text-sm text-muted-foreground">{f.description}</p>
              <p className="text-xs text-muted-foreground mt-1">Issued by {f.issuedBy} · {f.type}</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Raise a Flag">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Team Member</label>
            <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
              <option value="">Select…</option>
              {teamMembers.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Flag['type'] })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
              {['Warning', 'Performance', 'Attendance', 'Conduct'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Severity</label>
            <div className="flex gap-2">
              {(['Low', 'Medium', 'High'] as const).map((s) => (
                <button key={s} onClick={() => setForm({ ...form, severity: s })} className="flex-1 py-2 rounded-lg text-xs font-medium transition-all" style={{ backgroundColor: form.severity === s ? '#1C2B4A' : '#F5F2EC', color: form.severity === s ? '#FAF8F5' : '#7A7065' }}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue…" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={submit} disabled={!form.employeeId || !form.description.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity" style={{ backgroundColor: '#DC2626', color: '#fff', opacity: (!form.employeeId || !form.description.trim()) ? 0.5 : 1 }}>Raise Flag</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
