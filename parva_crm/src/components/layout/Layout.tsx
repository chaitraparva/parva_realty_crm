import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Role, Group, Notification } from '../../types'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import ProfileModal from './ProfileModal'
import GlobalSearch from './GlobalSearch'
import { Menu, Target, Users, LayoutDashboard, MessageCircle, Bell, TrendingUp } from 'lucide-react'

const mobileBottomNav: Record<Role, { id: string; icon: React.ReactNode; label: string }[]> = {
  agent: [
    { id: 'my-leads', icon: <Target size={20} />, label: 'Leads' },
    { id: 'performance', icon: <TrendingUp size={20} />, label: 'Performance' },
    { id: 'messages', icon: <MessageCircle size={20} />, label: 'Interact' },
    { id: 'notifications', icon: <Bell size={20} />, label: 'Alerts' },
  ],
  manager: [
    { id: 'my-leads', icon: <Target size={20} />, label: 'Leads' },
    { id: 'team-overview', icon: <Users size={20} />, label: 'Team' },
    { id: 'messages', icon: <MessageCircle size={20} />, label: 'Interact' },
    { id: 'notifications', icon: <Bell size={20} />, label: 'Alerts' },
  ],
  admin: [
    { id: 'admin-dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { id: 'workload', icon: <Users size={20} />, label: 'Workload' },
    { id: 'messages', icon: <MessageCircle size={20} />, label: 'Interact' },
    { id: 'notifications', icon: <Bell size={20} />, label: 'Alerts' },
  ],
}

interface LayoutProps {
  role: Role
  screen: string
  onNavigate: (screen: string, params?: Record<string, string>) => void
  onLogout: () => void
  unreadCount?: number
  unreadMessages?: number
  notifications?: Notification[]
  onMarkRead?: (id: string) => void
  onMarkAllRead?: () => void
  darkMode?: boolean
  onToggleDarkMode?: () => void
  groupList?: Group[]
  pendingEscalations?: number
  currentUserName?: string
  currentUserEmail?: string
  children: ReactNode
}

export default function Layout({
  role,
  screen,
  onNavigate,
  onLogout,
  unreadCount = 0,
  unreadMessages = 0,
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  darkMode = false,
  onToggleDarkMode,
  groupList = [],
  pendingEscalations = 0,
  currentUserName = '',
  currentUserEmail = '',
  children,
}: LayoutProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const user = { name: currentUserName, email: currentUserEmail }

  const navigate = (screen: string, params?: Record<string, string>) => {
    setMobileNavOpen(false)
    onNavigate(screen, params)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        role={role}
        activeScreen={screen}
        onNavigate={navigate}
        onLogout={onLogout}
        unreadCount={unreadCount}
        unreadMessages={unreadMessages}
        pendingEscalations={pendingEscalations}
        onOpenProfile={() => { setMobileNavOpen(false); setProfileOpen(true) }}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        currentUserName={currentUserName}
      />
      <TopBar
        role={role}
        screen={screen}
        unreadCount={unreadCount}
        notifications={notifications}
        onMarkRead={onMarkRead}
        onMarkAllRead={onMarkAllRead}
        onNavigate={onNavigate}
        onOpenProfile={() => setProfileOpen(true)}
        onMenuClick={() => setMobileNavOpen(true)}
        onSearchClick={() => setSearchOpen(true)}
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        currentUserName={currentUserName}
      />
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 pb-24 sm:pb-8 max-w-full overflow-x-hidden">{children}</div>
      </main>
      {/* Mobile bottom nav — hidden on desktop */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden border-t border-border bg-card z-30 flex items-center justify-around px-2 py-2 safe-area-inset-bottom" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {(mobileBottomNav[role] || []).map(({ id, icon, label }) => {
          const isActive = screen === id
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0 flex-1"
              style={{ color: isActive ? '#C9A96E' : '#7A7065', backgroundColor: isActive ? 'rgba(201,169,110,0.1)' : 'transparent' }}
            >
              {icon}
              <span className="text-[10px] font-medium truncate">{label}</span>
            </button>
          )
        })}
        <button
          onClick={() => setMobileNavOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors flex-1"
          style={{ color: '#7A7065' }}
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} role={role} name={user.name} email={user.email} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={onNavigate} groupList={groupList} />
    </div>
  )
}
