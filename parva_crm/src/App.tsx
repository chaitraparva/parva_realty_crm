import { useState, useEffect } from 'react'
import {
  messages as initialMessages,
  callLogs as initialCallLogs,
  internalEmails as initialEmails,
  groups as initialGroups,
  groupMessages as initialGroupMessages,
  auditLog as initialAuditLog,
  flags as initialFlags,
  siteVisits as initialSiteVisits,
  escalationRequests as initialEscalations,
} from './data/mockData'

import type {
  Role,
  Notification,
  AuditEntry,
  Group,
  Flag,
  SiteVisit,
  EscalationRequest,
  Message,
  CallLog,
  InternalEmail,
  GroupMessage,
} from './types'

import { supabase } from './lib/supabase'
import { getCurrentEmployee } from './services/chatService'
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './services/notificationService'
import {
  DataProvider,
  useData,
} from './contexts/DataContext'

import Login, {
  type AuthenticatedProfile,
} from './screens/Login'

import Onboarding from './screens/Onboarding'
import Layout from './components/layout/Layout'
import Messages from './screens/Messages'
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
import LeaveManagement from './screens/LeaveManagement'
import { AlertCircle } from 'lucide-react'

const defaultScreens: Record<
  Role,
  string
> = {
  agent: 'my-leads',
  manager: 'team-overview',
  admin: 'admin-dashboard',
}

const ADMIN_ONLY_SCREENS = new Set([
  'admin-dashboard',
  'payroll-admin',
  'flags-admin',
  'reports',
  'audit-log',
  'escalations',
])

const MANAGER_ONLY_SCREENS = new Set([
  'team-overview',
  'pipeline',
  'source-performance',
  'flags',
  'payroll-manager',
  'workload',
])

export function isScreenPermittedForRole(targetScreen: string, userRole: Role): boolean {
  if (userRole === 'admin') return true
  if (ADMIN_ONLY_SCREENS.has(targetScreen)) return false
  if (userRole === 'agent' && MANAGER_ONLY_SCREENS.has(targetScreen)) return false
  return true
}

export interface LoggedInUser {
  id: string
  name: string
  email: string
  role: Role
  office: string
}

export default function App() {
  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<LoggedInUser | null>(
      null
    )

  const handleLogin = (
    profile: AuthenticatedProfile
  ) => {
    setCurrentUser(profile)
  }

  const handleLogout =
    async () => {
      try {
        localStorage.removeItem('parva_crm_active_screen')
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      } catch {
        // ignore storage/history error
      }
      await supabase.auth.signOut()
      setCurrentUser(null)
    }

  if (!currentUser) {
    return (
      <div>
        <Login
          onLogin={
            handleLogin
          }
        />
      </div>
    )
  }

  return (
    <DataProvider
      enabled={true}
    >
      <AuthenticatedApp
        currentUser={
          currentUser
        }
        onLogout={
          handleLogout
        }
      />
    </DataProvider>
  )
}

