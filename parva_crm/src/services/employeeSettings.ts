import { supabase } from '../lib/supabase'

export interface EmployeeSettings {
    employeeId: string
    darkMode: boolean
    roundRobin: boolean
    autoAssign: boolean
    followUpHours: number
    unassignedAlertHours: number
    notifMissedFollowup: boolean
    notifUnassigned: boolean
    notifPayroll: boolean
    notifLeave: boolean
}

const DEFAULTS = {
    roundRobin: true,
    autoAssign: true,
    followUpHours: 24,
    unassignedAlertHours: 4,
    notifMissedFollowup: true,
    notifUnassigned: true,
    notifPayroll: true,
    notifLeave: true,
}

async function resolveCurrentEmployeeId(): Promise<string> {
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
        throw authError
    }

    if (!user) {
        throw new Error('No authenticated user found.')
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('employee_id')
        .eq('id', user.id)
        .maybeSingle()

    if (profileError) {
        throw profileError
    }

    if (profile?.employee_id) {
        return profile.employee_id
    }

    if (user.email) {
        const { data: employee, error: employeeError } = await supabase
            .from('employees')
            .select('id')
            .eq('email', user.email)
            .maybeSingle()

        if (employeeError) {
            throw employeeError
        }

        if (employee?.id) {
            return employee.id
        }
    }

    throw new Error(
        'Could not resolve the employee for the authenticated account.'
    )
}

export async function getEmployeeSettings(
    employeeId?: string
): Promise<EmployeeSettings> {
    const resolvedEmployeeId =
        employeeId || (await resolveCurrentEmployeeId())

    const { data, error } = await supabase
        .from('employee_settings')
        .select(`
      employee_id,
      dark_mode,
      round_robin,
      auto_assign,
      follow_up_hours,
      unassigned_alert_hours,
      notif_missed_followup,
      notif_unassigned,
      notif_payroll,
      notif_leave
    `)
        .eq('employee_id', resolvedEmployeeId)
        .maybeSingle()

    if (error) {
        throw error
    }

    if (!data) {
        return {
            employeeId: resolvedEmployeeId,
            darkMode: false,
            roundRobin: DEFAULTS.roundRobin,
            autoAssign: DEFAULTS.autoAssign,
            followUpHours: DEFAULTS.followUpHours,
            unassignedAlertHours: DEFAULTS.unassignedAlertHours,
            notifMissedFollowup: DEFAULTS.notifMissedFollowup,
            notifUnassigned: DEFAULTS.notifUnassigned,
            notifPayroll: DEFAULTS.notifPayroll,
            notifLeave: DEFAULTS.notifLeave,
        }
    }

    return {
        employeeId: data.employee_id,
        darkMode: Boolean(data.dark_mode),
        roundRobin: Boolean(data.round_robin),
        autoAssign: Boolean(data.auto_assign),
        followUpHours: Number(data.follow_up_hours),
        unassignedAlertHours: Number(data.unassigned_alert_hours),
        notifMissedFollowup: Boolean(data.notif_missed_followup),
        notifUnassigned: Boolean(data.notif_unassigned),
        notifPayroll: Boolean(data.notif_payroll),
        notifLeave: Boolean(data.notif_leave),
    }
}

export async function getCurrentEmployeeSettings(): Promise<EmployeeSettings> {
    return getEmployeeSettings()
}