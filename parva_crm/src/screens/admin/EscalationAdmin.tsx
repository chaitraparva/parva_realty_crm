import { useState } from 'react'
import { AlertCircle, CheckCircle, XCircle, MessageSquare, ArrowRight } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { useData } from '../../contexts/DataContext'
import { leadsApi, ApiError } from '../../services/api'
import type { EscalationRequest, Lead, Notification, AuditEntry } from '../../types'

interface EscalationAdminProps {
  escalations: EscalationRequest[]
  setEscalations: React.Dispatch<React.SetStateAction<EscalationRequest[]>>
  leads: Lead[]
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>
  onAddAudit: (action: string, details: string, prev?: string, next?: string, reason?: string) => void
  onAddNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
}

const statusCfg = {
  pending: { cls: 'bg-amber-50 text-amber-700', label: 'Pending Review' },
  reviewed: { cls: 'bg-sky-50 text-sky-700', label: 'Reviewed' },
  reassigned: { cls: 'bg-emerald-50 text-emerald-700', label: 'Reassigned' },
  rejected: { cls: 'bg-gray-100 text-gray-600', label: 'Rejected' },
}

export default function EscalationAdmin({ escalations, setEscalations, leads, setLeads, onAddAudit, onAddNotification }: EscalationAdminProps) {
  const { employees } = useData()
  const [activeEsc, setActiveEsc] = useState<EscalationRequest | null>(null)
  const [adminComment, setAdminComment] = useState('')
  const [reassignTo, setReassignTo] = useState('')
  const [actionError, setActionError] = useState('')

  const agents = employees.filter((e) => e.role === 'agent' && e.status === 'active')
  const pending = escalations.filter((e) => e.status === 'pending').length

  const resolve = (esc: EscalationRequest, action: 'reassigned' | 'rejected') => {
    setEscalations((prev) =>
      prev.map((e) =>
        e.id === esc.id
          ? { ...e, status: action, adminComment, resolvedAt: new Date().toISOString().slice(0, 16).replace('T', ' '), resolvedBy: 'Chaitra' }
          : e
      )
    )
    setActionError('')
    if (action === 'reassigned' && reassignTo) {
      const agent = employees.find((a) => a.id === reassignTo)
      setLeads((prev) =>
        prev.map((l) =>
          l.id === esc.leadId
            ? { ...l, assignedTo: reassignTo, agentName: agent?.name || '', escalationStatus: 'reassigned', escalationComment: adminComment }
            : l
        )
      )
      leadsApi.assign(esc.leadId, reassignTo)
        .then(() => leadsApi.update(esc.leadId, { escalationStatus: 'reassigned', escalationComment: adminComment }))
        .catch((err) => setActionError(err instanceof ApiError ? err.message : 'Reassignment could not be saved — please retry.'))
      onAddAudit(
        'Escalation Resolved — Reassigned',
        `Lead "${esc.leadName}" reassigned from ${esc.requesterName} to ${agent?.name || reassignTo} after escalation request`,
        esc.requesterName,
        agent?.name || reassignTo,
        esc.reason
      )
      onAddNotification({
        type: 'escalation',
        title: 'Escalation Resolved',
        message: `${esc.leadName} has been reassigned to ${agent?.name}. Reason: ${adminComment || 'No comment'}`,
        priority: 'medium',
        forUserId: esc.requesterId,
      })
    } else if (action === 'rejected') {
      onAddAudit('Escalation Rejected', `Escalation request for "${esc.leadName}" by ${esc.requesterName} was rejected. Admin comment: ${adminComment}`, '', '', esc.reason)
      onAddNotification({
        type: 'escalation',
        title: 'Escalation Request Rejected',
        message: `Your reassignment request for ${esc.leadName} was reviewed. Admin comment: ${adminComment || 'No comment'}`,
        priority: 'medium',
        forUserId: esc.requesterId,
      })
    }
    setActiveEsc(null)
    setAdminComment('')
    setReassignTo('')
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>⚠ {actionError}</div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-500" /> Escalation Requests
          </h2>
          <p className="text-xs text-muted-foreground">{pending} pending review</p>
        </div>
      </div>

      {escalations.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
          <CheckCircle size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No escalation requests</p>
          <p className="text-xs mt-1">When agents or managers request reassignment, it will appear here.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
          {escalations.map((esc) => {
            const cfg = statusCfg[esc.status]
            return (
              <div key={esc.id} className="p-5 flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-60">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{esc.leadName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Raised by <span className="font-medium text-foreground">{esc.requesterName}</span> · {esc.requestedAt}</p>
                  <div className="p-3 rounded-lg text-sm text-foreground" style={{ backgroundColor: '#F5F2EC' }}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Reason:</p>
                    {esc.reason}
                  </div>
                  {esc.adminComment && (
                    <div className="mt-2 p-3 rounded-lg text-sm text-foreground border border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Admin comment:</p>
                      {esc.adminComment}
                    </div>
                  )}
                </div>
                {esc.status === 'pending' && (
                  <button
                    onClick={() => { setActiveEsc(esc); setAdminComment(''); setReassignTo('') }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 mt-1"
                    style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
                  >
                    Review <ArrowRight size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={!!activeEsc} onClose={() => setActiveEsc(null)} title="Review Escalation Request">
        {activeEsc && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted">
              <p className="text-sm font-semibold text-foreground">{activeEsc.leadName}</p>
              <p className="text-xs text-muted-foreground">Requested by {activeEsc.requesterName}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: '#FEF3C7' }}>
              <p className="text-xs font-semibold text-amber-800 mb-1">Reason given:</p>
              <p className="text-sm text-amber-900">{activeEsc.reason}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Reassign To (optional)</label>
              <select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none"
              >
                <option value="">Keep unassigned / reject request</option>
                {agents
                  .filter((a) => a.id !== activeEsc.requesterId)
                  .map((a) => <option key={a.id} value={a.id}>{a.name} ({a.office})</option>)
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Admin Comment</label>
              <textarea
                rows={3}
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="Add a comment or instruction for the requester…"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => resolve(activeEsc, 'rejected')}
                className="flex-1 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                style={{ borderColor: '#DC2626', color: '#DC2626' }}
              >
                <XCircle size={14} /> Reject
              </button>
              <button
                onClick={() => resolve(activeEsc, 'reassigned')}
                disabled={!reassignTo}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity"
                style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: reassignTo ? 1 : 0.5 }}
              >
                <CheckCircle size={14} /> Approve & Reassign
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
