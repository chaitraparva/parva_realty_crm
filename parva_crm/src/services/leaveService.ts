import { supabase } from '../lib/supabase'
import { getCurrentEmployee } from './chatService'
import type {
    LeaveRequest,
    LeaveType,
    LeaveStatus,
} from '../types'

interface CreateLeaveRequestInput {
    leaveType: LeaveType
    startDate: string
    endDate: string
    reason?: string
}

interface LeaveRow {
    id: string
    employee_id: string
    leave_type: LeaveType
    start_date: string
    end_date: string
    reason: string | null
    status: LeaveStatus
    reviewed_by: string | null
    reviewed_at: string | null
    reviewer_comment: string | null
    created_at: string
    updated_at: string
}

function throwIfError(
    error: { message?: string } | null
): void {
    if (error) {
        throw new Error(
            error.message || 'Leave request operation failed'
        )
    }
}

function mapLeaveRow(
    row: LeaveRow,
    employeeName?: string
): LeaveRequest {
    return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName,
        leaveType: row.leave_type,
        startDate: row.start_date,
        endDate: row.end_date,
        reason: row.reason || '',
        status: row.status,
        reviewedBy: row.reviewed_by || undefined,
        reviewedAt: row.reviewed_at || undefined,
        reviewerComment: row.reviewer_comment || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

/**
 * Load leave requests visible to the currently authenticated employee.
 *
 * RLS determines the actual scope:
 * - Agent → own requests
 * - Manager → own + team requests
 * - Admin → all requests
 */
export async function getLeaveRequests(): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
        .from('leave_requests')
        .select(`
      id,
      employee_id,
      leave_type,
      start_date,
      end_date,
      reason,
      status,
      reviewed_by,
      reviewed_at,
      reviewer_comment,
      created_at,
      updated_at,
      employee:employees!leave_requests_employee_id_fkey(name)
    `)
        .order('created_at', {
            ascending: false,
        })

    throwIfError(error)

    return ((data ?? []) as Array<
        LeaveRow & {
            employee?: { name?: string } | null
        }
    >).map((row) =>
        mapLeaveRow(
            row,
            row.employee?.name
        )
    )
}

/**
 * Load only the currently authenticated employee's requests.
 */
export async function getMyLeaveRequests(): Promise<LeaveRequest[]> {
    const employee = await getCurrentEmployee()

    const { data, error } = await supabase
        .from('leave_requests')
        .select(`
      id,
      employee_id,
      leave_type,
      start_date,
      end_date,
      reason,
      status,
      reviewed_by,
      reviewed_at,
      reviewer_comment,
      created_at,
      updated_at
    `)
        .eq('employee_id', employee.id)
        .order('created_at', {
            ascending: false,
        })

    throwIfError(error)

    return (data ?? []).map((row) =>
        mapLeaveRow(
            row as LeaveRow,
            employee.name
        )
    )
}

/**
 * Create a new leave request for the authenticated employee.
 */
export async function createLeaveRequest(
    input: CreateLeaveRequestInput
): Promise<LeaveRequest> {
    const employee = await getCurrentEmployee()

    if (!input.startDate || !input.endDate) {
        throw new Error(
            'Start date and end date are required'
        )
    }

    if (input.endDate < input.startDate) {
        throw new Error(
            'End date cannot be before start date'
        )
    }

    const { data, error } = await supabase
        .from('leave_requests')
        .insert({
            employee_id: employee.id,
            leave_type: input.leaveType,
            start_date: input.startDate,
            end_date: input.endDate,
            reason: input.reason?.trim() || null,
            status: 'Pending',
        })
        .select(`
      id,
      employee_id,
      leave_type,
      start_date,
      end_date,
      reason,
      status,
      reviewed_by,
      reviewed_at,
      reviewer_comment,
      created_at,
      updated_at
    `)
        .single()

    throwIfError(error)

    if (!data) {
        throw new Error(
            'Leave request was not created'
        )
    }

    return mapLeaveRow(
        data as LeaveRow,
        employee.name
    )
}

/**
 * Manager/Admin approves or rejects a leave request.
 *
 * RLS checks that the authenticated user has permission
 * to update this request.
 */
export async function reviewLeaveRequest(
    requestId: string,
    decision: 'Approved' | 'Rejected',
    reviewerComment = ''
): Promise<LeaveRequest> {
    const employee = await getCurrentEmployee()

    const { data, error } = await supabase
        .from('leave_requests')
        .update({
            status: decision,
            reviewed_by: employee.id,
            reviewed_at: new Date().toISOString(),
            reviewer_comment:
                reviewerComment.trim() || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select(`
      id,
      employee_id,
      leave_type,
      start_date,
      end_date,
      reason,
      status,
      reviewed_by,
      reviewed_at,
      reviewer_comment,
      created_at,
      updated_at,
      employee:employees!leave_requests_employee_id_fkey(name)
    `)
        .single()

    throwIfError(error)

    if (!data) {
        throw new Error(
            'Leave request could not be updated'
        )
    }

    const row = data as LeaveRow & {
        employee?: { name?: string } | null
    }

    return mapLeaveRow(
        row,
        row.employee?.name
    )
}

/**
 * Cancel a pending leave request belonging to the
 * currently authenticated employee.
 */
export async function cancelLeaveRequest(
    requestId: string
): Promise<LeaveRequest> {
    await getCurrentEmployee()

    const { data, error } = await supabase
        .from('leave_requests')
        .update({
            status: 'Cancelled',
            updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('status', 'Pending')
        .select(`
      id,
      employee_id,
      leave_type,
      start_date,
      end_date,
      reason,
      status,
      reviewed_by,
      reviewed_at,
      reviewer_comment,
      created_at,
      updated_at,
      employee:employees!leave_requests_employee_id_fkey(name)
    `)
        .single()

    throwIfError(error)

    if (!data) {
        throw new Error(
            'Leave request could not be cancelled'
        )
    }

    const row = data as LeaveRow & {
        employee?: { name?: string } | null
    }

    return mapLeaveRow(
        row,
        row.employee?.name
    )
}

/**
 * Calculate the number of calendar days in a leave period.
 */
export function calculateLeaveDays(
    startDate: string,
    endDate: string
): number {
    const start = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T00:00:00`)

    const difference =
        end.getTime() - start.getTime()

    if (difference < 0) {
        return 0
    }

    return Math.floor(
        difference / (1000 * 60 * 60 * 24)
    ) + 1
}