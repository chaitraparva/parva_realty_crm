import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  MapPin,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarClock,
  UserPlus,
  ShieldQuestion,
  Loader2,
} from 'lucide-react'

import { projects } from '../data/mockData'
import { useData } from '../contexts/DataContext'
import Modal from '../components/ui/Modal'
import type {
  Role,
  SiteVisit,
  Notification,
} from '../types'

import {
  getCurrentEmployee,
  getAllEmployees,
  type ChatEmployee,
} from '../services/chatService'

import { supabase } from '../lib/supabase'

const statusCfg: Record<
  SiteVisit['status'],
  {
    cls: string
    icon: React.ReactNode
  }
> = {
  'Pending Assignment': {
    cls: 'bg-amber-50 text-amber-700',
    icon: <ShieldQuestion size={12} />,
  },
  Scheduled: {
    cls: 'bg-sky-50 text-sky-700',
    icon: <CalendarClock size={12} />,
  },
  Completed: {
    cls: 'bg-emerald-50 text-emerald-700',
    icon: <CheckCircle2 size={12} />,
  },
  Cancelled: {
    cls: 'bg-gray-100 text-gray-600',
    icon: <XCircle size={12} />,
  },
  'No-show': {
    cls: 'bg-red-50 text-red-700',
    icon: <XCircle size={12} />,
  },
}

function dayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)

  return {
    weekday: d.toLocaleDateString(
      'en-IN',
      { weekday: 'short' }
    ),
    day: d.getDate(),
    month: d.toLocaleDateString(
      'en-IN',
      { month: 'short' }
    ),
  }
}

interface SiteVisitsProps {
  role: Role
  visitList: SiteVisit[]
  setVisitList: React.Dispatch<
    React.SetStateAction<SiteVisit[]>
  >
  onAddNotification?: (
    n: Omit<
      Notification,
      'id' | 'timestamp' | 'read'
    >
  ) => void
  currentUserId?: string
}

