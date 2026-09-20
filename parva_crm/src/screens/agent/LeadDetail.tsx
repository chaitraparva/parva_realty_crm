import { useState } from 'react'
import { ArrowLeft, Phone, Mail, MessageCircle, Building2, Clock, Plus, MapPin, IndianRupee, AlertTriangle, FileSignature, CheckCircle2, ExternalLink, XCircle, RotateCcw, ArrowRightCircle, Flag as FlagIcon, Plane, ClipboardCheck } from 'lucide-react'
import { useData } from '../../contexts/DataContext'
import { leadsApi, approvalsApi, ApiError } from '../../services/api'
import { StatusBadge, SourceBadge, LeadScoreBadge, WorkloadBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import SignaturePad from '../../components/ui/SignaturePad'
import { getLeadScore, findDuplicatePhones } from '../../utils/leadScore'
import { PIPELINE_STAGES, FINAL_STAGE, FIRST_STAGE } from '../../utils/pipeline'
import { rankCandidates, getCapacityPct, getWorkloadStatus } from '../../utils/aiAssignment'
import type { LeadStatus, ActivityType, Notification, EscalationRequest } from '../../types'

const statuses: LeadStatus[] = PIPELINE_STAGES

const activityIcons: Record<ActivityType, React.ReactNode> = {
  call: <Phone size={14} />,
  email: <Mail size={14} />,
  whatsapp: <MessageCircle size={14} />,
  'site-visit': <Building2 size={14} />,
  note: <Clock size={14} />,
  transfer: <ArrowRightCircle size={14} />,
  escalation: <FlagIcon size={14} />,
  'ai-assignment': <ArrowRightCircle size={14} />,
}

const activityColors: Record<ActivityType, string> = {
  call: '#0F766E',
  email: '#8B5CF6',
  whatsapp: '#10B981',
  'site-visit': '#F59E0B',
  note: '#6B7280',
  transfer: '#2563EB',
  escalation: '#D97706',
  'ai-assignment': '#16A34A',
}

interface LeadDetailProps {
  leadId: string
  navigate: (screen: string, params?: Record<string, string>) => void
  onAddNotification?: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  onAddAudit?: (action: string, details: string, prev?: string, next?: string, reason?: string) => void
  unitPhotos?: Record<string, string[]>
  onAddEscalation?: (e: EscalationRequest) => void
  currentUserId?: string
  currentUserName?: string
  canDelete?: boolean
}

export default function LeadDetail({ leadId, navigate, onAddNotification, onAddAudit, unitPhotos = {}, onAddEscalation, currentUserId = '', currentUserName = 'You', canDelete = false }: LeadDetailProps) {
  const { leads, employees, setLeads } = useData()
  const [deleting, setDeleting] = useState(false)
  const baseLead = leads.find((l) => l.id === leadId) || leads[0]
  const [status, setStatus] = useState<LeadStatus>(baseLead.status)
  const [activities, setActivities] = useState(baseLead.activities)
  const [followUpDate, setFollowUpDate] = useState(baseLead.followUpDate)
  const [showLogModal, setShowLogModal] = useState(false)
  const [logForm, setLogForm] = useState({ type: 'call' as ActivityType, notes: '', followUp: '' })
  const [showSignModal, setShowSignModal] = useState(false)
  const [signedAt, setSignedAt] = useState<string | null>(null)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState(followUpDate || '')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancellationReason, setCancellationReason] = useState(baseLead.cancellationReason || '')
  const [previousStatus, setPreviousStatus] = useState<LeadStatus | undefined>(baseLead.previousStatus)
  const [actionError, setActionError] = useState('')

  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [showEscalateModal, setShowEscalateModal] = useState(false)
  const [escalateReason, setEscalateReason] = useState('')
  const [escalated, setEscalated] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalComment, setApprovalComment] = useState('')
  const [approvalSubmitted, setApprovalSubmitted] = useState(false)
  const [approvalSubmitting, setApprovalSubmitting] = useState(false)

  const dubaiAgents = employees.filter((e) => e.office === 'Dubai' && e.role === 'agent' && e.status === 'active')
  const dubaiRanked = rankCandidates(dubaiAgents, { office: 'Dubai' })

  const lead = { ...baseLead, status, activities, followUpDate, cancellationReason }

  const { score, label } = getLeadScore(lead)
  const isDuplicate = findDuplicatePhones(leads).has(lead.phone)
  const shortlisted = (lead.shortlistedUnitIds || [])
    .map((id) => units.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u)

  // Reflects a local edit into the shared leads list (so other screens see
  // it immediately) — the API call that actually persists it runs alongside.
  const patchSharedLead = (patch: Partial<typeof baseLead>) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...patch } : l)))
  }

  const reportError = (err: unknown, fallback: string) => {
    setActionError(err instanceof ApiError ? err.message : fallback)
  }

  const openLogModal = (type: ActivityType) => {
    setLogForm({ type, notes: '', followUp: '' })
    setShowLogModal(true)
  }

  const submitActivity = () => {
    if (!logForm.notes.trim()) return
    const newActivity = {
      id: `act-${Date.now()}`,
      type: logForm.type,
      description: logForm.notes.trim(),
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      by: currentUserName,
    }
    setActivities((prev) => [...prev, newActivity])
    if (logForm.followUp) setFollowUpDate(logForm.followUp)
    patchSharedLead({ activities: [...activities, newActivity], followUpDate: logForm.followUp || followUpDate })
    setActionError('')
    leadsApi.addActivity(lead.id, { type: logForm.type, description: logForm.notes.trim() })
      .then(() => { if (logForm.followUp) return leadsApi.update(lead.id, { followUpDate: logForm.followUp }) })
      .catch((err) => reportError(err, 'Could not save this activity — please retry.'))
    setLogForm({ type: 'call', notes: '', followUp: '' })
    setShowLogModal(false)
  }

  const submitTransfer = () => {
    if (!transferTo) return
    const agent = employees.find((e) => e.id === transferTo)
    const transferActivity = {
      id: `act-${Date.now()}`,
      type: 'transfer' as ActivityType,
      description: `Lead transferred to Dubai team — ${agent?.name} (${agent?.email}). Bangalore stage completed: Property Finalization.`,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      by: currentUserName,
    }
    setActivities((prev) => [...prev, transferActivity])
    setStatus('Dubai Paperwork Overview')
    patchSharedLead({ status: 'Dubai Paperwork Overview', assignedTo: transferTo, activities: [...activities, transferActivity] })
    onAddNotification?.({
      type: 'lead-transfer',
      title: 'Lead Transferred to Dubai',
      message: `${lead.name} transferred to ${agent?.name} (Dubai) for Dubai Paperwork Overview stage.`,
      priority: 'high',
    })
    onAddAudit?.('Lead Transfer — Bangalore → Dubai', `Lead "${lead.name}" transferred to ${agent?.name} in Dubai`, 'Bangalore / Property Finalization', `Dubai / ${agent?.name}`)
    setActionError('')
    leadsApi.update(lead.id, { status: 'Dubai Paperwork Overview', transferredFrom: currentUserId })
      .then(() => leadsApi.assign(lead.id, transferTo))
      .then(() => leadsApi.addActivity(lead.id, { type: 'transfer', description: transferActivity.description }))
      .catch((err) => reportError(err, 'Transfer could not be saved — please retry.'))
    setShowTransferModal(false)
    setTransferTo('')
  }

  const submitEscalate = () => {
    if (!escalateReason.trim()) return
    const esc: EscalationRequest = {
      id: `esc-${Date.now()}`,
      leadId: lead.id,
      leadName: lead.name,
      requesterId: currentUserId,
      requesterName: currentUserName,
      reason: escalateReason.trim(),
      requestedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: 'pending',
    }
    onAddEscalation?.(esc)
    const escalateActivity = {
      id: `act-${Date.now()}`,
      type: 'escalation' as ActivityType,
      description: `Unable to Close request sent to Super Admin. Reason: ${escalateReason.trim()}`,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      by: currentUserName,
    }
    setActivities((prev) => [...prev, escalateActivity])
    patchSharedLead({ escalationReason: escalateReason.trim(), escalationStatus: 'pending', activities: [...activities, escalateActivity] })
    onAddNotification?.({
      type: 'escalation',
      title: 'Unable to Close — Escalation Requested',
      message: `${currentUserName} requested reassignment for lead "${lead.name}": ${escalateReason.trim()}`,
      priority: 'high',
    })
    onAddAudit?.('Escalation Request', `${currentUserName} requested Unable to Close for "${lead.name}"`, '', '', escalateReason.trim())
    setActionError('')
    leadsApi.update(lead.id, { escalationReason: escalateReason.trim(), escalationStatus: 'pending' })
      .then(() => leadsApi.addActivity(lead.id, { type: 'escalation', description: escalateActivity.description }))
      .catch((err) => reportError(err, 'Escalation could not be saved — please retry.'))
    setEscalated(true)
    setShowEscalateModal(false)
    setEscalateReason('')
  }

  const submitApproval = () => {
    setApprovalSubmitting(true)
    setActionError('')
    approvalsApi.submit(lead.id, approvalComment.trim() || undefined)
      .then(() => {
        setApprovalSubmitted(true)
        onAddNotification?.({
          type: 'approval',
          title: 'Submitted for Approval',
          message: `${lead.name} was submitted for Sales Manager approval.`,
          priority: 'medium',
        })
        onAddAudit?.('Submitted for Approval', `${currentUserName} submitted "${lead.name}" for approval`)
        setShowApprovalModal(false)
        setApprovalComment('')
      })
      .catch((err) => reportError(err, 'Could not submit this lead for approval — please retry.'))
      .finally(() => setApprovalSubmitting(false))
  }

  const submitReschedule = () => {
    if (!rescheduleDate) return
    setFollowUpDate(rescheduleDate)
    patchSharedLead({ followUpDate: rescheduleDate })
    setActionError('')
    leadsApi.update(lead.id, { followUpDate: rescheduleDate }).catch((err) => reportError(err, 'Could not save the new follow-up date.'))
    setShowRescheduleModal(false)
  }

  const submitCancel = () => {
    if (!cancelReason.trim()) return
    const prevStatus = status
    setPreviousStatus(prevStatus)
    setCancellationReason(cancelReason.trim())
    setStatus('Cancelled')
    patchSharedLead({ status: 'Cancelled', cancellationReason: cancelReason.trim(), previousStatus: prevStatus })
    onAddNotification?.({
      type: 'lead-cancelled',
      title: 'Lead Cancelled',
      message: `${lead.name}'s lead was cancelled: ${cancelReason.trim()}`,
      priority: 'medium',
    })
    onAddAudit?.('Lead Cancelled', `Cancelled lead for ${lead.name} — ${cancelReason.trim()}`)
    setActionError('')
    leadsApi.update(lead.id, { status: 'Cancelled', cancellationReason: cancelReason.trim(), previousStatus: prevStatus })
      .catch((err) => reportError(err, 'Cancellation could not be saved — please retry.'))
    setCancelReason('')
    setShowCancelModal(false)
  }

  const reopenLead = () => {
    const restored = previousStatus || FIRST_STAGE
    setStatus(restored)
    setCancellationReason('')
    setPreviousStatus(undefined)
    patchSharedLead({ status: restored, cancellationReason: '', previousStatus: undefined })
    setActionError('')
    leadsApi.update(lead.id, { status: restored, cancellationReason: '' })
      .catch((err) => reportError(err, 'Could not reopen the lead — please retry.'))
  }

  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const confirmDelete = () => {
    setDeleting(true)
    setActionError('')
    leadsApi.delete(lead.id)
      .then(() => {
        setLeads((prev) => prev.filter((l) => l.id !== lead.id))
        onAddAudit?.('Lead Deleted', `${currentUserName} permanently deleted lead "${lead.name}"`)
        navigate('my-leads')
      })
      .catch((err) => {
        reportError(err, 'Could not delete this lead — please retry.')
        setShowDeleteModal(false)
      })
      .finally(() => setDeleting(false))
  }

  return (
    <div>
      <button
        onClick={() => navigate('my-leads')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to My Leads
      </button>

      {actionError && (
        <div className="mb-5 px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
          <AlertTriangle size={14} className="shrink-0" /> {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Client info + timeline */}
        <div className="lg:col-span-2 space-y-5">
          {/* Client card */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-semibold font-serif" style={{ backgroundColor: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}>
                  {lead.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-foreground">{lead.name}</h2>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <SourceBadge source={lead.source} />
                    <LeadScoreBadge score={score} label={label} />
                    <span className="flex items-center gap-1 text-sm text-muted-foreground"><Phone size={13} />{lead.phone}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground"><Mail size={13} />{lead.email}</span>
                  </div>
                  {isDuplicate && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mt-2">
                      <AlertTriangle size={12} /> This phone number matches another lead in the system — check for a possible duplicate entry.
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => openLogModal('call')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: '#C9A96E', color: '#1C2B4A' }}
              >
                <Plus size={15} />
                Log Activity
              </button>
            </div>

            {/* Property info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl" style={{ backgroundColor: '#F5F2EC' }}>
              {[
                { icon: <IndianRupee size={14} />, label: 'Budget', value: lead.budget },
                { icon: <Building2 size={14} />, label: 'Property Type', value: lead.propertyType },
                { icon: <MapPin size={14} />, label: 'Location', value: lead.location },
                { icon: <Clock size={14} />, label: 'Lead Created', value: lead.createdAt },
              ].map((info) => (
                <div key={info.label}>
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    {info.icon}
                    <span className="text-xs">{info.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{info.value}</p>
                </div>
              ))}
            </div>

            {lead.notes && (
              <div className="mt-4 p-4 rounded-xl border border-amber-100 bg-amber-50">
                <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
                <p className="text-sm text-amber-800">{lead.notes}</p>
              </div>
            )}
          </div>

          {shortlisted.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg font-semibold text-foreground">Shortlisted Properties</h3>
                <button
                  onClick={() => navigate('client-portal', { leadId: lead.id })}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-accent transition-colors"
                >
                  Preview Client Portal <ExternalLink size={12} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {shortlisted.map((u) => {
                  const project = projects.find((p) => p.id === u.projectId)!
                  const photos = [...(u.photos || []), ...(unitPhotos[u.id] || [])]
                  return (
                    <div key={u.id} className="rounded-xl border border-border overflow-hidden">
                      {photos[0] && <img src={photos[0]} alt={u.unitNumber} className="w-full h-28 object-cover" />}
                      <div className="p-4">
                        <p className="text-sm font-semibold text-foreground">{project.name}</p>
                        <p className="text-xs text-muted-foreground mb-2">{project.location}</p>
                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          <p>{u.unitNumber} · {u.bhk}</p>
                          <p>{u.areaSqft.toLocaleString('en-IN')} sqft</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {status === FINAL_STAGE && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <FileSignature size={17} className="text-accent" />
                <h3 className="font-serif text-lg font-semibold text-foreground">Booking Agreement</h3>
              </div>
              {signedAt ? (
                <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium">
                  <CheckCircle2 size={16} /> Signed by {lead.name} on {signedAt}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">Collect the client's e-signature to finalize the booking.</p>
                  <button
                    onClick={() => setShowSignModal(true)}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
                  >
                    Generate & Sign Agreement
                  </button>
                </>
              )}
            </div>
          )}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <h3 className="font-serif text-lg font-semibold text-foreground mb-5">Activity Timeline</h3>
            {lead.activities.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No activities logged yet. Start with a call or email.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px" style={{ backgroundColor: '#E5DFD5' }} />
                <div className="space-y-5">
                  {lead.activities.map((act) => (
                    <div key={act.id} className="flex gap-4 relative">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 text-white"
                        style={{ backgroundColor: activityColors[act.type] }}
                      >
                        {activityIcons[act.type]}
                      </div>
                      <div className="flex-1 bg-muted rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold uppercase tracking-wide capitalize" style={{ color: activityColors[act.type] }}>
                            {act.type.replace('-', ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground">{act.timestamp}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{act.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">— {act.by}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Status + follow-up */}
        <div className="space-y-5">
          {/* Status stepper */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h3 className="font-serif text-lg font-semibold text-foreground">Lead Status</h3>
              {status !== 'Cancelled' && (
                <div className="flex items-center gap-2 flex-wrap">
                  {!approvalSubmitted ? (
                    <button
                      onClick={() => setShowApprovalModal(true)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:text-accent transition-colors"
                    >
                      <ClipboardCheck size={12} /> Submit for Approval
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-medium">✓ Submitted for approval</span>
                  )}
                  {!escalated && (
                    <button
                      onClick={() => setShowEscalateModal(true)}
                      className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                    >
                      <FlagIcon size={12} /> Unable to Close
                    </button>
                  )}
                  {escalated && (
                    <span className="text-xs text-amber-600 font-medium">⚑ Escalation sent to Admin</span>
                  )}
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    <XCircle size={13} /> Cancel Lead
                  </button>
                </div>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                  title="Permanently delete this lead"
                >
                  <XCircle size={13} /> Delete Lead
                </button>
              )}
            </div>

            {status === 'Cancelled' ? (
              <div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-4">
                  <XCircle size={20} className="text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Lead Cancelled</p>
                    {previousStatus && <p className="text-xs text-red-500 mt-0.5">Was at: {previousStatus}</p>}
                  </div>
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Reason for Cancellation</p>
                <p className="text-sm text-foreground leading-relaxed bg-muted rounded-lg p-3">{cancellationReason}</p>
                <button
                  onClick={reopenLead}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
                >
                  <RotateCcw size={14} /> Reopen Lead
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {statuses.map((s, i) => {
                  const currentIdx = statuses.indexOf(status)
                  const isDone = i < currentIdx
                  const isCurrent = i === currentIdx
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        setStatus(s)
                        patchSharedLead({ status: s })
                        setActionError('')
                        leadsApi.update(lead.id, { status: s }).catch((err) => reportError(err, 'Could not save the status change — please retry.'))
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left"
                      style={{
                        backgroundColor: isCurrent ? 'rgba(201,169,110,0.1)' : isDone ? 'rgba(16,185,129,0.06)' : 'transparent',
                        border: isCurrent ? '1px solid rgba(201,169,110,0.4)' : '1px solid transparent',
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{
                          backgroundColor: isCurrent ? '#C9A96E' : isDone ? '#10B981' : '#F0EDE7',
                          color: isCurrent || isDone ? '#fff' : '#7A7065',
                        }}
                      >
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`text-sm font-medium ${isCurrent ? 'text-foreground' : isDone ? 'text-emerald-700' : 'text-muted-foreground'}`}>{s}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Dubai Transfer recommendation — shown only at Property Finalization */}
          {status === 'Property Finalization' && (
            <div className="bg-card rounded-xl border-2 shadow-sm p-5" style={{ borderColor: '#2563EB' }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
                  <Plane size={18} style={{ color: '#2563EB' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#2563EB' }}>Ready for Dubai Handover</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This lead has completed Property Finalization in Bangalore. Transfer it to the Dubai team to proceed with Dubai Paperwork Overview.
                  </p>
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">AI Recommendation — Dubai Agent</p>
              <div className="space-y-2 mb-4">
                {dubaiRanked.slice(0, 3).map((r, i) => (
                  <label key={r.employee.id} className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors" style={{ borderColor: transferTo === r.employee.id ? '#2563EB' : '#E5DFD5', backgroundColor: transferTo === r.employee.id ? 'rgba(37,99,235,0.05)' : undefined }}>
                    <input type="radio" name="transferToInline" value={r.employee.id} checked={transferTo === r.employee.id} onChange={(e) => setTransferTo(e.target.value)} className="accent-blue-600" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#2563EB', color: '#fff' }}>Recommended</span>}
                        <p className="text-sm font-medium text-foreground">{r.employee.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.employee.team} · {r.employee.leadsAssigned}/{r.employee.capacityLimit} leads</p>
                    </div>
                    <WorkloadBadge status={r.status} pct={getCapacityPct(r.employee)} />
                  </label>
                ))}
              </div>
              <button
                onClick={submitTransfer}
                disabled={!transferTo}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
                style={{ backgroundColor: '#2563EB', color: '#fff', opacity: transferTo ? 1 : 0.5 }}
              >
                <Plane size={14} /> Confirm Transfer to Dubai
              </button>
            </div>
          )}

          {/* Follow-up reminder */}
          {lead.followUpDate && status !== 'Cancelled' && (
            <div className="bg-card rounded-xl border border-amber-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-amber-700">Follow-up Due</h3>
              </div>
              <p className="text-2xl font-serif font-semibold text-foreground">{lead.followUpDate}</p>
              <p className="text-xs text-muted-foreground mt-1">Scheduled reminder</p>
              <button
                onClick={() => { setRescheduleDate(followUpDate || ''); setShowRescheduleModal(true) }}
                className="mt-3 w-full py-2 rounded-lg text-xs font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
              >
                Reschedule
              </button>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h3 className="font-serif text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { icon: <Phone size={15} />, label: 'Call Client', color: '#0F766E', onClick: () => openLogModal('call') },
                { icon: <MessageCircle size={15} />, label: 'WhatsApp', color: '#10B981', onClick: () => openLogModal('whatsapp') },
                { icon: <Mail size={15} />, label: 'Send Email', color: '#8B5CF6', onClick: () => openLogModal('email') },
                { icon: <Building2 size={15} />, label: 'Schedule Site Visit', color: '#F59E0B', onClick: () => navigate('site-visits') },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all text-left"
                  style={{ backgroundColor: 'rgba(0,0,0,0.02)', color: action.color }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)')}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal open={showLogModal} onClose={() => setShowLogModal(false)} title="Log Activity">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Activity Type</label>
            <div className="flex gap-2 flex-wrap">
              {(['call', 'email', 'whatsapp', 'site-visit', 'note'] as ActivityType[]).map((t) => (
                <button key={t} onClick={() => setLogForm({ ...logForm, type: t })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{ backgroundColor: logForm.type === t ? '#1C2B4A' : '#F5F2EC', color: logForm.type === t ? '#FAF8F5' : '#7A7065' }}>
                  {t.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes</label>
            <textarea rows={3} placeholder="Describe the activity…"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
              value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Schedule Follow-up</label>
            <input type="date" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              value={logForm.followUp} onChange={(e) => setLogForm({ ...logForm, followUp: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowLogModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground">Cancel</button>
            <button
              onClick={submitActivity}
              disabled={!logForm.notes.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: logForm.notes.trim() ? 1 : 0.5 }}
            >
              Log Activity
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showSignModal} onClose={() => setShowSignModal(false)} title="Sign Booking Agreement">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
            Booking agreement for <span className="font-semibold text-foreground">{lead.name}</span>
            {shortlisted[0] && (
              <> — {projects.find((p) => p.id === shortlisted[0].projectId)?.name}, Unit {shortlisted[0].unitNumber}</>
            )}
          </div>
          <SignaturePad
            onSign={() => {
              setSignedAt(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))
              setShowSignModal(false)
            }}
          />
        </div>
      </Modal>

      <Modal open={showRescheduleModal} onClose={() => setShowRescheduleModal(false)} title="Reschedule Follow-up">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">New Follow-up Date</label>
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowRescheduleModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={submitReschedule}
              disabled={!rescheduleDate}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: rescheduleDate ? 1 : 0.5 }}
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Lead">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>This permanently deletes {lead.name} and all of its activity history. This cannot be undone.</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Never mind
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#DC2626', color: '#fff', opacity: deleting ? 0.6 : 1 }}
            >
              {deleting ? 'Deleting…' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Lead">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>This will move {lead.name} out of the active pipeline and mark it as Cancelled. A reason is required.</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Reason for cancellation</label>
            <textarea
              rows={4}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Client chose a different developer, budget mismatch, went unresponsive…"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowCancelModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Never mind
            </button>
            <button
              onClick={submitCancel}
              disabled={!cancelReason.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#DC2626', color: '#fff', opacity: cancelReason.trim() ? 1 : 0.5 }}
            >
              Confirm Cancellation
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showTransferModal} onClose={() => setShowTransferModal(false)} title="Transfer Lead to Dubai">
        <div className="space-y-4">
          <div className="p-3 rounded-xl flex items-start gap-2.5" style={{ backgroundColor: 'rgba(37,99,235,0.08)' }}>
            <Plane size={15} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Bangalore → Dubai Handover</p>
              <p className="text-xs text-blue-600 mt-0.5">The lead has reached Property Finalization. Transfer it to the Dubai team to continue with Dubai Paperwork Overview and beyond.</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Recommended Dubai Agent (by AI workload analysis)</label>
            <div className="space-y-2 mb-3">
              {dubaiRanked.map((r) => (
                <div key={r.employee.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                  <input type="radio" name="transferTo" value={r.employee.id} checked={transferTo === r.employee.id} onChange={(e) => setTransferTo(e.target.value)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.employee.name}</p>
                    <p className="text-xs text-muted-foreground">{r.employee.team} · {r.employee.leadsAssigned}/{r.employee.capacityLimit} leads</p>
                  </div>
                  <WorkloadBadge status={r.status} pct={getCapacityPct(r.employee)} />
                  <span className="text-xs text-muted-foreground">AI score: {r.score.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowTransferModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={submitTransfer}
              disabled={!transferTo}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity flex items-center justify-center gap-1.5"
              style={{ backgroundColor: '#2563EB', color: '#fff', opacity: transferTo ? 1 : 0.5 }}
            >
              <Plane size={14} /> Confirm Transfer
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showApprovalModal} onClose={() => setShowApprovalModal(false)} title="Submit for Approval">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sends this lead to your Sales Manager for review, per the CRM Executive → Sales Manager → Super Admin approval flow.
          </p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Comment (optional)</label>
            <textarea
              rows={3}
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              placeholder="Add any context for the reviewer…"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowApprovalModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={submitApproval}
              disabled={approvalSubmitting}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: approvalSubmitting ? 0.6 : 1 }}
            >
              {approvalSubmitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showEscalateModal} onClose={() => setShowEscalateModal(false)} title="Unable to Close — Request Reassignment">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This sends a reassignment request to Super Admin with your reason. Your manager and Admin will be notified immediately.
          </p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Reason</label>
            <textarea
              rows={4}
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              placeholder="e.g. I am currently handling multiple high-priority clients and cannot properly handle this lead…"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowEscalateModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={submitEscalate}
              disabled={!escalateReason.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
              style={{ backgroundColor: '#D97706', color: '#fff', opacity: escalateReason.trim() ? 1 : 0.5 }}
            >
              Send to Admin
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
