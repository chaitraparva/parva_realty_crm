export type Role = 'agent' | 'manager' | 'admin'
export type Office = 'Bangalore' | 'Dubai'
export type LeadSource = 'Housing.com' | 'Social Media' | 'Referral' | 'Walk-in'
export type LeadStatus =
  | 'Lead Generation'
  | 'Initial Approach'
  | 'Qualified Lead'
  | 'Consultative Approach'
  | 'Client Onboarding'
  | 'Property Highlights'
  | 'Property Recommendation'
  | 'Property Finalization'
  | 'Dubai Paperwork Overview'
  | 'Investment Terms & Structure'
  | 'Documentation & Deal Finalization'
  | 'Cancelled'
export type ActivityType =
  | 'call'
  | 'email'
  | 'note'
  | 'site-visit'
  | 'whatsapp'
  | 'transfer'
  | 'escalation'
  | 'ai-assignment'

export type WorkloadStatus = 'available' | 'normal' | 'high' | 'overloaded'

export interface Activity {
  id: string
  type: ActivityType
  description: string
  timestamp: string
  by: string
}

export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  source: LeadSource
  status: LeadStatus
  assignedTo: string
  agentName: string
  budget: string
  propertyType: 'Apartment' | 'Villa' | 'Plot'
  location: string
  office: Office
  createdAt: string
  lastActivity: string
  activities: Activity[]
  followUpDate?: string
  notes?: string
  shortlistedUnitIds?: string[]
  cancellationReason?: string
  previousStatus?: LeadStatus
  transferredFrom?: string
  transferredFromName?: string
  transferredAt?: string
  escalatedAt?: string
  escalationReason?: string
  escalationStatus?: 'pending' | 'reviewed' | 'reassigned'
  escalationComment?: string
  aiAssigned?: boolean
}

export interface EscalationRequest {
  id: string
  leadId: string
  leadName: string
  requesterId: string
  requesterName: string
  reason: string
  requestedAt: string
  status: 'pending' | 'reviewed' | 'reassigned' | 'rejected'
  adminComment?: string
  resolvedAt?: string
  resolvedBy?: string
}

// Formal lead-approval workflow (CRM Executive → Sales Manager → Super Admin),
// backed by the real `approvals` table via /api/approvals.
export interface Approval {
  id: string
  leadId: string
  leadName: string | null
  submittedBy: string
  submittedByName: string | null
  stage: 'pending_manager' | 'pending_admin' | 'approved' | 'rejected'
  assignedApprover: string | null
  assignedApproverName: string | null
  comments: string | null
  submittedAt: string
  reviewedAt: string | null
  approvedBy: string | null
  rejectedBy: string | null
  rejectionReason: string | null
  escalatedTo: string | null
  escalatedAt: string | null
}

export interface Project {
  id: string
  name: string
  developer: string
  location: string
  reraNumber: string
  reraStatus: 'Registered' | 'Pending' | 'Expired'
  possessionDate: string
  totalUnits: number
  zone?: string
  propertyType?: string
  unitTypes?: string
  tier?: string
  tagLabel?: string
  priceINR?: string
  priceAED?: string
  rentalYield?: number
  appreciation?: number
  minDeposit?: string
  areaRange?: string
  completionQ?: string
  floors?: number
  bedrooms?: number
  handoverQ?: string
  views?: number
  standout?: string
  fullDescription?: string
  amenities?: string[]
  paymentPlan?: { label: string; pct: string }[]
}

export interface Unit {
  id: string
  projectId: string
  unitNumber: string
  bhk: string
  floor: string
  areaSqft: number
  price: number
  facing: string
  status: 'Available' | 'Held' | 'Sold'
  photos?: string[]
}

export interface Group {
  id: string
  name: string
  memberIds: string[]
  createdBy: string
  createdAt: string
}

export interface GroupMessage {
  id: string
  groupId: string
  senderId: string
  text: string
  timestamp: string
  readBy: string[]
  attachmentName?: string
  attachmentUrl?: string
}

export interface CallLog {
  id: string
  callerId: string
  calleeId?: string
  groupId?: string
  participantIds?: string[]
  timestamp: string
  durationSec: number
  status: 'Completed' | 'Missed' | 'Declined'
  type: 'voice' | 'video'
}

export interface InternalEmail {
  id: string
  senderId: string
  recipientId?: string
  groupId?: string
  recipientIds?: string[]
  subject: string
  body: string
  timestamp: string
  read: boolean
  attachmentName?: string
  attachmentUrl?: string
}

export interface SiteVisit {
  id: string
  leadId: string
  leadName: string
  projectName: string
  agentId?: string
  agentName?: string
  assignedManagerId?: string
  assignedManagerName?: string
  date: string
  time: string
  status: 'Pending Assignment' | 'Scheduled' | 'Completed' | 'Cancelled' | 'No-show'
  outcome?: string
}

export interface Employee {
  id: string
  name: string
  role: Role
  email: string
  phone: string
  team: string
  office: Office
  managerId?: string
  joinDate: string
  status: 'active' | 'on-leave' | 'inactive'
  department: string
  leadsAssigned: number
  conversions: number
  baseSalary: number
  responseTime: string
  capacityLimit: number
  employeeId?: string
}

export interface PayrollRecord {
  id: string
  employeeId: string
  employeeName: string
  role: Role
  month: string
  baseSalary: number
  incentives: number
  deductions: number
  netPay: number
  status: 'pending-manager' | 'pending-admin' | 'disbursed'
  managerApproved: boolean
  adminApproved: boolean
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  date: string
  checkIn: string
  checkOut: string
  status: 'present' | 'absent' | 'late' | 'half-day'
}

export type LeaveType =
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Annual Leave'
  | 'Emergency Leave'
  | 'Other'

export type LeaveStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName?: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  reason?: string
  status: LeaveStatus
  reviewedBy?: string
  reviewedAt?: string
  reviewerComment?: string
  createdAt: string
  updatedAt: string
}

export interface Flag {
  id: string
  employeeId: string
  employeeName: string
  type: 'Warning' | 'Performance' | 'Attendance' | 'Conduct' | 'Self-Reported'
  description: string
  severity: 'Low' | 'Medium' | 'High'
  issuedBy: string
  date: string
  status: 'Open' | 'Acknowledged' | 'Resolved'
}

export interface Message {
  id: string
  senderId: string
  recipientId: string
  text: string
  timestamp: string
  read: boolean
  attachmentName?: string
  attachmentUrl?: string
}

export interface Notification {
  id: string
  type:
  | 'missed-followup'
  | 'unassigned-lead'
  | 'pending-payroll'
  | 'leave-request'
  | 'flag'
  | 'lead-cancelled'
  | 'site-visit'
  | 'lead-transfer'
  | 'escalation'
  | 'ai-assignment'
  | 'approval'
  title: string
  message: string
  timestamp: string
  read: boolean
  priority: 'high' | 'medium' | 'low'
  forUserId?: string
}

export interface AuditEntry {
  id: string
  timestamp: string
  actorName: string
  action: string
  details: string
  previousValue?: string
  newValue?: string
  reason?: string
}

export interface CalendarEvent {
  id: string
  ownerId: string
  title: string
  start: string
  end: string
  type: 'call' | 'meeting' | 'review' | 'personal' | 'blocked'
  isPublic: boolean
}

export interface NavAction {
  screen: string
  params?: Record<string, string>
}
