import { useEffect, useMemo, useState } from 'react'
import {
    CalendarDays,
    Check,
    Clock3,
    FileText,
    Plus,
    X,
    Ban,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
} from 'lucide-react'

import Modal from '../components/ui/Modal'
import { useData } from '../contexts/DataContext'
import { supabase } from '../lib/supabase'
import {
    calculateLeaveDays,
    cancelLeaveRequest,
    createLeaveRequest,
    getLeaveRequests,
    reviewLeaveRequest,
} from '../services/leaveService'

import type {
    LeaveRequest,
    LeaveStatus,
    LeaveType,
    Role,
} from '../types'

interface LeaveManagementProps {
    role?: Role
    currentUserId?: string
}

const leaveTypes: LeaveType[] = [
    'Casual Leave',
    'Sick Leave',
    'Annual Leave',
    'Emergency Leave',
    'Other',
]

const statusConfig: Record<
    LeaveStatus,
    {
        label: string
        className: string
    }
> = {
    Pending: {
        label: 'Pending',
        className: 'bg-amber-50 text-amber-700 border border-amber-200',
    },
    Approved: {
        label: 'Approved',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    },
    Rejected: {
        label: 'Rejected',
        className: 'bg-red-50 text-red-700 border border-red-200',
    },
    Cancelled: {
        label: 'Cancelled',
        className: 'bg-gray-100 text-gray-600 border border-gray-200',
    },
}

