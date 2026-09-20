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

const defaultScreens: Record<
  Role,
  string
> = {
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

  const [
    screen,
    setScreen,
  ] = useState(
    defaultScreens[
    currentUser.role
    ]
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
    setScreen(nextScreen)
    setParams(nextParams || {})
  }

  /*
   * ============================================================
   * LOAD NOTIFICATIONS FROM SUPABASE
   * ============================================================
   */

  useEffect(() => {
    let active = true

    const loadNotifications =
      async () => {
        const {
          data,
          error,
        } = await supabase
          .from(
            'notifications'
          )
          .select(`
            id,
            employee_id,
            type,
            title,
            message,
            is_read,
            link,
            created_at
          `)
          .eq(
            'employee_id',
            currentUser.id
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          )

        if (!active) {
          return
        }

        if (error) {
          console.error(
            'Failed to load notifications:',
            error.message
          )

          setNotifs([])
          return
        }

        const mapped: Notification[] =
          (
            data ?? []
          ).map(
            (
              notification: any
            ) => ({
              id:
                notification.id,

              recipientId:
                notification.employee_id,

              type:
                notification.type,

              title:
                notification.title,

              message:
                notification.message,

              timestamp:
                notification.created_at,

              read:
                notification.is_read,

              link:
                notification.link ??
                undefined,
            })
          )

        setNotifs(
          mapped
        )
      }

    void loadNotifications()

    return () => {
      active = false
    }
  }, [
    currentUser.id,
  ])

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

              onMarkRead={(
                id
              ) => {
                setNotifs(
                  (prev) =>
                    prev.map(
                      (notification) =>
                        notification.id ===
                          id
                          ? {
                            ...notification,
                            read: true,
                          }
                          : notification
                    )
                )

                void supabase
                  .from(
                    'notifications'
                  )
                  .update({
                    is_read:
                      true,
                  })
                  .eq(
                    'id',
                    id
                  )
                  .eq(
                    'employee_id',
                    currentUser.id
                  )
              }}

              onMarkAllRead={() => {
                setNotifs(
                  (prev) =>
                    prev.map(
                      (notification) => ({
                        ...notification,
                        read: true,
                      })
                    )
                )

                void supabase
                  .from(
                    'notifications'
                  )
                  .update({
                    is_read:
                      true,
                  })
                  .eq(
                    'employee_id',
                    currentUser.id
                  )
              }}
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