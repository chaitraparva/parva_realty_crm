import { Users, TrendingUp, LayoutDashboard, GitBranch, PieChart, Flag, CreditCard, Network, FileText, Bell, Settings, LogOut, Target, X, MessageCircle, Building2, CalendarClock, ClipboardList, BarChart2, AlertCircle, Calendar, ClipboardCheck } from 'lucide-react'
import LogoMark from '../ui/LogoMark'
import type { Role } from '../../types'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  section?: string
}

const navByRole: Record<Role, NavItem[]> = {
  agent: [
    { id: 'my-leads', label: 'Leads', icon: <Target size={18} />, section: 'Leads' },
    { id: 'approvals', label: 'My Approvals', icon: <ClipboardCheck size={18} />, section: 'Leads' },
    { id: 'site-visits', label: 'Site Visits', icon: <CalendarClock size={18} />, section: 'Leads' },
    { id: 'inventory', label: 'Property Inventory', icon: <Building2 size={18} />, section: 'Leads' },
    { id: 'org-chart', label: 'Org & People', icon: <Network size={18} />, section: 'Organisation' },
    { id: 'performance', label: 'My Performance', icon: <TrendingUp size={18} />, section: 'Analytics' },
  ],
  manager: [
    { id: 'my-leads', label: 'Leads', icon: <Target size={18} />, section: 'Pipeline' },
    { id: 'performance', label: 'My Performance', icon: <TrendingUp size={18} />, section: 'Pipeline' },
    { id: 'approvals', label: 'Approvals', icon: <ClipboardCheck size={18} />, section: 'Pipeline' },
    { id: 'team-overview', label: 'Team Overview', icon: <Users size={18} />, section: 'Team' },
    { id: 'pipeline', label: 'Lead Pipeline', icon: <GitBranch size={18} />, section: 'Team' },
    { id: 'source-performance', label: 'Source Performance', icon: <PieChart size={18} />, section: 'Team' },
    { id: 'workload', label: 'AI Lead Distribution', icon: <BarChart2 size={18} />, section: 'Team' },
    { id: 'site-visits', label: 'Site Visits', icon: <CalendarClock size={18} />, section: 'Operations' },
    { id: 'inventory', label: 'Property Inventory', icon: <Building2 size={18} />, section: 'Operations' },
    { id: 'org-chart', label: 'Org & People', icon: <Network size={18} />, section: 'Organisation' },
    { id: 'flags', label: 'Flags & Warnings', icon: <Flag size={18} />, section: 'Compliance' },
  ],
  admin: [
    { id: 'admin-dashboard', label: 'Company Dashboard', icon: <LayoutDashboard size={18} />, section: 'Overview' },
    { id: 'my-leads', label: 'Leads', icon: <Target size={18} />, section: 'Overview' },
    { id: 'workload', label: 'Workload & AI Assignment', icon: <BarChart2 size={18} />, section: 'Overview' },
    { id: 'approvals', label: 'Approvals', icon: <ClipboardCheck size={18} />, section: 'Overview' },
    { id: 'escalations', label: 'Escalations', icon: <AlertCircle size={18} />, section: 'Overview' },
    { id: 'org-chart', label: 'Org & People', icon: <Network size={18} />, section: 'People' },
    { id: 'site-visits', label: 'Site Visits', icon: <CalendarClock size={18} />, section: 'Overview' },
    { id: 'inventory', label: 'Property Inventory', icon: <Building2 size={18} />, section: 'Overview' },
    { id: 'flags-admin', label: 'Flags & Warnings', icon: <Flag size={18} />, section: 'Compliance' },
    { id: 'payroll-admin', label: 'Payroll Sign-off', icon: <CreditCard size={18} />, section: 'Finance' },
    { id: 'reports', label: 'Reports Center', icon: <FileText size={18} />, section: 'Reports' },
    { id: 'audit-log', label: 'Audit Log', icon: <ClipboardList size={18} />, section: 'Compliance' },
  ],
}