function formatDate(date: string) {
    if (!date) return '—'

    return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

function getEmployeeName(
    request: LeaveRequest,
    employees: Array<{ id: string; name: string }>
) {
    if (request.employeeName) {
        return request.employeeName
    }

    return (
        employees.find((employee) => employee.id === request.employeeId)?.name ||
        'Employee'
    )
}

export default function LeaveManagement({
    role = 'agent',
    currentUserId = '',
}: LeaveManagementProps) {
    const { employees } = useData()

    const [requests, setRequests] = useState<LeaveRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Apply Leave Modal state
    const [showApplyModal, setShowApplyModal] = useState(false)
    const [applyModalError, setApplyModalError] = useState('')
    const [form, setForm] = useState({
        leaveType: 'Casual Leave' as LeaveType,
        startDate: '',
        endDate: '',
        reason: '',
    })

    // Rejection Reason Modal state
    const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [rejectModalError, setRejectModalError] = useState('')

    // Navigation Tab state for Managers/Admins
    const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'mine'>('pending')

    const loadRequests = async (showSpinner = true) => {
        if (showSpinner) setLoading(true)
        setError('')

        try {
            const data = await getLeaveRequests(role)
            setRequests(data)
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Could not load leave requests.'
            )
        } finally {
            if (showSpinner) setLoading(false)
        }
    }

    useEffect(() => {
        void loadRequests(true)

        // Real-time synchronization with Supabase
        const channel = supabase
            .channel('leave_requests_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'leave_requests',
                },
                () => {
                    void loadRequests(false)
                }
            )
            .subscribe()

        return () => {
            void supabase.removeChannel(channel)
        }
    }, [role])

    const isAdmin = role === 'admin'

    const employeeRequests = useMemo(() => {
        return requests.filter((request) => request.employeeId === currentUserId)
    }, [requests, currentUserId])

    const pendingRequests = useMemo(() => {
        return requests.filter((request) => request.status === 'Pending')
    }, [requests])

    const displayedRequests = useMemo(() => {
        if (!isAdmin) {
            return employeeRequests
        }
        if (activeTab === 'pending') {
            return pendingRequests
        }
        if (activeTab === 'mine') {
            return employeeRequests
        }
        return requests
    }, [isAdmin, activeTab, employeeRequests, pendingRequests, requests])

    const pendingCount = pendingRequests.length

    const selectedDays =
        form.startDate && form.endDate
            ? calculateLeaveDays(form.startDate, form.endDate)
            : 0

    const resetForm = () => {
        setForm({
            leaveType: 'Casual Leave',
            startDate: '',
            endDate: '',
            reason: '',
        })
        setApplyModalError('')
    }

    const handleApplyLeave = async () => {
        setApplyModalError('')

        if (!form.leaveType) {
            setApplyModalError('Please select a leave type.')
            return
        }

        if (!form.startDate) {
            setApplyModalError('Please select a from date.')
            return
        }

        if (!form.endDate) {
            setApplyModalError('Please select a to date.')
            return
        }

        if (form.endDate < form.startDate) {
            setApplyModalError('To date cannot be before from date.')
            return
        }

        if (selectedDays <= 0) {
            setApplyModalError('Please select a valid leave period.')
            return
        }

        if (!form.reason.trim()) {
            setApplyModalError('Please enter a reason for your leave request.')
            return
        }

        setSaving(true)

        try {
            await createLeaveRequest({
                leaveType: form.leaveType,
                startDate: form.startDate,
                endDate: form.endDate,
                reason: form.reason.trim(),
            })

            setShowApplyModal(false)
            resetForm()

            await loadRequests(false)

            setSuccess('Leave request submitted successfully.')
            window.setTimeout(() => {
                setSuccess('')
            }, 4000)
        } catch (err) {
            setApplyModalError(
                err instanceof Error ? err.message : 'Could not submit leave request.'
            )
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = async (requestId: string) => {
        setError('')
        setSuccess('')
        setSaving(true)

        try {
            await cancelLeaveRequest(requestId)
            await loadRequests(false)
            setSuccess('Leave request cancelled successfully.')
            window.setTimeout(() => {
                setSuccess('')
            }, 3000)
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Could not cancel leave request.'
            )
        } finally {
            setSaving(false)
        }
    }

    const handleApprove = async (request: LeaveRequest) => {
        setError('')
        setSuccess('')
        setSaving(true)

        try {
            await reviewLeaveRequest(request.id, 'Approved')
            const empName = getEmployeeName(request, employees)
            await loadRequests(false)
            setSuccess(`Leave request for ${empName} approved successfully.`)
            window.setTimeout(() => {
                setSuccess('')
            }, 4000)
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Could not approve leave request.'
            )
        } finally {
            setSaving(false)
        }
    }

    const handleConfirmReject = async () => {
        if (!rejectingRequest) return
        setRejectModalError('')

        if (!rejectionReason.trim()) {
            setRejectModalError('Please enter a reason for rejecting this leave request.')
            return
        }

        setSaving(true)

        try {
            await reviewLeaveRequest(
                rejectingRequest.id,
                'Rejected',
                rejectionReason.trim()
            )
            const empName = getEmployeeName(rejectingRequest, employees)
            setRejectingRequest(null)
            setRejectionReason('')
            await loadRequests(false)
            setSuccess(`Leave request for ${empName} was rejected.`)
            window.setTimeout(() => {
                setSuccess('')
            }, 4000)
        } catch (err) {
            setRejectModalError(
                err instanceof Error ? err.message : 'Could not reject leave request.'
            )
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="font-serif text-lg sm:text-xl font-semibold text-foreground">
                        Leave Management
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        {isAdmin
                            ? 'Manage and approve leave requests across the organisation'
                            : 'Apply for leave and track your requests in real time'}
                    </p>
                </div>

                {/* Clearly visible + Apply for Leave button for all roles */}
                <button
                    onClick={() => {
                        setError('')
                        setSuccess('')
                        setApplyModalError('')
                        setShowApplyModal(true)
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all hover:opacity-95"
                    style={{
                        backgroundColor: '#C9A96E',
                        color: '#1C2B4A',
                    }}
                >
                    <Plus size={17} />
                    Apply for Leave
                </button>
            </div>

            {/* Notification messages */}
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2.5">
                    <AlertCircle size={17} className="shrink-0 text-red-600" />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2.5">
                    <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
                    <span>{success}</span>
                </div>
            )}

            {/* Super Admin navigation tabs */}
            {isAdmin && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-1.5 flex gap-1">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'pending'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Pending Approvals
                        {pendingCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                {pendingCount}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('all')}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        All Leave Requests
                    </button>

                    <button
                        onClick={() => setActiveTab('mine')}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'mine'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        My Requests
                        {employeeRequests.length > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                {employeeRequests.length}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* Summary Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{
                                backgroundColor: 'rgba(201,169,110,0.12)',
                            }}
                        >
                            <FileText size={18} className="text-accent" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">
                                Total Requests
                            </p>
                            <p className="text-2xl font-bold text-foreground mt-0.5">
                                {!isAdmin
                                    ? employeeRequests.length
                                    : requests.length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{
                                backgroundColor: 'rgba(245,158,11,0.12)',
                            }}
                        >
                            <Clock3 size={18} className="text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">
                                Pending
                            </p>
                            <p className="text-2xl font-bold text-foreground mt-0.5">
                                {!isAdmin
                                    ? employeeRequests.filter(
                                        (request) => request.status === 'Pending'
                                    ).length
                                    : pendingCount}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{
                                backgroundColor: 'rgba(16,185,129,0.12)',
                            }}
                        >
                            <Check size={18} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">
                                Approved
                            </p>
                            <p className="text-2xl font-bold text-foreground mt-0.5">
                                {!isAdmin
                                    ? employeeRequests.filter(
                                        (request) => request.status === 'Approved'
                                    ).length
                                    : requests.filter(
                                        (request) => request.status === 'Approved'
                                    ).length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Leave Requests Listing */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div>
                        <h3 className="font-serif text-base font-semibold text-foreground">
                            {!isAdmin
                                ? 'My Leave Requests'
                                : activeTab === 'pending'
                                    ? 'Pending Approvals'
                                    : activeTab === 'mine'
                                        ? 'My Leave Requests'
                                        : 'All Leave Requests'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {displayedRequests.length} request
                            {displayedRequests.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <button
                        onClick={() => void loadRequests(true)}
                        disabled={loading}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Reload live data from Supabase"
                    >
                        <RefreshCw
                            size={16}
                            className={loading ? 'animate-spin' : ''}
                        />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <RefreshCw
                            size={24}
                            className="mx-auto text-muted-foreground animate-spin"
                        />
                        <p className="text-sm text-muted-foreground mt-3">
                            Loading leave requests from Supabase...
                        </p>
                    </div>
                ) : displayedRequests.length === 0 ? (
                    <div className="p-12 text-center">
                        <CalendarDays
                            size={32}
                            className="mx-auto text-muted-foreground opacity-40"
                        />
                        <p className="text-sm font-semibold text-foreground mt-3">
                            No leave requests found
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                            {!isAdmin || activeTab === 'mine'
                                ? 'You have not submitted any leave requests yet. Click "+ Apply for Leave" to create one.'
                                : activeTab === 'pending'
                                    ? 'No pending leave requests require review at this time.'
                                    : 'No leave requests recorded in this view.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {displayedRequests.map((request) => {
                            const employeeName = getEmployeeName(request, employees)
                            const days =
                                request.days ||
                                calculateLeaveDays(request.startDate, request.endDate)
                            const status = statusConfig[request.status]

                            const isOwnRequest =
                                request.employeeId === currentUserId

                            const canCancel =
                                isOwnRequest && request.status === 'Pending'

                            const canReview =
                                isAdmin &&
                                request.status === 'Pending' &&
                                !isOwnRequest

                            return (
                                <div
                                    key={request.id}
                                    className="p-5 hover:bg-muted/10 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                        <div className="flex items-start gap-4 min-w-0 flex-1">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                                style={{
                                                    backgroundColor:
                                                        'rgba(201,169,110,0.12)',
                                                }}
                                            >
                                                <CalendarDays
                                                    size={19}
                                                    className="text-accent"
                                                />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    <span className="text-sm font-semibold text-foreground">
                                                        {request.leaveType}
                                                    </span>

                                                    <span
                                                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.className}`}
                                                    >
                                                        {status.label}
                                                    </span>

                                                    {isOwnRequest && isAdmin && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                                            Your request
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Employee Name (shown for all manager/admin views or if present) */}
                                                <p className="text-xs font-medium text-foreground mt-1.5">
                                                    <span className="text-muted-foreground">Employee: </span>
                                                    <span className="font-semibold">{employeeName}</span>
                                                </p>

                                                {/* Date Range & Duration */}
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    <span className="font-medium text-foreground">
                                                        {formatDate(request.startDate)}
                                                    </span>
                                                    {' → '}
                                                    <span className="font-medium text-foreground">
                                                        {formatDate(request.endDate)}
                                                    </span>
                                                    {' · '}
                                                    <span className="font-semibold text-accent">
                                                        {days} {days === 1 ? 'day' : 'days'}
                                                    </span>
                                                </p>

                                                {/* Reason */}
                                                {request.reason && (
                                                    <div className="mt-2.5 text-xs text-foreground bg-muted/30 rounded-lg p-2.5 max-w-2xl">
                                                        <span className="text-[11px] font-semibold text-muted-foreground block mb-0.5">
                                                            Reason:
                                                        </span>
                                                        <p className="whitespace-pre-wrap">
                                                            {request.reason}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Rejection Reason or Reviewer Comment */}
                                                {request.reviewerComment && (
                                                    <div
                                                        className={`mt-2.5 rounded-lg p-2.5 text-xs max-w-2xl ${request.status === 'Rejected'
                                                                ? 'bg-red-50 border border-red-200 text-red-800'
                                                                : 'bg-muted/40 border border-border text-foreground'
                                                            }`}
                                                    >
                                                        <span className="font-semibold block mb-0.5">
                                                            {request.status === 'Rejected'
                                                                ? 'Rejection Reason:'
                                                                : 'Reviewer Comment:'}
                                                        </span>
                                                        <p className="whitespace-pre-wrap">
                                                            {request.reviewerComment}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Timestamp */}
                                                <p className="text-[10px] text-muted-foreground mt-2.5">
                                                    Submitted on{' '}
                                                    {new Date(request.createdAt).toLocaleDateString(
                                                        'en-IN',
                                                        {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        }
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2 shrink-0 self-start">
                                            {canReview && (
                                                <>
                                                    <button
                                                        onClick={() => void handleApprove(request)}
                                                        disabled={saving}
                                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                                                        style={{
                                                            backgroundColor: '#1C2B4A',
                                                            color: '#FAF8F5',
                                                        }}
                                                        title="Approve this leave request"
                                                    >
                                                        <Check size={14} />
                                                        Approve
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            setRejectingRequest(request)
                                                            setRejectionReason('')
                                                            setRejectModalError('')
                                                        }}
                                                        disabled={saving}
                                                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                                        title="Reject this leave request"
                                                    >
                                                        <X size={14} />
                                                        Reject
                                                    </button>
                                                </>
                                            )}

                                            {canCancel && (
                                                <button
                                                    onClick={() => void handleCancel(request.id)}
                                                    disabled={saving}
                                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                                                >
                                                    <Ban size={14} />
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Apply for Leave Modal */}
            <Modal
                open={showApplyModal}
                onClose={() => {
                    if (!saving) {
                        setShowApplyModal(false)
                        resetForm()
                    }
                }}
                title="Apply for Leave"
            >
                <div className="space-y-4">
                    {applyModalError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                            <AlertCircle size={15} className="shrink-0 text-red-600" />
                            <span>{applyModalError}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                            Leave Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.leaveType}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    leaveType: e.target.value as LeaveType,
                                }))
                            }
                            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                        >
                            {leaveTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                                From Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        startDate: e.target.value,
                                    }))
                                }
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                                To Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={form.endDate}
                                min={form.startDate || undefined}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        endDate: e.target.value,
                                    }))
                                }
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                        </div>
                    </div>

                    {/* Automatically calculated days display */}
                    <div className="rounded-lg bg-muted/40 border border-border px-3.5 py-2.5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">
                                Number of Days
                            </p>
                            <p className="text-sm font-bold text-foreground mt-0.5">
                                {selectedDays > 0
                                    ? `${selectedDays} ${selectedDays === 1 ? 'day' : 'days'}`
                                    : '—'}
                            </p>
                        </div>
                        {selectedDays > 0 && (
                            <span className="text-xs font-medium text-accent">
                                Automatically calculated
                            </span>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                            Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={form.reason}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    reason: e.target.value,
                                }))
                            }
                            rows={3}
                            placeholder="Enter the reason for your leave..."
                            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowApplyModal(false)
                                resetForm()
                            }}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={() => void handleApplyLeave()}
                            disabled={saving}
                            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
                            style={{
                                backgroundColor: '#1C2B4A',
                                color: '#FAF8F5',
                            }}
                        >
                            {saving ? 'Submitting to Supabase...' : 'Submit Leave Request'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Rejection Reason Modal */}
            <Modal
                open={!!rejectingRequest}
                onClose={() => {
                    if (!saving) {
                        setRejectingRequest(null)
                        setRejectionReason('')
                        setRejectModalError('')
                    }
                }}
                title="Reject Leave Request"
            >
                {rejectingRequest && (
                    <div className="space-y-4">
                        {rejectModalError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                                <AlertCircle size={15} className="shrink-0 text-red-600" />
                                <span>{rejectModalError}</span>
                            </div>
                        )}

                        <div className="rounded-xl border border-border bg-muted/20 p-4">
                            <p className="text-sm font-semibold text-foreground">
                                {getEmployeeName(rejectingRequest, employees)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {rejectingRequest.leaveType} · {formatDate(rejectingRequest.startDate)} → {formatDate(rejectingRequest.endDate)} ({calculateLeaveDays(rejectingRequest.startDate, rejectingRequest.endDate)} days)
                            </p>
                            {rejectingRequest.reason && (
                                <p className="text-xs text-foreground mt-2 italic">
                                    "{rejectingRequest.reason}"
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                                Rejection Reason <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                rows={3}
                                placeholder="Explain why this request is being rejected so the employee is informed..."
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setRejectingRequest(null)
                                    setRejectionReason('')
                                    setRejectModalError('')
                                }}
                                disabled={saving}
                                className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={() => void handleConfirmReject()}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                            >
                                <X size={15} />
                                {saving ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}