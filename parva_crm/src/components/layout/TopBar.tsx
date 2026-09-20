import { Bell, ChevronDown, Menu, Search, Sun, Moon } from 'lucide-react'
import type { Role } from '../../types'

const screenTitles: Record<string, string> = {
  'my-leads': 'Leads',
  'lead-detail': 'Lead Detail',
  performance: 'My Performance',
  'team-overview': 'Team Overview',
  pipeline: 'Lead Pipeline',
  'source-performance': 'Source Performance',
  flags: 'Flags & Warnings',
  'payroll-manager': 'Payroll Approval',
  'admin-dashboard': 'Company Dashboard',
  'org-chart': 'Org & People',
  'flags-admin': 'Flags & Warnings',
  'payroll-admin': 'Payroll Sign-off',
  workload: 'Workload & AI Assignment',
  approvals: 'Approvals',
  escalations: 'Escalation Requests',
  calendar: 'Shared Calendar',
  'audit-log': 'Audit Log',
  reports: 'Reports Center',
  inventory: 'Property Inventory',
  'site-visits': 'Site Visits',
  messages: 'Interact',
  notifications: 'Notifications',
  settings: 'Settings',
  'leave-management': 'Leave Management',
}

interface TopBarProps {
  role: Role
  screen: string
  unreadCount?: number
  onNavigate: (screen: string) => void
  onOpenProfile?: () => void
  onMenuClick?: () => void
  onSearchClick?: () => void
  darkMode?: boolean
  onToggleDarkMode?: () => void
  currentUserName?: string
}

export default function TopBar({ role, screen, unreadCount = 0, onNavigate, onOpenProfile, onMenuClick, onSearchClick, darkMode = false, onToggleDarkMode, currentUserName = '' }: TopBarProps) {
  const initials = currentUserName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-card border-b border-border z-30 flex items-center px-4 sm:px-6 lg:px-8 gap-3">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
      >
        <Menu size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="font-serif text-lg sm:text-xl font-semibold text-foreground truncate">{screenTitles[screen] || screen}</h1>
        <p className="text-xs text-muted-foreground hidden sm:block">{today}</p>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <button
          onClick={onSearchClick}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Search size={14} />
          Search
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">⌘K</kbd>
        </button>
        <button
          onClick={onSearchClick}
          className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Search size={18} />
        </button>
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={() => onNavigate('notifications')}
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <button onClick={onOpenProfile} className="flex items-center gap-2.5 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-none">{currentUserName}</p>
          </div>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}
