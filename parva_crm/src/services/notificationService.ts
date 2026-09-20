import { supabase } from '../lib/supabase'
import type { Notification } from '../types'

function formatDate(dateStr: string): string {
    if (!dateStr) return ''
    try {
        const d = new Date(dateStr)
        if (Number.isNaN(d.getTime())) return dateStr
        return d.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })
    } catch {
        return dateStr
    }
}

export interface SendLeaveRequestNotificationParams {
    employeeName: string
    startDate: string
    endDate: string
    requestId?: string
}

export interface SendLeaveReviewNotificationParams {
    recipientEmployeeId: string
    status: 'Approved' | 'Rejected'
    startDate: string
    endDate: string
    reviewerComment?: string
}

/**
 * Sends a notification to all Super Admin accounts (Chaitra)
 * when an employee or sales manager submits a leave request.
 */
export async function sendLeaveRequestNotification(
    params: SendLeaveRequestNotificationParams
): Promise<void> {
    try {
        // Dynamically find Super Admin employee(s)
        const { data: admins, error: adminErr } = await supabase
            .from('employees')
            .select('id, name, email')
            .eq('role', 'admin')

        if (adminErr) {
            console.error('Failed to resolve Super Admin for leave notification:', adminErr.message)
            return
        }

        if (!admins || admins.length === 0) {
            console.warn('No Super Admin found to receive leave request notification.')
            return
        }

        const startFormatted = formatDate(params.startDate)
        const endFormatted = formatDate(params.endDate)

        const title = 'New Leave Request'
        const message = `${params.employeeName} has submitted a leave request from ${startFormatted} to ${endFormatted}.`
        const link = 'leave-management'

        const notificationsToInsert = admins.map((admin) => ({
            id: crypto.randomUUID(),
            employee_id: admin.id,
            type: 'leave-request',
            title,
            message,
            is_read: false,
            link,
        }))

        const { error } = await supabase
            .from('notifications')
            .insert(notificationsToInsert)

        if (error) {
            console.error('Failed to create leave request notification for admin:', error.message)
        }
    } catch (err) {
        console.error('Unexpected error sending leave request notification:', err)
    }
}

/**
 * Sends a notification to the employee when their leave request
 * has been approved or rejected by Super Admin.
 */
export async function sendLeaveReviewNotification(
    params: SendLeaveReviewNotificationParams
): Promise<void> {
    try {
        const startFormatted = formatDate(params.startDate)
        const endFormatted = formatDate(params.endDate)

        let title: string
        let message: string

        if (params.status === 'Approved') {
            title = 'Leave Request Approved'
            message = `Your leave request from ${startFormatted} to ${endFormatted} has been approved.`
        } else {
            title = 'Leave Request Rejected'
            message = params.reviewerComment?.trim()
                ? `Your leave request from ${startFormatted} to ${endFormatted} has been rejected. Reason: ${params.reviewerComment.trim()}`
                : `Your leave request from ${startFormatted} to ${endFormatted} has been rejected.`
        }

        const { error } = await supabase.from('notifications').insert({
            id: crypto.randomUUID(),
            employee_id: params.recipientEmployeeId,
            type: 'leave-request',
            title,
            message,
            is_read: false,
            link: 'leave-management',
        })

        if (error) {
            console.error('Failed to create leave review notification for employee:', error.message)
        }
    } catch (err) {
        console.error('Unexpected error sending leave review notification:', err)
    }
}

/**
 * Fetch all notifications for a given employee from Supabase.
 */
export async function fetchUserNotifications(
    employeeId: string
): Promise<Notification[]> {
    const { data, error } = await supabase
        .from('notifications')
        .select(`
      id,
      employee_id,
      type,
      title,
      message,
      is_read,
      link,
      created_at
    `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Failed to load notifications:', error.message)
        return []
    }

    return (data ?? []).map((row: any) => ({
        id: row.id,
        recipientId: row.employee_id,
        type: row.type as Notification['type'],
        title: row.title,
        message: row.message,
        timestamp: row.created_at,
        read: Boolean(row.is_read),
        priority: 'medium',
        link: row.link ?? undefined,
    }))
}

/**
 * Mark a single notification as read in Supabase.
 */
export async function markNotificationAsRead(
    notificationId: string,
    employeeId: string
): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('employee_id', employeeId)

    if (error) {
        console.error('Failed to mark notification as read in Supabase:', error.message)
    }
}

/**
 * Mark all notifications as read for an employee in Supabase.
 */
export async function markAllNotificationsAsRead(
    employeeId: string
): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('employee_id', employeeId)
        .eq('is_read', false)

    if (error) {
        console.error('Failed to mark all notifications as read in Supabase:', error.message)
    }
}
