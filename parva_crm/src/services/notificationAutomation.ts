import type { Notification } from '../types'
import type { EmployeeSettings } from './employeeSettings'

interface LeadForNotification {
    id: string
    name: string
    assignedTo?: string
    lastActivity?: string
    createdAt?: string
    status?: string
    office?: string
}

/**
 * Finds leads assigned to the given employee that have been inactive
 * longer than the employee's saved follow-up threshold.
 */
export function getMissedFollowUpNotifications(
    leads: LeadForNotification[],
    employeeId: string,
    settings: EmployeeSettings
): Array<Omit<Notification, 'id' | 'timestamp' | 'read'>> {
    if (!settings.notifMissedFollowup) {
        return []
    }

    const thresholdMs = settings.followUpHours * 60 * 60 * 1000
    const now = Date.now()

    return leads
        .filter((lead) => {
            if (lead.assignedTo !== employeeId) {
                return false
            }

            if (lead.status === 'Cancelled') {
                return false
            }

            // Use last activity when available. For leads with no recorded
            // activity yet, use the lead creation time as the starting point.
            const activityDate = lead.lastActivity || lead.createdAt

            if (!activityDate) {
                return false
            }

            const activityTime = new Date(activityDate).getTime()

            if (Number.isNaN(activityTime)) {
                return false
            }

            return now - activityTime >= thresholdMs
        })
        .map((lead) => ({
            type: 'missed-followup',
            title: 'Missed Follow-up Alert',
            message: `${lead.name} has had no activity for more than ${settings.followUpHours} hours.`,
            priority: 'high',
            recipientId: employeeId,
            link: `lead-detail:${lead.id}`,
        }))
}

/**
 * Finds unassigned leads that have remained unassigned longer than the
 * current manager/admin employee's saved threshold.
 */
export function getUnassignedLeadNotifications(
    leads: LeadForNotification[],
    currentEmployeeId: string,
    currentEmployeeOffice: string | undefined,
    role: 'agent' | 'manager' | 'admin',
    settings: EmployeeSettings
): Array<Omit<Notification, 'id' | 'timestamp' | 'read'>> {
    if (!settings.notifUnassigned || (role !== 'manager' && role !== 'admin')) {
        return []
    }

    const thresholdMs =
        settings.unassignedAlertHours * 60 * 60 * 1000

    const now = Date.now()

    return leads
        .filter((lead) => {
            if (lead.assignedTo) {
                return false
            }

            if (lead.status === 'Cancelled') {
                return false
            }

            // Managers receive alerts for their own office.
            // Admins receive alerts for all offices.
            if (
                role === 'manager' &&
                currentEmployeeOffice &&
                lead.office &&
                lead.office !== currentEmployeeOffice
            ) {
                return false
            }

            const createdDate = lead.createdAt

            if (!createdDate) {
                return false
            }

            const createdTime = new Date(createdDate).getTime()

            if (Number.isNaN(createdTime)) {
                return false
            }

            return now - createdTime >= thresholdMs
        })
        .map((lead) => ({
            type: 'unassigned-lead',
            title: 'Unassigned Lead Alert',
            message: `${lead.name} has remained unassigned for more than ${settings.unassignedAlertHours} hours.`,
            priority: 'high',
            recipientId: currentEmployeeId,
            link: `lead-detail:${lead.id}`,
        }))
}