const sharedItems: NavItem[] = [
  { id: 'calendar', label: 'Shared Calendar', icon: <Calendar size={18} /> },
  { id: 'messages', label: 'Interact', icon: <MessageCircle size={18} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
]

const roleLabels: Record<Role, string> = {
  agent: 'CRM Agent',
  manager: 'Sales Manager',
  admin: 'Super Admin',
}

interface SidebarProps {
  role: Role
  activeScreen: string
  onNavigate: (screen: string) => void
  onLogout: () => void
  unreadCount?: number
  unreadMessages?: number
  pendingEscalations?: number
  onOpenProfile?: () => void
  isOpen?: boolean
  onClose?: () => void
  currentUserName?: string
}

export default function Sidebar({ role, activeScreen, onNavigate, onLogout, unreadCount = 0, unreadMessages = 0, pendingEscalations = 0, onOpenProfile, isOpen = false, onClose, currentUserName = '' }: SidebarProps) {
  const initials = currentUserName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  const user = { name: currentUserName, initials }
  const navItems = navByRole[role]

  const sections = Array.from(new Set(navItems.map((i) => i.section).filter(Boolean)))

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 w-64 flex flex-col z-50 transition-transform duration-200 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: '#1C2B4A' }}
      >
      <button
        onClick={onClose}
        className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg"
        style={{ color: 'rgba(250,248,245,0.6)' }}
      >
        <X size={18} />
      </button>
      {/* Logo */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
        <div className="flex items-center gap-3">
          <LogoMark size={42} color="#C9A96E" />
          <div>
            <p className="font-serif text-base font-bold leading-none tracking-widest" style={{ color: '#C9A96E' }}>PARVA</p>
            <p className="text-[11px] tracking-[0.25em] uppercase font-light mt-0.5" style={{ color: 'rgba(201,169,110,0.7)' }}>REALTY</p>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-6 pt-4 pb-2">
        <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>
          {roleLabels[role]}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {sections.map((section) => (
          <div key={section} className="mb-4">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'rgba(250,248,245,0.3)' }}>
              {section}
            </p>
            {navItems
              .filter((item) => item.section === section)
              .map((item) => {
                const isActive = activeScreen === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all"
                    style={{
                      backgroundColor: isActive ? 'rgba(201,169,110,0.15)' : 'transparent',
                      color: isActive ? '#C9A96E' : 'rgba(250,248,245,0.65)',
                      borderLeft: isActive ? '3px solid #C9A96E' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(250,248,245,0.06)'
                        e.currentTarget.style.color = 'rgba(250,248,245,0.9)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'rgba(250,248,245,0.65)'
                      }
                    }}
                  >
                    <span style={{ color: isActive ? '#C9A96E' : 'rgba(250,248,245,0.5)' }} className="shrink-0">{item.icon}</span>
                    <span className="truncate leading-tight" style={{ fontSize: item.label.length > 18 ? '11.5px' : '13px' }}>{item.label}</span>
                  </button>
                )
              })}
          </div>
        ))}

        <div className="border-t pt-4 mt-2" style={{ borderColor: 'rgba(201,169,110,0.15)' }}>
          {sharedItems.map((item) => {
            const isActive = activeScreen === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all"
                style={{
                  backgroundColor: isActive ? 'rgba(201,169,110,0.15)' : 'transparent',
                  color: isActive ? '#C9A96E' : 'rgba(250,248,245,0.65)',
                  borderLeft: isActive ? '3px solid #C9A96E' : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(250,248,245,0.06)'
                    e.currentTarget.style.color = 'rgba(250,248,245,0.9)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'rgba(250,248,245,0.65)'
                  }
                }}
              >
                <span style={{ color: isActive ? '#C9A96E' : 'rgba(250,248,245,0.5)' }}>{item.icon}</span>
                {item.label}
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#C9A96E' }}>
                    {unreadCount}
                  </span>
                )}
                {item.id === 'messages' && unreadMessages > 0 && (
                  <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#C9A96E' }}>
                    {unreadMessages}
                  </span>
                )}
                {item.id === 'escalations' && pendingEscalations > 0 && (
                  <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#DC2626' }}>
                    {pendingEscalations}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* User profile */}
      <div className="p-4 border-t" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
        <button
          onClick={onOpenProfile}
          className="w-full flex items-center gap-3 mb-3 rounded-lg -m-1 p-1 transition-colors hover:bg-[rgba(250,248,245,0.06)]"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: 'rgba(201,169,110,0.2)', color: '#C9A96E' }}>
            {user.initials}
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium truncate" style={{ color: '#FAF8F5' }}>{user.name}</p>
            <p className="text-xs truncate" style={{ color: 'rgba(250,248,245,0.4)' }}>{roleLabels[role]}</p>
          </div>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ color: 'rgba(250,248,245,0.5)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(250,248,245,0.06)'; e.currentTarget.style.color = '#FAF8F5' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(250,248,245,0.5)' }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
    </>
  )
}
