import { useState } from 'react'
import { notifications, messages as initialMessages, callLogs as initialCallLogs, internalEmails as initialEmails, groups as initialGroups, groupMessages as initialGroupMessages, auditLog as initialAuditLog, flags as initialFlags, siteVisits as initialSiteVisits, escalationRequests as initialEscalations } from './data/mockData'
import type { Role, Notification, AuditEntry, Group, Flag, SiteVisit, EscalationRequest, Message, CallLog, InternalEmail, GroupMessage } from './types'
import { supabase } from './lib/supabase'
import { DataProvider, useData } from './contexts/DataContext'
import Login, { type AuthenticatedProfile } from './screens/Login'
import Onboarding from './screens/Onboarding'
import Layout from './components/layout/Layout'
import Messages, { currentUserByRole } from './screens/Messages'
import Inventory from './screens/Inventory'
import SiteVisits from './screens/SiteVisits'
import ClientPortal from './screens/ClientPortal'

import MyLeads from './screens/agent/MyLeads'
import LeadDetail from './screens/agent/LeadDetail'
import Performance from './screens/agent/Performance'

import TeamOverview from './screens/manager/TeamOverview'
import Pipeline from './screens/manager/Pipeline'
import SourcePerformance from './screens/manager/SourcePerformance'
import Flags from './screens/manager/Flags'
import PayrollManager from './screens/manager/PayrollManager'

import AdminDashboard from './screens/admin/AdminDashboard'
import OrgChart from './screens/admin/OrgChart'
import PayrollAdmin from './screens/admin/PayrollAdmin'
import FlagsAdmin from './screens/admin/FlagsAdmin'
import Reports from './screens/admin/Reports'
import AuditLog from './screens/admin/AuditLog'
import WorkloadDashboard from './screens/admin/WorkloadDashboard'
import EscalationAdmin from './screens/admin/EscalationAdmin'

import SharedCalendar from './screens/SharedCalendar'
import Approvals from './screens/Approvals'
import Notifications from './screens/Notifications'
import Settings from './screens/Settings'

const defaultScreens: Record<Role, string> = {
  agent: 'my-leads',
  manager: 'team-overview',
  admin: 'admin-dashboard',
}

export interface LoggedInUser {
  id: string
  name: string
  email: string
  role: Role
  office: string
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<LoggedInUser | null>(null)

  const handleLogin = (profile: AuthenticatedProfile) => {
    setCurrentUser(profile)
  }

  const handleLogout = async () => {
    // Supabase Auth is the source of truth for the session — signing out
    // here invalidates it (and clears the persisted session) everywhere.
    await supabase.auth.signOut()
    setCurrentUser(null)
  }

  if (!currentUser) {
    return (
      <div>
        <Login onLogin={handleLogin} />
      </div>
    )
  }

  // Real employees/leads are fetched from the backend/Supabase only once
  // there's an authenticated user — DataProvider owns that lifecycle.
  return (
    <DataProvider enabled={true}>
      <AuthenticatedApp currentUser={currentUser} onLogout={handleLogout} />
    </DataProvider>
  )
}