function AuthenticatedApp({
  currentUser,
  onLogout,
}: {
  currentUser: LoggedInUser
  onLogout: () => void
}) {
  const {
    leads: leadList,
    setLeads: setLeadList,
    loading: dataLoading,
    error: dataError,
    refresh,
  } = useData()

  const getInitialScreen = (): string => {
    if (typeof window !== 'undefined') {
      const hashScreen = window.location.hash.replace(/^#\/?/, '').trim()
      if (hashScreen && isScreenPermittedForRole(hashScreen, currentUser.role)) {
        return hashScreen
      }
      try {
        const savedScreen = localStorage.getItem('parva_crm_active_screen')
        if (savedScreen && isScreenPermittedForRole(savedScreen, currentUser.role)) {
          return savedScreen
        }
      } catch {
        // ignore
      }
    }
    return defaultScreens[currentUser.role]
  }

  const [
    screen,
    setScreen,
  ] = useState<string>(
    getInitialScreen
  )

  const [
    params,
    setParams,
  ] = useState<
    Record<string, string>
  >({})

  const [
    showOnboarding,
    setShowOnboarding,
  ] = useState(false)

  const [
    darkMode,
    setDarkMode,
  ] = useState(false)
  /*
  * ============================================================
  * LOAD EMPLOYEE SETTINGS
  * ============================================================
  *
  * Uses the same authenticated-user -> employee resolution
  * already used by the chat system.
  */
  useEffect(() => {
    let active = true

    const loadEmployeeSettings = async () => {
      try {
        const employee = await getCurrentEmployee()

        const { data, error } = await supabase
          .from('employee_settings')
          .select('dark_mode')
          .eq('employee_id', employee.id)
          .maybeSingle()

        if (error) {
          console.error(
            'Failed to load employee settings:',
            error.message
          )
          return
        }

        if (!active || !data) return

        setDarkMode(Boolean(data.dark_mode))
      } catch (err) {
        console.error(
          'Failed to load employee settings:',
          err
        )
      }
    }

    void loadEmployeeSettings()

    return () => {
      active = false
    }
  }, [currentUser.id])

  /*
   * ============================================================
   * NOTIFICATIONS + OTHER APP STATE
   * ============================================================
   */

  const [
    notifs,
    setNotifs,
  ] = useState<Notification[]>([])

  const [
    groupList,
    setGroupList,
  ] = useState<Group[]>(
    initialGroups
  )

  const [
    auditLog,
    setAuditLog,
  ] = useState<AuditEntry[]>(
    initialAuditLog
  )

  const [
    flagList,
    setFlagList,
  ] = useState<Flag[]>(
    initialFlags
  )

  const [
    visitList,
    setVisitList,
  ] = useState<SiteVisit[]>(
    initialSiteVisits
  )

  const [
    unitPhotos,
    setUnitPhotos,
  ] = useState<Record<string, string[]>>({})

  const [
    escalations,
    setEscalations,
  ] = useState<EscalationRequest[]>(
    initialEscalations
  )

  const [
    msgList,
    setMsgList,
  ] = useState<Message[]>(
    initialMessages
  )

  const [
    callLogsList,
    setCallLogsList,
  ] = useState<CallLog[]>(
    initialCallLogs
  )

  const [
    emailsList,
    setEmailsList,
  ] = useState<InternalEmail[]>(
    initialEmails
  )

  const [
    groupMsgsList,
    setGroupMsgsList,
  ] = useState<GroupMessage[]>(
    initialGroupMessages
  )

  /*
   * ============================================================
   * NAVIGATION
   * ============================================================
   */

  const navigate = (
    nextScreen: string,
    nextParams?: Record<string, string>
  ) => {
    const targetScreen = isScreenPermittedForRole(nextScreen, role)
      ? nextScreen
      : defaultScreens[role]
    setScreen(targetScreen)
    setParams(nextParams || {})
    if (typeof window !== 'undefined') {
      try {
        if (window.location.hash.replace(/^#\/?/, '').trim() !== targetScreen) {
          window.location.hash = targetScreen
        }
        localStorage.setItem('parva_crm_active_screen', targetScreen)
      } catch {
        // ignore storage/hash errors
      }
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (window.location.hash.replace(/^#\/?/, '').trim() !== screen) {
          window.location.hash = screen
        }
        localStorage.setItem('parva_crm_active_screen', screen)
      } catch {
        // ignore
      }
    }
  }, [screen])

  useEffect(() => {
    const handleHashChange = () => {
      const hashScreen = window.location.hash.replace(/^#\/?/, '').trim()
      if (hashScreen && hashScreen !== screen) {
        if (isScreenPermittedForRole(hashScreen, currentUser.role)) {
          setScreen(hashScreen)
        } else {
          navigate(defaultScreens[currentUser.role])
        }
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [screen, currentUser.role])

  /*
   * ============================================================
   * LOAD NOTIFICATIONS FROM SUPABASE
   * ============================================================
   */

  useEffect(() => {
    let active = true

    const loadNotifications = async () => {
      try {
        const mapped = await fetchUserNotifications(currentUser.id)
        if (!active) return
        setNotifs(mapped)
      } catch (err) {
        console.error('Failed to load notifications:', err)
      }
    }

    void loadNotifications()

    // Real-time synchronization with Supabase notifications table
    const channel = supabase
      .channel(`notifications_realtime_${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `employee_id=eq.${currentUser.id}`,
        },
        () => {
          if (active) {
            void loadNotifications()
          }
        }
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [currentUser.id])

  const handleMarkRead = (id: string) => {
    setNotifs((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    )
    void markNotificationAsRead(id, currentUser.id)
  }

  const handleMarkAllRead = () => {
    setNotifs((prev) =>
      prev.map((notification) => ({
        ...notification,
        read: true,
      }))
    )
    void markAllNotificationsAsRead(currentUser.id)
  }

  /*
   * ============================================================
   * ADD NOTIFICATION
   * ============================================================
   */

  const addNotification = (
    n: Omit<
      Notification,
      'id' |
      'timestamp' |
      'read'
    >
  ) => {
    const recipientId =
      (n as Notification)
        .recipientId ||
      currentUser.id

    const notification: Notification =
    {
      ...(
        n as Notification
      ),

      id:
        crypto.randomUUID(),

      recipientId,

      timestamp:
        new Date().toISOString(),

      read: false,
    }

    setNotifs(
      (prev) => [
        notification,
        ...prev,
      ]
    )

    void supabase
      .from('notifications')
      .insert({
        id:
          notification.id,

        employee_id:
          recipientId,

        type:
          notification.type,

        title:
          notification.title,

        message:
          notification.message,

        is_read:
          false,

        link:
          notification.link ??
          null,
      })
      .then(
        ({
          error,
        }) => {
          if (error) {
            console.error(
              'Failed to save notification:',
              error.message
            )

            setNotifs(
              (prev) =>
                prev.filter(
                  (item) =>
                    item.id !==
                    notification.id
                )
            )
          }
        }
      )
  }

  /*
   * ============================================================
   * ADD AUDIT ENTRY
   *
   * NOW PERSISTED TO SUPABASE.
   * ============================================================
   */

  const addAuditEntry = (
    action: string,
    details: string,
    previousValue?: string,
    newValue?: string,
    reason?: string
  ) => {
    const id =
      crypto.randomUUID()

    const createdAt =
      new Date()

    const timestamp =
      createdAt
        .toISOString()
        .slice(
          0,
          16
        )
        .replace(
          'T',
          ' '
        )

    const localEntry: AuditEntry =
    {
      id,

      timestamp,

      actorName:
        currentUser.name,

      action,

      details,

      previousValue,

      newValue,

      reason,
    }

    /*
     * Update UI immediately.
     */
    setAuditLog(
      (prev) => [
        localEntry,
        ...prev,
      ]
    )

    /*
     * Persist permanently in Supabase.
     */
    void supabase
      .from(
        'audit_logs'
      )
      .insert({
        id,

        actor_id:
          currentUser.id,

        action,

        entity_type:
          null,

        entity_id:
          null,

        description:
          details,

        metadata: {
          previousValue:
            previousValue ??
            null,

          newValue:
            newValue ??
            null,

          reason:
            reason ??
            null,
        },
      })
      .then(
        ({
          error,
        }) => {
          if (error) {
            console.error(
              'Failed to save audit log:',
              error.message
            )

            /*
             * Remove the temporary UI entry
             * when database persistence fails.
             */
            setAuditLog(
              (prev) =>
                prev.filter(
                  (entry) =>
                    entry.id !==
                    id
                )
            )
          }
        }
      )
  }

  const role =
    currentUser.role

  /*
   * ============================================================
   * ONBOARDING
   * ============================================================
   */

  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() =>
          setShowOnboarding(
            false
          )
        }
      />
    )
  }

  /*
   * ============================================================
   * CLIENT PORTAL
   * ============================================================
   */

  if (
    screen ===
    'client-portal'
  ) {
    return (
      <ClientPortal
        leadId={
          params.leadId ||
          'lead-1'
        }
        onBack={() =>
          navigate(
            defaultScreens[
            role
            ]
          )
        }
        unitPhotos={
          unitPhotos
        }
      />
    )
  }

  /*
   * ============================================================
   * COUNTERS
   * ============================================================
   */

  const unreadCount =
    notifs.filter(
      (n) => !n.read
    ).length

  const myGroupIds =
    groupList
      .filter((group) =>
        group.memberIds.includes(
          currentUser.id
        )
      )
      .map(
        (group) =>
          group.id
      )

  const unreadGroupMessages =
    groupMsgsList.filter(
      (message) =>
        myGroupIds.includes(
          message.groupId
        ) &&
        message.senderId !==
        currentUser.id &&
        !message.readBy.includes(
          currentUser.id
        )
    ).length

  const unreadMessages =
    msgList.filter(
      (message) =>
        message.recipientId ===
        currentUser.id &&
        !message.read
    ).length +
    unreadGroupMessages

  const pendingEscalations =
    escalations.filter(
      (item) =>
        item.status ===
        'pending'
    ).length

  /*
   * ============================================================
   * SCREENS
   * ============================================================
   */

  const renderScreen =
    () => {
      if (!isScreenPermittedForRole(screen, role)) {
        return (
          <div className="bg-card rounded-xl border border-border p-8 text-center max-w-md mx-auto my-12 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} />
            </div>
            <h3 className="font-serif text-lg font-semibold text-foreground">
              Access Denied
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              Your account role does not have permission to access this screen.
            </p>
            <button
              onClick={() => navigate(defaultScreens[role])}
              className="mt-6 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-95"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
            >
              Return to Dashboard
            </button>
          </div>
        )
      }

      switch (
      screen
      ) {

        /*
         * --------------------------------------------------------
         * AGENT
         * --------------------------------------------------------
         */

        case 'my-leads':
          return (
            <MyLeads
              navigate={
                navigate
              }
              setFlagList={
                setFlagList
              }
              onAddNotification={
                addNotification
              }
              onAddAudit={
                addAuditEntry
              }
              currentUserId={
                currentUser.id
              }
              currentUserName={
                currentUser.name
              }
              role={role}
            />
          )

        case 'lead-detail':
          return (
            <LeadDetail
              leadId={
                params.leadId ||
                'lead-1'
              }
              navigate={
                navigate
              }
              onAddNotification={
                addNotification
              }
              onAddAudit={
                addAuditEntry
              }
              unitPhotos={
                unitPhotos
              }
              onAddEscalation={(
                escalation
              ) =>
                setEscalations(
                  (prev) => [
                    escalation,
                    ...prev,
                  ]
                )
              }
              currentUserId={
                currentUser.id
              }
              currentUserName={
                currentUser.name
              }
              canDelete={
                role === 'admin'
              }
            />
          )

        case 'performance':
          return (
            <Performance />
          )

        /*
         * --------------------------------------------------------
         * MANAGER
         * --------------------------------------------------------
         */

        case 'team-overview':
          return (
            <TeamOverview
              navigate={
                navigate
              }
            />
          )

        case 'pipeline':
          return (
            <Pipeline />
          )

        case 'source-performance':
          return (
            <SourcePerformance />
          )

        case 'flags':
          return (
            <Flags
              flagList={
                flagList
              }
              setFlagList={
                setFlagList
              }
              onAddNotification={
                addNotification
              }
              onAddAudit={
                addAuditEntry
              }
            />
          )

        case 'payroll-manager':
          return (
            <PayrollManager />
          )

        /*
         * --------------------------------------------------------
         * ADMIN
         * --------------------------------------------------------
         */

        case 'admin-dashboard':
          return (
            <AdminDashboard />
          )

        case 'org-chart':
          return (
            <OrgChart
              groupList={
                groupList
              }
              onCreateGroup={(
                group
              ) =>
                setGroupList(
                  (prev) => [
                    ...prev,
                    group,
                  ]
                )
              }
              onNavigate={
                navigate
              }
            />
          )

        case 'workload':
          return (
            <WorkloadDashboard
              leads={
                leadList
              }
              setLeads={
                setLeadList
              }
              onAddAudit={
                addAuditEntry
              }
              onAddNotification={
                addNotification
              }
            />
          )

        case 'escalations':
          return (
            <EscalationAdmin
              escalations={
                escalations
              }
              setEscalations={
                setEscalations
              }
              leads={
                leadList
              }
              setLeads={
                setLeadList
              }
              onAddAudit={
                addAuditEntry
              }
              onAddNotification={
                addNotification
              }
            />
          )

        case 'payroll-admin':
          return (
            <PayrollAdmin />
          )

        case 'flags-admin':
          return (
            <FlagsAdmin
              flagList={
                flagList
              }
              setFlagList={
                setFlagList
              }
            />
          )

        case 'reports':
          return (
            <Reports />
          )

        case 'audit-log':
          return (
            <AuditLog
              entries={
                auditLog
              }
            />
          )

        /*
         * --------------------------------------------------------
         * SHARED
         * --------------------------------------------------------
         */

        case 'inventory':
          return (
            <Inventory
              role={role}
              unitPhotos={
                unitPhotos
              }
              setUnitPhotos={
                setUnitPhotos
              }
            />
          )

        case 'site-visits':
          return (
            <SiteVisits
              role={role}
              visitList={
                visitList
              }
              setVisitList={
                setVisitList
              }
              onAddNotification={
                addNotification
              }
              currentUserId={
                currentUser.id
              }
            />
          )

        case 'messages':
          return (
            <Messages
              role={role}
              currentUserId={
                currentUser.id
              }
              initialContactId={
                params.employeeId
              }
              initialGroupId={
                params.groupId
              }
              groupList={
                groupList
              }
              setGroupList={
                setGroupList
              }
              msgs={
                msgList
              }
              setMsgs={
                setMsgList
              }
              callLogsList={
                callLogsList
              }
              setCallLogsList={
                setCallLogsList
              }
              emailsList={
                emailsList
              }
              setEmailsList={
                setEmailsList
              }
              groupMsgsList={
                groupMsgsList
              }
              setGroupMsgsList={
                setGroupMsgsList
              }
            />
          )

        /*
         * --------------------------------------------------------
         * NOTIFICATIONS
         * --------------------------------------------------------
         */

        case 'notifications':
          return (
            <Notifications
              notifs={
                notifs
              }
              onMarkRead={
                handleMarkRead
              }
              onMarkAllRead={
                handleMarkAllRead
              }
            />
          )

        case 'calendar':
          return (
            <SharedCalendar
              role={role}
              currentUserId={
                currentUser.id
              }
            />
          )

        case 'approvals':
          return (
            <Approvals
              role={role}
              onAddNotification={
                addNotification
              }
              onAddAudit={
                addAuditEntry
              }
            />
          )

        case 'settings':
          return (
            <Settings
              darkMode={
                darkMode
              }
              onToggleDarkMode={() =>
                setDarkMode(
                  (value) =>
                    !value
                )
              }
            />
          )

        case 'leave-management':
          return (
            <LeaveManagement
              role={role}
              currentUserId={
                currentUser.id
              }
            />
          )

        default:
          return (
            <div className="text-muted-foreground">
              Screen not found
            </div>
          )
      }
    }

  /*
   * ============================================================
   * FINAL LAYOUT
   * ============================================================
   */

  return (
    <div
      className={
        darkMode
          ? 'dark'
          : ''
      }
    >
      <Layout
        role={role}
        screen={screen}
        onNavigate={
          navigate
        }
        onLogout={
          onLogout
        }
        unreadCount={
          unreadCount
        }
        unreadMessages={
          unreadMessages
        }
        notifications={
          notifs
        }
        onMarkRead={
          handleMarkRead
        }
        onMarkAllRead={
          handleMarkAllRead
        }
        darkMode={
          darkMode
        }
        onToggleDarkMode={() =>
          setDarkMode(
            (value) =>
              !value
          )
        }
        groupList={
          groupList
        }
        pendingEscalations={
          pendingEscalations
        }
        currentUserName={
          currentUser.name
        }
        currentUserEmail={
          currentUser.email
        }
      >

        {dataError && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-3"
            style={{
              backgroundColor:
                '#FEF2F2',
              color:
                '#DC2626',
            }}
          >
            <span>
              ⚠ Couldn't load live
              data from the server:{' '}
              {dataError}
            </span>

            <button
              onClick={() =>
                refresh()
              }
              className="text-xs font-semibold underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {dataLoading &&
          leadList.length ===
          0 &&
          !dataError ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            Loading your
            workspace…
          </div>
        ) : (
          renderScreen()
        )}

      </Layout>
    </div>
  )
}