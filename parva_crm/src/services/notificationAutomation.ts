import type { Notification } from '../types'
import type { EmployeeSettings } from './employeeSettings'

interface LeadForNotification {
    id: string
    name: string
    assignedTo?: string
    lastActivity?: string
    createdAt?: string
    status?: string
}

export function getMissedFollowUpNotifications(
    leads: LeadForNotification[],
    employeeId: string,
    settings: EmployeeSettings
): Array<Omit<Notification, 'id' | 'timestamp' | 'read'>> {
    if (!settings.notifMissedFollowup) {
        return []
    }

    const thresholdMs =
        settings.followUpHours * 60 * 60 * 1000

    const now = Date.now()

    return leads
        .filter((lead) => {
            if (lead.assignedTo !== employeeId) {
                return false
            }

            if (lead.status === 'Cancelled') {
                return false
            }

            // Use last activity when available.
            // For a brand-new lead with no activity yet,
            // fall back to its creation time.
            const activityDate =
                lead.lastActivity || lead.createdAt

            if (!activityDate) {
                return false
            }

            const activityTime =
                new Date(activityDate).getTime()

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