function AuthenticatedApp({ currentUser, onLogout }: { currentUser: LoggedInUser; onLogout: () => void }) {
  const { leads: leadList, setLeads: setLeadList, loading: dataLoading, error: dataError, refresh } = useData()

  const [screen, setScreen] = useState(defaultScreens[currentUser.role])
  const [params, setParams] = useState<Record<string, string>>({})
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [notifs, setNotifs] = useState(notifications)
  const [groupList, setGroupList] = useState<Group[]>(initialGroups)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(initialAuditLog)
  const [flagList, setFlagList] = useState<Flag[]>(initialFlags)
  const [visitList, setVisitList] = useState<SiteVisit[]>(initialSiteVisits)
  const [unitPhotos, setUnitPhotos] = useState<Record<string, string[]>>({})
  const [escalations, setEscalations] = useState<EscalationRequest[]>(initialEscalations)
  // Lifted message state — persists across user switches in the same session
  const [msgList, setMsgList] = useState<Message[]>(initialMessages)
  const [callLogsList, setCallLogsList] = useState<CallLog[]>(initialCallLogs)
  const [emailsList, setEmailsList] = useState<InternalEmail[]>(initialEmails)
  const [groupMsgsList, setGroupMsgsList] = useState<GroupMessage[]>(initialGroupMessages)

  const navigate = (s: string, p?: Record<string, string>) => {
    setScreen(s)
    setParams(p || {})
  }

  const addNotification = (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifs((prev) => [
      { ...n, id: `notif-${Date.now()}`, timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '), read: false },
      ...prev,
    ])
  }

  const addAuditEntry = (action: string, details: string, prev?: string, next?: string, reason?: string) => {
    setAuditLog((prev_) => [
      { id: `audit-${Date.now()}`, timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '), actorName: currentUser.name ?? 'System', action, details, previousValue: prev, newValue: next, reason },
      ...prev_,
    ])
  }

  const role = currentUser.role
  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  if (screen === 'client-portal') {
    return <ClientPortal leadId={params.leadId || 'lead-1'} onBack={() => navigate(defaultScreens[role])} unitPhotos={unitPhotos} />
  }

  const unreadCount = notifs.filter((n) => !n.read).length
  const myGroupIds = groupList.filter((g) => g.memberIds.includes(currentUser.id)).map((g) => g.id)
  const unreadGroupMessages = groupMsgsList.filter((m) => myGroupIds.includes(m.groupId) && m.senderId !== currentUser.id && !m.readBy.includes(currentUser.id)).length
  const unreadMessages = msgList.filter((m) => m.recipientId === currentUser.id && !m.read).length + unreadGroupMessages
  const pendingEscalations = escalations.filter((e) => e.status === 'pending').length

  const renderScreen = () => {
    switch (screen) {
      // Agent
      case 'my-leads': return (
        <MyLeads navigate={navigate} setFlagList={setFlagList} onAddNotification={addNotification} onAddAudit={addAuditEntry} currentUserId={currentUser.id} currentUserName={currentUser.name} role={role} />
      )
      case 'lead-detail': return (
        <LeadDetail
          leadId={params.leadId || 'lead-1'}
          navigate={navigate}
          onAddNotification={addNotification}
          onAddAudit={addAuditEntry}
          unitPhotos={unitPhotos}
          onAddEscalation={(esc) => setEscalations((prev) => [esc, ...prev])}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          canDelete={role === 'admin'}
        />
      )
      case 'performance': return <Performance />

      // Manager
      case 'team-overview': return <TeamOverview navigate={navigate} />
      case 'pipeline': return <Pipeline />
      case 'source-performance': return <SourcePerformance />
      case 'flags': return <Flags flagList={flagList} setFlagList={setFlagList} onAddNotification={addNotification} onAddAudit={addAuditEntry} />
      case 'payroll-manager': return <PayrollManager />

      // Admin
      case 'admin-dashboard': return <AdminDashboard />
      case 'org-chart': return (
        <OrgChart
          groupList={groupList}
          onCreateGroup={(g) => setGroupList((prev) => [...prev, g])}
          onNavigate={navigate}
        />
      )
      case 'workload': return (
        <WorkloadDashboard leads={leadList} setLeads={setLeadList} onAddAudit={addAuditEntry} onAddNotification={addNotification} />
      )
      case 'escalations': return (
        <EscalationAdmin
          escalations={escalations}
          setEscalations={setEscalations}
          leads={leadList}
          setLeads={setLeadList}
          onAddAudit={addAuditEntry}
          onAddNotification={addNotification}
        />
      )
      case 'payroll-admin': return <PayrollAdmin />
      case 'flags-admin': return <FlagsAdmin flagList={flagList} setFlagList={setFlagList} />
      case 'reports': return <Reports />
      case 'audit-log': return <AuditLog entries={auditLog} />

      // Shared
      case 'inventory': return <Inventory role={role} unitPhotos={unitPhotos} setUnitPhotos={setUnitPhotos} />
      case 'site-visits': return (
        <SiteVisits role={role} visitList={visitList} setVisitList={setVisitList} onAddNotification={addNotification} currentUserId={currentUser.id} />
      )
      case 'messages': return (
        <Messages
          role={role}
          currentUserId={currentUser.id}
          initialContactId={params.employeeId}
          initialGroupId={params.groupId}
          groupList={groupList}
          setGroupList={setGroupList}
          msgs={msgList}
          setMsgs={setMsgList}
          callLogsList={callLogsList}
          setCallLogsList={setCallLogsList}
          emailsList={emailsList}
          setEmailsList={setEmailsList}
          groupMsgsList={groupMsgsList}
          setGroupMsgsList={setGroupMsgsList}
        />
      )
      case 'notifications': return (
        <Notifications
          notifs={notifs}
          onMarkRead={(id) => setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))}
          onMarkAllRead={() => setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))}
        />
      )
      case 'calendar': return <SharedCalendar role={role} currentUserId={currentUser.id} />
      case 'approvals': return <Approvals role={role} onAddNotification={addNotification} onAddAudit={addAuditEntry} />
      case 'settings': return <Settings darkMode={darkMode} onToggleDarkMode={() => setDarkMode((d) => !d)} />

      default: return <div className="text-muted-foreground">Screen not found</div>
    }
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Layout
        role={role}
        screen={screen}
        onNavigate={navigate}
        onLogout={onLogout}
        unreadCount={unreadCount}
        unreadMessages={unreadMessages}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        groupList={groupList}
        pendingEscalations={pendingEscalations}
        currentUserName={currentUser.name}
        currentUserEmail={currentUser.email}
      >
        {dataError && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
            <span>⚠ Couldn't load live data from the server: {dataError}</span>
            <button onClick={() => refresh()} className="text-xs font-semibold underline shrink-0">Retry</button>
          </div>
        )}
        {dataLoading && leadList.length === 0 && !dataError ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Loading your workspace…</div>
        ) : (
          renderScreen()
        )}
      </Layout>
    </div>
  )
}
