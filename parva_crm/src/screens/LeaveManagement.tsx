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
} from 'lucide-react'

import Modal from '../components/ui/Modal'
import { useData } from '../contexts/DataContext'
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
        className: 'bg-amber-50 text-amber-700',
    },
    Approved: {
        label: 'Approved',
        className: 'bg-emerald-50 text-emerald-700',
    },
    Rejected: {
        label: 'Rejected',
        className: 'bg-red-50 text-red-700',
    },
    Cancelled: {
        label: 'Cancelled',
        className: 'bg-gray-100 text-gray-600',
    },
}

function formatDate(date: string) {
    if (!date) return '—'

    return new Date(`${date}T00:00:00`).toLocaleDateString(
        'en-IN',
        {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }
    )
}

function getEmployeeName(
    request: LeaveRequest,
    employees: Array<{ id: string; name: string }>
) {
    if (request.employeeName) {
        return request.employeeName
    }

    return (
        employees.find(
            (employee) => employee.id === request.employeeId
        )?.name || 'Employee'
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

    const [showApplyModal, setShowApplyModal] =
        useState(false)

    const [reviewingRequest, setReviewingRequest] =
        useState<LeaveRequest | null>(null)

    const [reviewComment, setReviewComment] =
        useState('')

    const [activeTab, setActiveTab] = useState<
        'requests' | 'pending'
    >('requests')

    const [form, setForm] = useState({
        leaveType: 'Casual Leave' as LeaveType,
        startDate: '',
        endDate: '',
        reason: '',
    })

    const loadRequests = async () => {
        setLoading(true)
        setError('')

        try {
            const data = await getLeaveRequests()
            setRequests(data)
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not load leave requests.'
            )
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadRequests()
    }, [])

    const employeeRequests = useMemo(() => {
        if (role !== 'agent') {
            return requests
        }

        return requests.filter(
            (request) =>
                request.employeeId === currentUserId
        )
    }, [requests, role, currentUserId])

    const pendingRequests = useMemo(() => {
        return requests.filter(
            (request) => request.status === 'Pending'
        )
    }, [requests])

    const displayedRequests =
        role === 'agent'
            ? employeeRequests
            : activeTab === 'pending'
                ? pendingRequests
                : requests

    const pendingCount = pendingRequests.length

    const selectedDays =
        form.startDate && form.endDate
            ? calculateLeaveDays(
                form.startDate,
                form.endDate
            )
            : 0

    const resetForm = () => {
        setForm({
            leaveType: 'Casual Leave',
            startDate: '',
            endDate: '',
            reason: '',
        })
    }

    const handleApplyLeave = async () => {
        setError('')
        setSuccess('')

        if (!form.startDate || !form.endDate) {
            setError(
                'Please select both start date and end date.'
            )
            return
        }

        if (form.endDate < form.startDate) {
            setError(
                'End date cannot be before start date.'
            )
            return
        }

        if (selectedDays <= 0) {
            setError('Please select a valid leave period.')
            return
        }

        setSaving(true)

        try {
            await createLeaveRequest({
                leaveType: form.leaveType,
                startDate: form.startDate,
                endDate: form.endDate,
                reason: form.reason,
            })

            setShowApplyModal(false)
            resetForm()

            await loadRequests()

            setSuccess(
                'Leave request submitted successfully.'
            )

            window.setTimeout(() => {
                setSuccess('')
            }, 3000)
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not submit leave request.'
            )
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = async (
        requestId: string
    ) => {
        setError('')
        setSuccess('')
        setSaving(true)

        try {
            await cancelLeaveRequest(requestId)

            await loadRequests()

            setSuccess(
                'Leave request cancelled successfully.'
            )

            window.setTimeout(() => {
                setSuccess('')
            }, 3000)
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not cancel leave request.'
            )
        } finally {
            setSaving(false)
        }
    }

    const handleReview = async (
        decision: 'Approved' | 'Rejected'
    ) => {
        if (!reviewingRequest) return

        setError('')
        setSuccess('')
        setSaving(true)

        try {
            await reviewLeaveRequest(
                reviewingRequest.id,
                decision,
                reviewComment
            )

            setReviewingRequest(null)
            setReviewComment('')

            await loadRequests()

            setSuccess(
                decision === 'Approved'
                    ? 'Leave request approved.'
                    : 'Leave request rejected.'
            )

            window.setTimeout(() => {
                setSuccess('')
            }, 3000)
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not update leave request.'
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
                    <h2 className="font-serif text-lg font-semibold text-foreground">
                        Leave Management
                    </h2>

                    <p className="text-xs text-muted-foreground mt-1">
                        {role === 'agent'
                            ? 'Apply for leave and track your requests'
                            : role === 'manager'
                                ? 'Review your team’s leave requests'
                                : 'Manage leave requests across the organization'}
                    </p>
                </div>

                {role === 'agent' && (
                    <button
                        onClick={() => {
                            setError('')
                            setSuccess('')
                            setShowApplyModal(true)
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                            backgroundColor: '#C9A96E',
                            color: '#1C2B4A',
                        }}
                    >
                        <Plus size={16} />
                        Apply for Leave
                    </button>
                )}
            </div>

            {/* Messages */}
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                </div>
            )}

            {/* Manager/Admin tabs */}
            {role !== 'agent' && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-1.5 flex gap-1">
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'requests'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        All Requests
                    </button>

                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'pending'
                                ? 'bg-background shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Pending
                        {pendingCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                {pendingCount}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{
                                backgroundColor:
                                    'rgba(201,169,110,0.12)',
                            }}
                        >
                            <FileText size={17} className="text-accent" />
                        </div>

                        <div>
                            <p className="text-xs text-muted-foreground">
                                Total Requests
                            </p>

                            <p className="text-xl font-semibold text-foreground mt-0.5">
                                {role === 'agent'
                                    ? employeeRequests.length
                                    : requests.length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{
                                backgroundColor:
                                    'rgba(245,158,11,0.10)',
                            }}
                        >
                            <Clock3
                                size={17}
                                className="text-amber-600"
                            />
                        </div>

                        <div>
                            <p className="text-xs text-muted-foreground">
                                Pending
                            </p>

                            <p className="text-xl font-semibold text-foreground mt-0.5">
                                {role === 'agent'
                                    ? employeeRequests.filter(
                                        (request) =>
                                            request.status === 'Pending'
                                    ).length
                                    : pendingCount}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{
                                backgroundColor:
                                    'rgba(16,185,129,0.10)',
                            }}
                        >
                            <Check
                                size={17}
                                className="text-emerald-600"
                            />
                        </div>

                        <div>
                            <p className="text-xs text-muted-foreground">
                                Approved
                            </p>

                            <p className="text-xl font-semibold text-foreground mt-0.5">
                                {role === 'agent'
                                    ? employeeRequests.filter(
                                        (request) =>
                                            request.status === 'Approved'
                                    ).length
                                    : requests.filter(
                                        (request) =>
                                            request.status === 'Approved'
                                    ).length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Request list */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div>
                        <h3 className="font-serif text-base font-semibold text-foreground">
                            {role === 'agent'
                                ? 'My Leave Requests'
                                : activeTab === 'pending'
                                    ? 'Pending Leave Requests'
                                    : 'Leave Requests'}
                        </h3>

                        <p className="text-xs text-muted-foreground mt-0.5">
                            {displayedRequests.length} request
                            {displayedRequests.length !== 1
                                ? 's'
                                : ''}
                        </p>
                    </div>

                    <button
                        onClick={() => void loadRequests()}
                        disabled={loading}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        title="Refresh"
                    >
                        <RefreshCw
                            size={16}
                            className={
                                loading ? 'animate-spin' : ''
                            }
                        />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <RefreshCw
                            size={22}
                            className="mx-auto text-muted-foreground animate-spin"
                        />

                        <p className="text-sm text-muted-foreground mt-3">
                            Loading leave requests...
                        </p>
                    </div>
                ) : displayedRequests.length === 0 ? (
                    <div className="p-12 text-center">
                        <CalendarDays
                            size={30}
                            className="mx-auto text-muted-foreground opacity-40"
                        />

                        <p className="text-sm font-medium text-foreground mt-3">
                            No leave requests
                        </p>

                        <p className="text-xs text-muted-foreground mt-1">
                            {role === 'agent'
                                ? 'Your submitted leave requests will appear here.'
                                : 'There are no requests in this view.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {displayedRequests.map((request) => {
                            const employeeName =
                                getEmployeeName(request, employees)

                            const days = calculateLeaveDays(
                                request.startDate,
                                request.endDate
                            )

                            const status =
                                statusConfig[request.status]

                            const canCancel =
                                role === 'agent' &&
                                request.employeeId ===
                                currentUserId &&
                                request.status === 'Pending'

                            const canReview =
                                role !== 'agent' &&
                                request.status === 'Pending' &&
                                request.employeeId !== currentUserId

                            return (
                                <div
                                    key={request.id}
                                    className="p-5 hover:bg-muted/20 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                        <div className="flex items-start gap-4 min-w-0">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                                style={{
                                                    backgroundColor:
                                                        'rgba(201,169,110,0.12)',
                                                }}
                                            >
                                                <CalendarDays
                                                    size={18}
                                                    className="text-accent"
                                                />
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {request.leaveType}
                                                    </p>

                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.className}`}
                                                    >
                                                        {status.label}
                                                    </span>
                                                </div>

                                                {role !== 'agent' && (
                                                    <p className="text-xs font-medium text-foreground mt-1">
                                                        {employeeName}
                                                    </p>
                                                )}

                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDate(request.startDate)}
                                                    {' → '}
                                                    {formatDate(request.endDate)}
                                                    {' · '}
                                                    {days} day
                                                    {days !== 1 ? 's' : ''}
                                                </p>

                                                {request.reason && (
                                                    <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
                                                        {request.reason}
                                                    </p>
                                                )}

                                                {request.reviewerComment && (
                                                    <div className="mt-2 rounded-lg bg-muted/30 px-3 py-2">
                                                        <p className="text-[11px] font-semibold text-foreground">
                                                            Review comment
                                                        </p>

                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {request.reviewerComment}
                                                        </p>
                                                    </div>
                                                )}

                                                <p className="text-[10px] text-muted-foreground mt-2">
                                                    Applied{' '}
                                                    {new Date(
                                                        request.createdAt
                                                    ).toLocaleDateString(
                                                        'en-IN',
                                                        {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        }
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {canReview && (
                                                <button
                                                    onClick={() => {
                                                        setReviewingRequest(request)
                                                        setReviewComment('')
                                                        setError('')
                                                    }}
                                                    className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                                >
                                                    Review
                                                </button>
                                            )}

                                            {canCancel && (
                                                <button
                                                    onClick={() =>
                                                        void handleCancel(
                                                            request.id
                                                        )
                                                    }
                                                    disabled={saving}
                                                    className="px-3 py-2 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                                >
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

            {/* Apply Leave Modal */}
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
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                            Leave Type
                        </label>

                        <select
                            value={form.leaveType}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    leaveType:
                                        e.target.value as LeaveType,
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
                                Start Date
                            </label>

                            <input
                                type="date"
                                value={form.startDate}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        startDate:
                                            e.target.value,
                                    }))
                                }
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                                End Date
                            </label>

                            <input
                                type="date"
                                value={form.endDate}
                                min={form.startDate || undefined}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        endDate:
                                            e.target.value,
                                    }))
                                }
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                        </div>
                    </div>

                    {selectedDays > 0 && (
                        <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                            <p className="text-sm font-semibold text-foreground">
                                {selectedDays} day
                                {selectedDays !== 1 ? 's' : ''}
                            </p>

                            <p className="text-xs text-muted-foreground mt-0.5">
                                Leave duration
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                            Reason
                        </label>

                        <textarea
                            value={form.reason}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    reason: e.target.value,
                                }))
                            }
                            rows={4}
                            placeholder="Enter the reason for your leave..."
                            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
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
                            onClick={() => void handleApplyLeave()}
                            disabled={saving}
                            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                            style={{
                                backgroundColor: '#1C2B4A',
                                color: '#FAF8F5',
                            }}
                        >
                            {saving
                                ? 'Submitting...'
                                : 'Submit Request'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Review Modal */}
            <Modal
                open={!!reviewingRequest}
                onClose={() => {
                    if (!saving) {
                        setReviewingRequest(null)
                        setReviewComment('')
                    }
                }}
                title="Review Leave Request"
            >
                {reviewingRequest && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-border p-4">
                            <p className="text-sm font-semibold text-foreground">
                                {getEmployeeName(
                                    reviewingRequest,
                                    employees
                                )}
                            </p>

                            <p className="text-xs text-muted-foreground mt-1">
                                {reviewingRequest.leaveType}
                            </p>

                            <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(
                                    reviewingRequest.startDate
                                )}
                                {' → '}
                                {formatDate(
                                    reviewingRequest.endDate
                                )}
                                {' · '}
                                {calculateLeaveDays(
                                    reviewingRequest.startDate,
                                    reviewingRequest.endDate
                                )}{' '}
                                days
                            </p>

                            {reviewingRequest.reason && (
                                <p className="text-xs text-muted-foreground mt-3">
                                    {reviewingRequest.reason}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                                Comment
                            </label>

                            <textarea
                                value={reviewComment}
                                onChange={(e) =>
                                    setReviewComment(e.target.value)
                                }
                                rows={3}
                                placeholder="Optional review comment..."
                                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() =>
                                    void handleReview('Rejected')
                                }
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                <X size={15} />
                                Reject
                            </button>

                            <button
                                onClick={() =>
                                    void handleReview('Approved')
                                }
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                                style={{
                                    backgroundColor: '#1C2B4A',
                                    color: '#FAF8F5',
                                }}
                            >
                                <Check size={15} />
                                Approve
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}