type DbSiteVisit = {
  id: string
  lead_id: string | null
  employee_id: string | null
  visit_date: string
  visit_time: string | null
  status: string
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function normalizeStatus(
  value: string
): SiteVisit['status'] {
  if (
    value === 'Pending Assignment' ||
    value === 'Scheduled' ||
    value === 'Completed' ||
    value === 'Cancelled' ||
    value === 'No-show'
  ) {
    return value
  }

  return 'Scheduled'
}

export default function SiteVisits({
  role,
  visitList: _visitList,
  setVisitList,
  onAddNotification,
  currentUserId: propUserId,
}: SiteVisitsProps) {
  const {
    leads,
  } = useData()

  const [
    employees,
    setEmployees,
  ] = useState<ChatEmployee[]>([])

  const [
    currentEmployee,
    setCurrentEmployee,
  ] =
    useState<ChatEmployee | null>(
      null
    )

  const [
    visits,
    setVisits,
  ] = useState<SiteVisit[]>([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    showModal,
    setShowModal,
  ] = useState(false)

  const [
    form,
    setForm,
  ] = useState({
    leadId: '',
    projectId: '',
    date: '',
    time: '',
    agentId: '',
    managerId: '',
  })

  const [
    assigningVisitId,
    setAssigningVisitId,
  ] = useState<string | null>(null)

  const [
    pickedAgentId,
    setPickedAgentId,
  ] = useState('')

  const [
    selectedDay,
    setSelectedDay,
  ] = useState<string | null>(null)

  /*
   * ============================================================
   * CURRENT AUTHENTICATED EMPLOYEE + ALL EMPLOYEES
   * ============================================================
   */
  useEffect(() => {
    let active = true

    const loadPeople =
      async () => {
        try {
          const [
            me,
            allEmployees,
          ] =
            await Promise.all([
              getCurrentEmployee(),
              getAllEmployees(),
            ])

          if (!active) return

          setCurrentEmployee(me)
          setEmployees(
            allEmployees
          )
        } catch (err) {
          if (!active) return

          setError(
            err instanceof Error
              ? err.message
              : 'Could not load employee information.'
          )
        }
      }

    void loadPeople()

    return () => {
      active = false
    }
  }, [])

  const currentUserId =
    currentEmployee?.id ||
    propUserId ||
    ''

  /*
   * ============================================================
   * EMPLOYEE HELPERS
   * ============================================================
   */
  const managers =
    employees.filter(
      (e) =>
        e.role === 'manager' &&
        e.status === 'active'
    )

  const myTeamAgents =
    employees.filter(
      (e) =>
        e.role === 'agent' &&
        e.status === 'active' &&
        (
          role === 'manager'
            ? (() => {
              const me =
                employees.find(
                  (x) =>
                    x.id ===
                    currentUserId
                )

              return (
                !me ||
                !me.id ||
                !me.role
              )
                ? false
                : true
            })()
            : true
        )
    )

  /*
   * Use managerId from the actual employee database
   * whenever it exists.
   */
  const managerTeamAgents =
    role === 'manager'
      ? myTeamAgents.filter(
        (agent) =>
          (() => {
            const manager =
              employees.find(
                (e) =>
                  e.id ===
                  currentUserId
              )

            return (
              manager &&
              (
                (
                  agent as ChatEmployee & {
                    manager_id?: string
                  }
                ).manager_id ===
                currentUserId ||
                (
                  agent as ChatEmployee & {
                    managerId?: string
                  }
                ).managerId ===
                currentUserId
              )
            )
          })()
      )
      : myTeamAgents

  /*
   * Some employee objects do not expose manager_id
   * through getAllEmployees(). Therefore, when no team
   * agents are resolved, fall back to agents in the same
   * department/team for the manager.
   */
  const resolvedTeamAgents =
    role === 'manager'
      ? managerTeamAgents.length > 0
        ? managerTeamAgents
        : myTeamAgents.filter(
          (agent) =>
            agent.department ===
            currentEmployee?.department
        )
      : myTeamAgents

  /*
   * ============================================================
   * MAP DATABASE ROW -> UI SITE VISIT
   * ============================================================
   */
  const mapVisit = (
    row: DbSiteVisit
  ): SiteVisit => {
    const lead =
      leads.find(
        (l) =>
          l.id ===
          row.lead_id
      )

    const assignedEmployee =
      employees.find(
        (e) =>
          e.id ===
          row.employee_id
      )

    const status =
      normalizeStatus(
        row.status
      )

    const isPending =
      status ===
      'Pending Assignment'

    return {
      id: row.id,

      leadId:
        row.lead_id || '',

      leadName:
        lead?.name ||
        'Unknown Lead',

      projectName:
        row.location ||
        'Site Visit',

      /*
       * If Admin delegated to manager,
       * employee_id is the manager.
       *
       * Once Manager assigns an agent,
       * employee_id becomes the agent.
       */
      assignedManagerId:
        isPending
          ? row.employee_id ||
          undefined
          : undefined,

      assignedManagerName:
        isPending
          ? assignedEmployee?.name
          : undefined,

      agentId:
        !isPending &&
          assignedEmployee?.role ===
          'agent'
          ? row.employee_id ||
          undefined
          : undefined,

      agentName:
        !isPending &&
          assignedEmployee?.role ===
          'agent'
          ? assignedEmployee.name
          : undefined,

      date:
        row.visit_date,

      time:
        row.visit_time
          ? row.visit_time.slice(
            0,
            5
          )
          : '',

      status,

      outcome:
        row.notes ||
        undefined,
    }
  }

  /*
   * ============================================================
   * LOAD VISITS FROM SUPABASE
   * ============================================================
   */
  const loadVisits =
    async () => {
      const {
        data,
        error: dbError,
      } = await supabase
        .from('site_visits')
        .select(`
          id,
          lead_id,
          employee_id,
          visit_date,
          visit_time,
          status,
          location,
          notes,
          created_at,
          updated_at
        `)
        .order(
          'visit_date',
          {
            ascending: true,
          }
        )
        .order(
          'visit_time',
          {
            ascending: true,
          }
        )

      if (dbError) {
        throw new Error(
          dbError.message
        )
      }

      const mapped =
        ((data ||
          []) as DbSiteVisit[]).map(
            mapVisit
          )

      setVisits(mapped)
      setVisitList(mapped)
    }

  useEffect(() => {
    if (
      employees.length === 0
    ) {
      return
    }

    let active = true

    const run =
      async () => {
        setLoading(true)
        setError('')

        try {
          await loadVisits()
        } catch (err) {
          if (!active) return

          setError(
            err instanceof Error
              ? err.message
              : 'Could not load site visits.'
          )
        } finally {
          if (active) {
            setLoading(
              false
            )
          }
        }
      }

    void run()

    return () => {
      active = false
    }
  }, [
    employees,
    leads,
  ])

  /*
   * ============================================================
   * REALTIME SITE VISITS
   * ============================================================
   */
  useEffect(() => {
    if (
      employees.length === 0
    ) {
      return
    }

    const channel =
      supabase
        .channel(
          'site-visits-realtime'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'site_visits',
          },
          () => {
            void loadVisits()
          }
        )
        .subscribe()

    return () => {
      void supabase.removeChannel(
        channel
      )
    }
  }, [
    employees,
    leads,
  ])

  /*
   * ============================================================
   * FILTER VISITS FOR CURRENT ROLE
   * ============================================================
   */
  const scoped =
    role === 'agent'
      ? visits.filter(
        (v) =>
          v.agentId ===
          currentUserId ||
          (
            v.status ===
            'Scheduled' &&
            leads.some(
              (l) =>
                l.id ===
                v.leadId &&
                l.assignedTo ===
                currentUserId
            )
          )
      )
      : role === 'manager'
        ? visits.filter(
          (v) =>
            v.assignedManagerId ===
              currentUserId ||
              v.agentId
              ? resolvedTeamAgents.some(
                (a) =>
                  a.id ===
                  v.agentId
              )
              : false
        )
        : visits

  const sorted =
    [...scoped].sort(
      (a, b) =>
        (
          a.date +
          a.time
        ).localeCompare(
          b.date +
          b.time
        )
    )

  const pendingForMe =
    role === 'manager'
      ? visits.filter(
        (v) =>
          v.status ===
          'Pending Assignment' &&
          v.assignedManagerId ===
          currentUserId
      )
      : []

  /*
   * ============================================================
   * DATE STRIP
   * ============================================================
   */
  const days = useMemo(
    () => {
      const unique =
        Array.from(
          new Set(
            sorted.map(
              (v) =>
                v.date
            )
          )
        ).sort()

      return unique.map(
        (date) => ({
          date,
          count:
            sorted.filter(
              (v) =>
                v.date ===
                date
            ).length,
        })
      )
    },
    [sorted]
  )

  const visible =
    selectedDay
      ? sorted.filter(
        (v) =>
          v.date ===
          selectedDay
      )
      : sorted

  /*
   * ============================================================
   * ELIGIBLE LEADS
   * ============================================================
   */
  const eligibleLeads =
    role === 'agent'
      ? leads.filter(
        (l) =>
          l.assignedTo ===
          currentUserId
      )
      : leads

  /*
   * ============================================================
   * SCHEDULE VISIT
   * ============================================================
   */
  const schedule =
    async () => {
      const lead =
        leads.find(
          (l) =>
            l.id ===
            form.leadId
        )

      const project =
        projects.find(
          (p) =>
            p.id ===
            form.projectId
        )

      if (
        !lead ||
        !project ||
        !form.date ||
        !form.time
      ) {
        return
      }

      if (
        !currentUserId
      ) {
        setError(
          'Could not identify the logged-in employee.'
        )
        return
      }

      setSaving(true)
      setError('')

      let employeeId:
        | string
        | null = null

      let status:
        | SiteVisit['status'] =
        'Scheduled'

      /*
       * ADMIN:
       * employee_id = manager
       * status = Pending Assignment
       */
      if (role === 'admin') {
        if (
          !form.managerId
        ) {
          setSaving(false)
          return
        }

        employeeId =
          form.managerId

        status =
          'Pending Assignment'
      }

      /*
       * MANAGER:
       * employee_id = agent
       */
      else if (
        role === 'manager'
      ) {
        if (
          !form.agentId
        ) {
          setSaving(false)
          return
        }

        employeeId =
          form.agentId
      }

      /*
       * AGENT:
       * employee_id = lead's assigned agent
       */
      else {
        employeeId =
          lead.assignedTo ||
          currentUserId
      }

      const {
        data,
        error: dbError,
      } = await supabase
        .from('site_visits')
        .insert({
          id:
            crypto.randomUUID(),

          lead_id:
            lead.id,

          employee_id:
            employeeId,

          visit_date:
            form.date,

          visit_time:
            form.time,

          status,

          location:
            project.name,

          notes: null,
        })
        .select(`
          id,
          lead_id,
          employee_id,
          visit_date,
          visit_time,
          status,
          location,
          notes,
          created_at,
          updated_at
        `)
        .single()

      if (
        dbError ||
        !data
      ) {
        setError(
          dbError?.message ||
          'Could not save the site visit.'
        )

        setSaving(false)
        return
      }

      const newVisit =
        mapVisit(
          data as DbSiteVisit
        )

      setVisits(
        (prev) => [
          ...prev,
          newVisit,
        ]
      )

      setVisitList(
        (prev) => [
          ...prev,
          newVisit,
        ]
      )

      if (
        role === 'admin'
      ) {
        const manager =
          employees.find(
            (e) =>
              e.id ===
              form.managerId
          )

        onAddNotification?.({
          type:
            'site-visit',
          title:
            'Site Visit Delegated',
          message:
            `Sent to ${manager?.name || 'manager'} to assign an agent — ${lead.name} at ${project.name} on ${form.date}`,
          priority:
            'low',
          forUserId:
            form.managerId,
        })
      } else if (
        role === 'manager'
      ) {
        const agent =
          employees.find(
            (e) =>
              e.id ===
              form.agentId
          )

        onAddNotification?.({
          type:
            'site-visit',
          title:
            'Site Visit Scheduled',
          message:
            `${agent?.name || 'Agent'} assigned to ${lead.name} — ${project.name} on ${form.date} at ${form.time}`,
          priority:
            'low',
          forUserId:
            form.agentId,
        })
      } else {
        onAddNotification?.({
          type:
            'site-visit',
          title:
            'Site Visit Scheduled',
          message:
            `${lead.name} — ${project.name} on ${form.date} at ${form.time}`,
          priority:
            'low',
          forUserId:
            currentUserId,
        })
      }

      setForm({
        leadId: '',
        projectId: '',
        date: '',
        time: '',
        agentId: '',
        managerId: '',
      })

      setShowModal(false)
      setSaving(false)
    }

  /*
   * ============================================================
   * ASSIGN AGENT
   * ============================================================
   */
  const assignAgent =
    async (
      visitId: string
    ) => {
      if (
        !pickedAgentId
      ) {
        return
      }

      const agent =
        employees.find(
          (e) =>
            e.id ===
            pickedAgentId
        )

      const visit =
        visits.find(
          (v) =>
            v.id ===
            visitId
        )

      if (
        !agent ||
        !visit
      ) {
        return
      }

      setSaving(true)
      setError('')

      const {
        data,
        error: dbError,
      } = await supabase
        .from('site_visits')
        .update({
          employee_id:
            pickedAgentId,

          status:
            'Scheduled',
        })
        .eq(
          'id',
          visitId
        )
        .select(`
          id,
          lead_id,
          employee_id,
          visit_date,
          visit_time,
          status,
          location,
          notes,
          created_at,
          updated_at
        `)
        .single()

      if (
        dbError ||
        !data
      ) {
        setError(
          dbError?.message ||
          'Could not assign the agent.'
        )

        setSaving(false)
        return
      }

      const updatedVisit =
        mapVisit(
          data as DbSiteVisit
        )

      setVisits(
        (prev) =>
          prev.map(
            (v) =>
              v.id ===
                visitId
                ? updatedVisit
                : v
          )
      )

      setVisitList(
        (prev) =>
          prev.map(
            (v) =>
              v.id ===
                visitId
                ? updatedVisit
                : v
          )
      )

      onAddNotification?.({
        type:
          'site-visit',
        title:
          'Site Visit Assigned',
        message:
          `${agent.name} assigned to ${visit.leadName} — ${visit.projectName} on ${visit.date}`,
        priority:
          'low',
        forUserId:
          pickedAgentId,
      })

      setAssigningVisitId(
        null
      )

      setPickedAgentId(
        ''
      )

      setSaving(false)
    }

  return (
    <div className="space-y-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex items-center justify-between flex-wrap gap-3">

        <div>

          <h2 className="font-serif text-lg font-semibold text-foreground">
            Site Visits
          </h2>

          <p className="text-xs text-muted-foreground">

            {role === 'agent'
              ? 'Your scheduled and completed visits'
              : role === 'manager'
                ? "Your team's site visit schedule"
                : 'Company-wide site visit schedule'}

          </p>

        </div>

        <button
          onClick={() =>
            setShowModal(true)
          }
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor:
              '#C9A96E',
            color:
              '#1C2B4A',
          }}
        >
          <Plus size={15} />
          Schedule Visit
        </button>

      </div>

      {/* ERROR */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ======================================================
          MANAGER PENDING ASSIGNMENTS
      ====================================================== */}

      {pendingForMe.length >
        0 && (
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor:
                '#FCD34D',
              backgroundColor:
                '#FFFBEB',
            }}
          >

            <p className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-1.5">

              <ShieldQuestion
                size={15}
              />

              {pendingForMe.length}{' '}
              visit
              {pendingForMe.length >
                1
                ? 's'
                : ''}{' '}
              from Admin need
              {pendingForMe.length ===
                1
                ? 's'
                : ''}{' '}
              an agent assigned

            </p>

            <div className="space-y-2">

              {pendingForMe.map(
                (v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 flex-wrap bg-white rounded-lg p-3"
                  >

                    <div className="flex-1 min-w-40">

                      <p className="text-sm font-semibold text-foreground">
                        {v.leadName}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {v.projectName}{' '}
                        · {v.date}{' '}
                        at {v.time}
                      </p>

                    </div>

                    {assigningVisitId ===
                      v.id ? (
                      <div className="flex items-center gap-2">

                        <select
                          value={
                            pickedAgentId
                          }
                          onChange={(
                            e
                          ) =>
                            setPickedAgentId(
                              e.target
                                .value
                            )
                          }
                          disabled={
                            saving
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none"
                        >

                          <option value="">
                            Select agent…
                          </option>

                          {resolvedTeamAgents.map(
                            (a) => (
                              <option
                                key={
                                  a.id
                                }
                                value={
                                  a.id
                                }
                              >
                                {a.name}
                              </option>
                            )
                          )}

                        </select>

                        <button
                          onClick={() =>
                            void assignAgent(
                              v.id
                            )
                          }
                          disabled={
                            !pickedAgentId ||
                            saving
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                          style={{
                            backgroundColor:
                              '#1C2B4A',
                            color:
                              '#FAF8F5',
                            opacity:
                              pickedAgentId &&
                                !saving
                                ? 1
                                : 0.5,
                          }}
                        >

                          {saving && (
                            <Loader2
                              size={
                                12
                              }
                              className="animate-spin"
                            />
                          )}

                          Confirm

                        </button>

                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAssigningVisitId(
                            v.id
                          )
                          setPickedAgentId(
                            ''
                          )
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          backgroundColor:
                            '#1C2B4A',
                          color:
                            '#FAF8F5',
                        }}
                      >
                        <UserPlus
                          size={13}
                        />
                        Assign Agent
                      </button>
                    )}

                  </div>
                )
              )}

            </div>

          </div>
        )}

      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading ? (
        <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">

          <Loader2
            size={28}
            className="mx-auto mb-3 animate-spin text-muted-foreground"
          />

          <p className="text-sm text-muted-foreground">
            Loading site visits…
          </p>

        </div>
      ) : (
        <>
          {/* ==================================================
              DAY STRIP
          ================================================== */}

          <div className="flex gap-2 overflow-x-auto pb-1">

            <button
              onClick={() =>
                setSelectedDay(
                  null
                )
              }
              className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all"
              style={{
                backgroundColor:
                  selectedDay ===
                    null
                    ? '#1C2B4A'
                    : '#fff',
                color:
                  selectedDay ===
                    null
                    ? '#FAF8F5'
                    : '#7A7065',
                borderColor:
                  selectedDay ===
                    null
                    ? '#1C2B4A'
                    : '#E5DFD5',
              }}
            >
              All Upcoming
            </button>

            {days.map(
              ({
                date,
                count,
              }) => {
                const {
                  weekday,
                  day,
                  month,
                } =
                  dayLabel(
                    date
                  )

                const active =
                  selectedDay ===
                  date

                return (
                  <button
                    key={date}
                    onClick={() =>
                      setSelectedDay(
                        active
                          ? null
                          : date
                      )
                    }
                    className="shrink-0 w-16 py-2 rounded-xl text-center border transition-all"
                    style={{
                      backgroundColor:
                        active
                          ? '#1C2B4A'
                          : '#fff',
                      borderColor:
                        active
                          ? '#1C2B4A'
                          : '#E5DFD5',
                    }}
                  >

                    <p
                      className="text-[10px] font-medium"
                      style={{
                        color:
                          active
                            ? 'rgba(250,248,245,0.6)'
                            : '#7A7065',
                      }}
                    >
                      {weekday}
                    </p>

                    <p
                      className="text-lg font-bold"
                      style={{
                        color:
                          active
                            ? '#FAF8F5'
                            : '#1C2B4A',
                      }}
                    >
                      {day}
                    </p>

                    <p
                      className="text-[10px]"
                      style={{
                        color:
                          active
                            ? 'rgba(250,248,245,0.6)'
                            : '#7A7065',
                      }}
                    >
                      {month}{' '}
                      · {count}
                    </p>

                  </button>
                )
              }
            )}

          </div>

          {/* ==================================================
              VISIT LIST
          ================================================== */}

          <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">

            {visible.map(
              (v) => {
                const cfg =
                  statusCfg[
                  v.status
                  ]

                return (
                  <div
                    key={v.id}
                    className="p-4 flex items-center gap-4 flex-wrap"
                  >

                    <div
                      className="w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0"
                      style={{
                        backgroundColor:
                          'rgba(28,43,74,0.08)',
                      }}
                    >

                      <span className="text-[10px] font-medium text-primary uppercase">
                        {
                          dayLabel(
                            v.date
                          ).month
                        }
                      </span>

                      <span className="text-sm font-bold text-primary leading-none">
                        {
                          dayLabel(
                            v.date
                          ).day
                        }
                      </span>

                    </div>

                    <div className="flex-1 min-w-48">

                      <p className="text-sm font-semibold text-foreground">
                        {v.leadName}
                      </p>

                      <div className="flex items-center gap-3 mt-1 flex-wrap">

                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin
                            size={
                              11
                            }
                          />
                          {
                            v.projectName
                          }
                        </span>

                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock
                            size={
                              11
                            }
                          />
                          {v.time}
                        </span>

                        {role !==
                          'agent' &&
                          v.agentName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User
                                size={
                                  11
                                }
                              />
                              {
                                v.agentName
                              }
                            </span>
                          )}

                        {v.status ===
                          'Pending Assignment' &&
                          v.assignedManagerName && (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <User
                                size={
                                  11
                                }
                              />
                              Awaiting{' '}
                              {
                                v.assignedManagerName
                              }
                            </span>
                          )}

                      </div>

                      {v.outcome && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic">
                          "{v.outcome}"
                        </p>
                      )}

                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}
                    >
                      {cfg.icon}
                      {v.status}
                    </span>

                  </div>
                )
              }
            )}

            {visible.length ===
              0 && (
                <p className="text-center py-10 text-sm text-muted-foreground">
                  No site visits{' '}
                  {selectedDay
                    ? 'on this day'
                    : 'scheduled'}
                </p>
              )}

          </div>
        </>
      )}

      {/* ======================================================
          SCHEDULE MODAL
      ====================================================== */}

      <Modal
        open={showModal}
        onClose={() =>
          !saving &&
          setShowModal(
            false
          )
        }
        title="Schedule Site Visit"
      >

        <div className="space-y-4">

          {/* LEAD */}

          <div>

            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Lead
            </label>

            <select
              value={
                form.leadId
              }
              disabled={
                saving
              }
              onChange={(
                e
              ) =>
                setForm({
                  ...form,
                  leadId:
                    e.target
                      .value,
                })
              }
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >

              <option value="">
                Select a lead
              </option>

              {eligibleLeads.map(
                (l) => (
                  <option
                    key={l.id}
                    value={l.id}
                  >
                    {l.name} —{' '}
                    {l.location}
                  </option>
                )
              )}

            </select>

          </div>

          {/* PROJECT */}

          <div>

            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Project
            </label>

            <select
              value={
                form.projectId
              }
              disabled={
                saving
              }
              onChange={(
                e
              ) =>
                setForm({
                  ...form,
                  projectId:
                    e.target
                      .value,
                })
              }
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >

              <option value="">
                Select a project
              </option>

              {projects.map(
                (p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.name}
                  </option>
                )
              )}

            </select>

          </div>

          {/* DATE/TIME */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>

              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Date
              </label>

              <input
                type="date"
                value={
                  form.date
                }
                disabled={
                  saving
                }
                onChange={(
                  e
                ) =>
                  setForm({
                    ...form,
                    date:
                      e.target
                        .value,
                  })
                }
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />

            </div>

            <div>

              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Time
              </label>

              <input
                type="time"
                value={
                  form.time
                }
                disabled={
                  saving
                }
                onChange={(
                  e
                ) =>
                  setForm({
                    ...form,
                    time:
                      e.target
                        .value,
                  })
                }
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />

            </div>

          </div>

          {/* ADMIN -> MANAGER */}

          {role ===
            'admin' && (
              <div>

                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Assign to Manager (they'll pick the agent)
                </label>

                <select
                  value={
                    form.managerId
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    e
                  ) =>
                    setForm({
                      ...form,
                      managerId:
                        e.target
                          .value,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none"
                >

                  <option value="">
                    Select a manager
                  </option>

                  {managers.map(
                    (m) => (
                      <option
                        key={m.id}
                        value={m.id}
                      >
                        {m.name}
                      </option>
                    )
                  )}

                </select>

              </div>
            )}

          {/* MANAGER -> AGENT */}

          {role ===
            'manager' && (
              <div>

                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Assign to Agent
                </label>

                <select
                  value={
                    form.agentId
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    e
                  ) =>
                    setForm({
                      ...form,
                      agentId:
                        e.target
                          .value,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none"
                >

                  <option value="">
                    Select an agent
                  </option>

                  {resolvedTeamAgents.map(
                    (a) => (
                      <option
                        key={a.id}
                        value={a.id}
                      >
                        {a.name}
                      </option>
                    )
                  )}

                </select>

              </div>
            )}

          {/* BUTTONS */}

          <div className="flex gap-3 pt-2">

            <button
              onClick={() =>
                setShowModal(
                  false
                )
              }
              disabled={
                saving
              }
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={() =>
                void schedule()
              }
              disabled={
                saving ||
                !form.leadId ||
                !form.projectId ||
                !form.date ||
                !form.time ||
                (role ===
                  'admin' &&
                  !form.managerId) ||
                (role ===
                  'manager' &&
                  !form.agentId)
              }
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity flex items-center justify-center gap-2"
              style={{
                backgroundColor:
                  '#1C2B4A',
                color:
                  '#FAF8F5',
                opacity:
                  saving ||
                    !form.leadId ||
                    !form.projectId ||
                    !form.date ||
                    !form.time ||
                    (role ===
                      'admin' &&
                      !form.managerId) ||
                    (role ===
                      'manager' &&
                      !form.agentId)
                    ? 0.5
                    : 1,
              }}
            >

              {saving && (
                <Loader2
                  size={
                    14
                  }
                  className="animate-spin"
                />
              )}

              {saving
                ? 'Saving…'
                : 'Schedule'}

            </button>

          </div>

        </div>

      </Modal>
    </div>
  )
}