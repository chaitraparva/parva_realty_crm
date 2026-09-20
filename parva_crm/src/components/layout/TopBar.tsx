import { useState, useRef, useEffect } from 'react'
import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  Sun,
  Moon,
  CalendarDays,
  CheckCheck,
  Building2,
  CalendarClock,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  XCircle,
  Plane,
  AlertCircle,
  Zap,
  MessageCircle,
} from 'lucide-react'
import type { Role, Notification } from '../../types'

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

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'leave-request':
    case 'leave_request':
      return <CalendarDays size={16} className="text-[#C9A96E]" />
    case 'site-visit':
      return <CalendarClock size={16} className="text-amber-600" />
    case 'approval':
      return <ClipboardCheck size={16} className="text-emerald-600" />
    case 'flag':
      return <AlertTriangle size={16} className="text-red-600" />
    case 'missed-followup':
      return <Clock size={16} className="text-amber-600" />
    case 'lead-cancelled':
      return <XCircle size={16} className="text-red-600" />
    case 'lead-transfer':
      return <Plane size={16} className="text-blue-600" />
    case 'escalation':
      return <AlertCircle size={16} className="text-orange-600" />
    case 'ai-assignment':
      return <Zap size={16} className="text-purple-600" />
    case 'chat_message':
    case 'message':
      return <MessageCircle size={16} className="text-[#C9A96E]" />
    case 'unassigned-lead':
    default:
      return <Bell size={16} className="text-[#C9A96E]" />
  }
}

function formatTimestamp(timestampStr: string): string {
  if (!timestampStr) return ''
  try {
    const d = new Date(timestampStr)
    if (Number.isNaN(d.getTime())) return timestampStr

    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / (60 * 1000))
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return timestampStr
  }
}

interface TopBarProps {
  role: Role
  screen: string
  unreadCount?: number
  notifications?: Notification[]
  onMarkRead?: (id: string) => void
  onMarkAllRead?: () => void
  onNavigate: (screen: string, params?: Record<string, string>) => void
  onOpenProfile?: () => void
  onMenuClick?: () => void
  onSearchClick?: () => void
  darkMode?: boolean
  onToggleDarkMode?: () => void
  currentUserName?: string
}

export default function TopBar({
  role,
  screen,
  unreadCount = 0,
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  onNavigate,
  onOpenProfile,
  onMenuClick,
  onSearchClick,
  darkMode = false,
  onToggleDarkMode,
  currentUserName = '',
}: TopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const initials =
    currentUserName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Dismiss dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dropdownOpen])

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.read) {
      onMarkRead?.(notif.id)
    }
    setDropdownOpen(false)

    if (
      notif.type === 'leave-request' ||
      notif.type === 'leave_request' ||
      notif.link === 'leave-management'
    ) {
      onNavigate('leave-management')
    } else if (notif.link) {
      if (notif.link.startsWith('lead-detail:')) {
        const leadId = notif.link.replace('lead-detail:', '').trim()
        onNavigate('lead-detail')
      } else if (notif.link.startsWith('messages?')) {
        const queryStr = notif.link.split('?')[1] || ''
        const params: Record<string, string> = {}
        new URLSearchParams(queryStr).forEach((val, key) => {
          params[key] = val
        })
        onNavigate('messages', params)
      } else {
        onNavigate(notif.link)
      }
    } else {
      onNavigate('notifications')
    }
  }

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-card border-b border-border z-30 flex items-center px-4 sm:px-6 lg:px-8 gap-3">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="font-serif text-lg sm:text-xl font-semibold text-foreground truncate">
          {screenTitles[screen] || screen}
        </h1>
        <p className="text-xs text-muted-foreground hidden sm:block">{today}</p>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <button
          onClick={onSearchClick}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Search size={14} />
          Search
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">
            ⌘K
          </kbd>
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
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Bell Button with Notification Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-sm animate-pulse"
                style={{ backgroundColor: '#C9A96E' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Dropdown Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-sm font-semibold text-foreground">
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={() => onMarkAllRead?.()}
                    className="flex items-center gap-1 text-xs font-semibold text-accent hover:opacity-80 transition-opacity"
                  >
                    <CheckCheck size={13} />
                    Mark all as read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell
                      size={28}
                      className="mx-auto text-muted-foreground opacity-30 mb-2"
                    />
                    <p className="text-sm font-semibold text-foreground">
                      You're all caught up
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      No notifications right now.
                    </p>
                  </div>
                ) : (
                  notifications.slice(0, 15).map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 sm:p-4 cursor-pointer transition-colors hover:bg-muted/40 relative flex items-start gap-3 ${
                        !notif.read
                          ? 'bg-amber-50/40 dark:bg-amber-950/10'
                          : ''
                      }`}
                      style={{
                        borderLeft: !notif.read
                          ? '3px solid #C9A96E'
                          : '3px solid transparent',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          backgroundColor: 'rgba(201,169,110,0.12)',
                        }}
                      >
                        {getNotificationIcon(notif.type)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-xs sm:text-sm text-foreground truncate ${
                              !notif.read ? 'font-bold' : 'font-semibold'
                            }`}
                          >
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatTimestamp(notif.timestamp)}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>

                      {!notif.read && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0 self-center"
                          style={{ backgroundColor: '#C9A96E' }}
                          title="Unread"
                        />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer */}
              <div className="p-2 border-t border-border bg-muted/10 text-center">
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    onNavigate('notifications')
                  }}
                  className="w-full py-1.5 text-xs font-semibold text-accent hover:underline"
                >
                  View all notifications →
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-none">
              {currentUserName}
            </p>
          </div>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}
