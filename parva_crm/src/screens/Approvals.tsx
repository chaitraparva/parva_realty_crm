import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, XCircle, ArrowUpCircle, ClipboardCheck, RefreshCw } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { approvalsApi, ApiError } from '../services/api'
import type { Approval, Notification, Role } from '../types'

interface ApprovalsProps {
  role: Role
  onAddNotification?: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  onAddAudit?: (action: string, details: string, prev?: string, next?: string, reason?: string) => void
}

const stageCfg: Record<Approval['stage'], { cls: string; label: string }> = {
  pending_manager: { cls: 'bg-amber-50 text-amber-700', label: 'Pending — Sales Manager' },
  pending_admin: { cls: 'bg-orange-50 text-orange-700', label: 'Escalated — Super Admin' },
  approved: { cls: 'bg-emerald-50 text-emerald-700', label: 'Approved' },
  rejected: { cls: 'bg-gray-100 text-gray-600', label: 'Rejected' },
}

export default function Approvals({ role, onAddNotification, onAddAudit }: ApprovalsProps) {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState<Approval | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    approvalsApi.getAll()
      .then((data) => setApprovals(data as unknown as Approval[]))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load approvals.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const pendingCount = approvals.filter((a) => a.stage === 'pending_manager' || a.stage === 'pending_admin').length
  const canDecide = role === 'manager' || role === 'admin'

  const decide = (action: 'approve' | 'reject' | 'escalate') => {
    if (!active) return
    setBusy(true)
    approvalsApi.decide(active.id, action, comment.trim() || undefined)
      .then((updated) => {
        setApprovals((prev) => prev.map((a) => (a.id === active.id ? (updated as unknown as Approval) : a)))
        onAddAudit?.(
          `Approval ${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Escalated'}`,
          `Lead "${active.leadName}" submitted by ${active.submittedByName} — ${action}${comment.trim() ? `: ${comment.trim()}` : ''}`
        )
        onAddNotification?.({
          type: 'approval',
          title: `Approval ${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Escalated to Admin'}`,
          message: `${active.leadName || 'A lead'} was ${action === 'escalate' ? 'escalated to Super Admin' : `${action}d`}.`,
          priority: action === 'escalate' ? 'high' : 'medium',
        })
        setActive(null)
        setComment('')
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : `Could not ${action} this request — please retry.`))
      .finally(() => setBusy(false))
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
          <span>⚠ {error}</span>
          <button onClick={load} className="text-xs font-semibold underline shrink-0">Retry</button>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <ClipboardCheck size={18} className="text-accent" /> Approvals
          </h2>
          <p className="text-xs text-muted-foreground">
            {pendingCount} pending · CRM Executive → Sales Manager → Super Admin
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading approvals…</div>
      ) : approvals.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
          <CheckCircle size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No approval requests</p>
          <p className="text-xs mt-1">Submit a lead for approval from its detail page — it will appear here.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
          {approvals.map((a) => {
            const cfg = stageCfg[a.stage]
            const isPending = a.stage === 'pending_manager' || a.stage === 'pending_admin'
            return (
              <div key={a.id} className="p-5 flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-60">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{a.leadName || 'Untitled lead'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Submitted by <span className="font-medium text-foreground">{a.submittedByName || 'Unknown'}</span> · {a.submittedAt?.slice(0, 10)}
                    {a.assignedApproverName && <> · awaiting <span className="font-medium text-foreground">{a.assignedApproverName}</span></>}
                  </p>
                  {a.comments && (
                    <div className="p-3 rounded-lg text-sm text-foreground" style={{ backgroundColor: '#F5F2EC' }}>
                      {a.comments}
                    </div>
                  )}
                  {a.rejectionReason && (
                    <div className="mt-2 p-3 rounded-lg text-sm text-foreground border border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Rejection reason:</p>
                      {a.rejectionReason}
                    </div>
                  )}
                </div>
                {canDecide && isPending && (
                  <button
                    onClick={() => { setActive(a); setComment('') }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 mt-1"
                    style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
                  >
                    Review
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={!!active} onClose={() => setActive(null)} title="Review Approval Request">
        {active && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted">
              <p className="text-sm font-semibold text-foreground">{active.leadName}</p>
              <p className="text-xs text-muted-foreground">Submitted by {active.submittedByName}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Comment (optional)</label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note for the record…"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="flex gap-2 pt-2 flex-wrap">
              <button
                onClick={() => decide('reject')}
                disabled={busy}
                className="flex-1 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 transition-opacity"
                style={{ borderColor: '#DC2626', color: '#DC2626', opacity: busy ? 0.6 : 1 }}
              >
                <XCircle size={14} /> Reject
              </button>
              {role === 'manager' && active.stage === 'pending_manager' && (
                <button
                  onClick={() => decide('escalate')}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-1.5 transition-opacity"
                  style={{ borderColor: '#D97706', color: '#D97706', opacity: busy ? 0.6 : 1 }}
                >
                  <ArrowUpCircle size={14} /> Escalate to Admin
                </button>
              )}
              <button
                onClick={() => decide('approve')}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity"
                style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: busy ? 0.6 : 1 }}
              >
                <CheckCircle size={14} /> Approve
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
