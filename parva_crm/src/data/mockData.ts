/**
 * DEPRECATED — PHASE 7 AUDIT COMPLETE
 * All application modules and screens now fetch real live records directly from Supabase
 * and DataContext.
 *
 * No screens or components depend on mock/static data.
 */

import type {
  Employee,
  Lead,
  PayrollRecord,
  AttendanceRecord,
  LeaveRequest,
  Flag,
  Notification,
  Activity,
  Message,
  Project,
  Unit,
  SiteVisit,
  CallLog,
  InternalEmail,
  Group,
  GroupMessage,
  AuditEntry,
  EscalationRequest,
  CalendarEvent,
} from '../types'

export const employees: Employee[] = []
export const leads: Lead[] = []
export const payrollRecords: PayrollRecord[] = []
export const attendanceRecords: AttendanceRecord[] = []
export const leaveRequests: LeaveRequest[] = []
export const flags: Flag[] = []
export const notifications: Notification[] = []
export const activities: Activity[] = []
export const messages: Message[] = []
export const projects: Project[] = []
export const units: Unit[] = []
export const siteVisits: SiteVisit[] = []
export const callLogs: CallLog[] = []
export const internalEmails: InternalEmail[] = []
export const groups: Group[] = []
export const groupMessages: GroupMessage[] = []
export const auditLog: AuditEntry[] = []
export const escalationRequests: EscalationRequest[] = []
export const calendarEvents: CalendarEvent[] = []
