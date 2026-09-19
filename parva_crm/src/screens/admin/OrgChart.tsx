import { useEffect, useState } from 'react'
import { useData } from '../../contexts/DataContext'
import { supabase } from '../../lib/supabase'
import {
  Mail,
  Phone,
  Search,
  Calendar,
  Briefcase,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { WorkloadBadge } from '../../components/ui/Badge'
import type { Role, Group, Employee } from '../../types'
import {
  getWorkloadStatus,
  getCapacityPct,
} from '../../utils/aiAssignment'

const roleColors: Record<
  Role,
  { bg: string; text: string; border: string }
> = {
  admin: {
    bg: '#1C2B4A',
    text: '#FAF8F5',
    border: '#1C2B4A',
  },
  manager: {
    bg: 'rgba(201,169,110,0.12)',
    text: '#1C2B4A',
    border: '#C9A96E',
  },
  agent: {
    bg: '#F5F2EC',
    text: '#1C2B4A',
    border: '#E5DFD5',
  },
}

const roleLabels: Record<Role, string> = {
  admin: 'Super Admin',
  manager: 'Sales Manager',
  agent: 'CRM Agent',
}

type OrgEmployee = Employee & {
  officeName?: string | null
}

type DbEmployee = {
  id: string
  employee_code: string | null
  name: string
  email: string | null
  phone: string | null
  role: string
  department: string | null
  designation: string | null
  status: string
  manager_id: string | null
  office_id: string | null
  offices?: {
    id: string
    name: string
  } | null
}

function mapDbEmployee(row: DbEmployee): OrgEmployee {
  const role: Role =
    row.role === 'admin' ||
      row.role === 'manager' ||
      row.role === 'agent'
      ? row.role
      : 'manager'

  const officeName = row.offices?.name ?? null

  return {
    id: row.id,
    employeeCode: row.employee_code ?? '',
    name: row.name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    role,
    department: row.department ?? '',
    designation: row.designation ?? '',
    status:
      row.status === 'inactive'
        ? 'inactive'
        : row.status === 'on-leave'
          ? 'on-leave'
          : 'active',
    office:
      officeName === 'Dubai'
        ? ('Dubai' as Employee['office'])
        : officeName === 'Bangalore'
          ? ('Bangalore' as Employee['office'])
          : (officeName as Employee['office']),
    team: row.department || 'Sales',
    managerId: row.manager_id ?? undefined,

    // These fields are not stored in employees.
    // They remain safe defaults for the existing UI.
    joinDate: '—',
    capacityLimit: 0,
    leadsAssigned: 0,
    conversions: 0,
    responseTime: '—',
  }
}

function EmployeeCard({
  emp,
  size = 'normal',
  onClick,
  liveCount,
}: {
  emp: OrgEmployee
  size?: 'large' | 'normal' | 'small'
  onClick?: () => void
  liveCount?: number
}) {
  const colors =
    roleColors[emp.role] || roleColors.manager

  const isAgent = emp.role === 'agent'

  const leadsAssigned =
    liveCount !== undefined
      ? liveCount
      : emp.leadsAssigned || 0

  const enrichedEmp = {
    ...emp,
    leadsAssigned,
  } as Employee

  const workloadStatus = isAgent
    ? getWorkloadStatus(enrichedEmp)
    : null

  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-xl border shadow-sm p-4 text-center transition-all hover:shadow-md hover:-translate-y-0.5 relative"
      style={{
        borderColor: colors.border,
      }}
    >
      {isAgent && (
        <span
          className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full"
          style={{
            backgroundColor:
              workloadStatus === 'overloaded'
                ? '#DC2626'
                : workloadStatus === 'high'
                  ? '#F59E0B'
                  : '#10B981',
          }}
        />
      )}

      <div
        className="mx-auto rounded-full flex items-center justify-center font-semibold font-serif mb-3"
        style={{
          width:
            size === 'large'
              ? 56
              : size === 'small'
                ? 36
                : 44,
          height:
            size === 'large'
              ? 56
              : size === 'small'
                ? 36
                : 44,
          fontSize:
            size === 'large'
              ? 20
              : size === 'small'
                ? 14
                : 16,
          backgroundColor: colors.bg,
          color: colors.text,
        }}
      >
        {emp.name
          .split(' ')
          .map((n) => n[0])
          .join('')}
      </div>

      <p
        className={`font-semibold text-foreground ${size === 'small'
            ? 'text-xs'
            : 'text-sm'
          }`}
      >
        {emp.name}
      </p>

      <p
        className={`text-muted-foreground mt-0.5 ${size === 'small'
            ? 'text-[10px]'
            : 'text-xs'
          }`}
      >
        {roleLabels[emp.role]}
      </p>

      {size !== 'small' && (
        <div className="mt-2 pt-2 border-t border-border space-y-0.5">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Mail size={10} />
            {emp.email || 'No email'}
          </p>

          <p className="text-[10px] font-medium text-accent">
            {emp.department ||
              emp.team ||
              'Sales'}
          </p>

          {isAgent && (
            <p className="text-xs font-medium text-muted-foreground">
              {leadsAssigned} leads
            </p>
          )}
        </div>
      )}
    </button>
  )
}

interface OrgChartProps {
  groupList?: Group[]
  onCreateGroup?: (g: Group) => void
  onNavigate?: (
    screen: string,
    params?: Record<string, string>
  ) => void
}

export default function OrgChart({
  groupList = [],
  onCreateGroup,
  onNavigate,
}: OrgChartProps) {
  const { leads } = useData()

  const [employees, setEmployees] =
    useState<OrgEmployee[]>([])

  const [loadingEmployees, setLoadingEmployees] =
    useState(true)

  const [employeeError, setEmployeeError] =
    useState('')

  const [tab, setTab] =
    useState<'chart' | 'directory'>('chart')

  const [search, setSearch] =
    useState('')

  const [selectedId, setSelectedId] =
    useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadEmployees() {
      setLoadingEmployees(true)
      setEmployeeError('')

      const {
        data,
        error,
      } = await supabase
        .from('employees')
        .select(`
          id,
          employee_code,
          name,
          email,
          phone,
          role,
          department,
          designation,
          status,
          manager_id,
          office_id,
          offices (
            id,
            name
          )
        `)
        .neq('status', 'inactive')
        .order('name', {
          ascending: true,
        })

      if (!active) return

      if (error) {
        setEmployeeError(
          error.message ||
          'Could not load organization data.'
        )
        setEmployees([])
        setLoadingEmployees(false)
        return
      }

      const mapped =
        ((data || []) as DbEmployee[]).map(
          mapDbEmployee
        )

      setEmployees(mapped)
      setLoadingEmployees(false)
    }

    loadEmployees()

    return () => {
      active = false
    }
  }, [])

  const selected =
    employees.find(
      (e) => e.id === selectedId
    ) || null

  const selectedManager =
    selected?.managerId
      ? employees.find(
        (e) =>
          e.id === selected.managerId
      )
      : null

  const selectedDirectReports =
    selected
      ? employees.filter(
        (e) =>
          e.managerId === selected.id
      )
      : []

  const liveLeads = leads.filter(
    (l) => l.status !== 'Cancelled'
  )

  const leadCountByEmp =
    Object.fromEntries(
      employees.map((e) => [
        e.id,
        liveLeads.filter(
          (l) =>
            l.assignedTo === e.id
        ).length,
      ])
    )

  const admin =
    employees.find(
      (e) => e.role === 'admin'
    ) || null

  const managers =
    employees.filter(
      (e) => e.role === 'manager'
    )

  const bangaloreManagers =
    managers.filter(
      (m) => m.office === 'Bangalore'
    )

  const dubaiManagers =
    managers.filter(
      (m) => m.office === 'Dubai'
    )

  const otherManagers =
    managers.filter(
      (m) =>
        m.office !== 'Bangalore' &&
        m.office !== 'Dubai'
    )

  const agentsByManager: Record<
    string,
    OrgEmployee[]
  > = {}

  managers.forEach((manager) => {
    agentsByManager[manager.id] =
      employees.filter(
        (e) =>
          e.role === 'agent' &&
          e.managerId === manager.id
      )
  })

  const filtered =
    employees.filter(
      (e) =>
        e.name
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        e.email
          .toLowerCase()
          .includes(search.toLowerCase())
    )

  const messageTeam = () => {
    if (
      !selected ||
      selectedDirectReports.length === 0 ||
      !admin
    ) {
      return
    }

    const memberIds = Array.from(
      new Set([
        admin.id,
        selected.id,
        ...selectedDirectReports.map(
          (r) => r.id
        ),
      ])
    )

    const existing =
      groupList.find(
        (g) =>
          g.memberIds.length ===
          memberIds.length &&
          memberIds.every((id) =>
            g.memberIds.includes(id)
          )
      )

    if (existing) {
      onNavigate?.(
        'messages',
        {
          groupId: existing.id,
        }
      )
      return
    }

    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name: `${selected.name.split(' ')[0]}'s Team`,
      memberIds,
      createdBy: admin.id,
      createdAt:
        new Date()
          .toISOString()
          .slice(0, 10),
    }

    onCreateGroup?.(newGroup)

    onNavigate?.(
      'messages',
      {
        groupId: newGroup.id,
      }
    )
  }

  if (loadingEmployees) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
          <div className="mx-auto w-6 h-6 rounded-full border-2 border-border border-t-accent animate-spin" />
          <p className="text-sm text-muted-foreground mt-4">
            Loading organization...
          </p>
        </div>
      </div>
    )
  }

  if (employeeError) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center">
          <h2 className="font-serif text-lg text-foreground">
            Could not load organization
          </h2>

          <p className="text-sm text-red-500 mt-2">
            {employeeError}
          </p>
        </div>
      </div>
    )
  }

  if (!admin) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center">
          <h2 className="font-serif text-lg text-foreground">
            Organization data unavailable
          </h2>

          <p className="text-sm text-muted-foreground mt-2">
            No Super Admin employee was found.
          </p>
        </div>
      </div>
    )
  }

  const renderManager = (
    manager: OrgEmployee
  ) => (
    <div
      key={manager.id}
      className="flex flex-col items-center gap-3"
    >
      <div className="w-px h-6 bg-border" />

      <div className="w-48">
        <EmployeeCard
          emp={manager}
          onClick={() =>
            setSelectedId(manager.id)
          }
          liveCount={
            leadCountByEmp[manager.id]
          }
        />
      </div>

      {agentsByManager[manager.id]
        ?.length > 0 && (
          <>
            <div className="w-px h-6 bg-border" />

            <div className="flex gap-3">
              {agentsByManager[
                manager.id
              ].map((agent) => (
                <div
                  key={agent.id}
                  className="w-36"
                >
                  <EmployeeCard
                    emp={agent}
                    size="small"
                    onClick={() =>
                      setSelectedId(
                        agent.id
                      )
                    }
                    liveCount={
                      leadCountByEmp[
                      agent.id
                      ]
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
    </div>
  )

  return (
    <div className="space-y-6">

      <div className="bg-card rounded-xl border border-border shadow-sm">

        {/* TABS */}
        <div className="border-b border-border px-5 flex gap-6">

          {(['chart', 'directory'] as const).map(
            (t) => (
              <button
                key={t}
                onClick={() =>
                  setTab(t)
                }
                className="py-4 text-sm font-medium capitalize transition-colors border-b-2 -mb-px"
                style={{
                  borderColor:
                    tab === t
                      ? '#C9A96E'
                      : 'transparent',
                  color:
                    tab === t
                      ? '#1C2B4A'
                      : '#7A7065',
                }}
              >
                {t === 'chart'
                  ? 'Org Chart'
                  : 'People Directory'}
              </button>
            )
          )}

        </div>

        {/* ORG CHART */}
        {tab === 'chart' && (
          <div className="p-4 sm:p-8 overflow-x-auto">

            {/* CHAITRA */}
            <div className="flex justify-center mb-6">
              <div className="w-56">
                <EmployeeCard
                  emp={admin}
                  size="large"
                  onClick={() =>
                    setSelectedId(
                      admin.id
                    )
                  }
                  liveCount={
                    leadCountByEmp[
                    admin.id
                    ]
                  }
                />
              </div>
            </div>

            <div className="flex justify-center mb-4">
              <div className="w-px h-8 bg-border" />
            </div>

            {/* INDIA */}
            {bangaloreManagers.length >
              0 && (
                <div className="mb-8">

                  <div className="flex items-center gap-2 mb-4 justify-center">

                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700">
                      🇮🇳 India
                    </span>

                  </div>

                  <div className="flex gap-6 justify-center flex-wrap">

                    {bangaloreManagers.map(
                      renderManager
                    )}

                  </div>

                </div>
              )}

            {/* DUBAI */}
            {dubaiManagers.length >
              0 && (
                <div className="mb-8">

                  <div className="flex items-center gap-2 mb-4 justify-center">

                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                      🇦🇪 Dubai
                    </span>

                  </div>

                  <div className="flex gap-6 justify-center flex-wrap">

                    {dubaiManagers.map(
                      renderManager
                    )}

                  </div>

                </div>
              )}

            {/* OTHER OFFICES */}
            {otherManagers.length >
              0 && (
                <div className="mb-8">

                  <div className="flex gap-6 justify-center flex-wrap">

                    {otherManagers.map(
                      renderManager
                    )}

                  </div>

                </div>
              )}

          </div>
        )}

        {/* DIRECTORY */}
        {tab === 'directory' && (
          <div>

            <div className="p-5 border-b border-border">

              <div className="relative max-w-sm">

                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search employees…"
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />

              </div>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>
                  <tr className="border-b border-border">

                    {[
                      'Employee',
                      'Role',
                      'Team',
                      'Contact',
                      'Join Date',
                      'Status',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}

                  </tr>
                </thead>

                <tbody>

                  {filtered.map(
                    (emp) => {

                      const colors =
                        roleColors[
                        emp.role
                        ] ||
                        roleColors.manager

                      return (
                        <tr
                          key={emp.id}
                          onClick={() =>
                            setSelectedId(
                              emp.id
                            )
                          }
                          className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        >

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-3">

                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
                                style={{
                                  backgroundColor:
                                    colors.bg,
                                  color:
                                    colors.text,
                                  border:
                                    `1px solid ${colors.border}`,
                                }}
                              >
                                {emp.name
                                  .split(' ')
                                  .map(
                                    (n) =>
                                      n[0]
                                  )
                                  .join('')}
                              </div>

                              <div>

                                <p className="text-sm font-semibold text-foreground">
                                  {emp.name}
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  {emp.department ||
                                    'Sales'}
                                </p>

                              </div>

                            </div>

                          </td>

                          <td className="px-5 py-4">

                            <span
                              className="text-xs font-medium px-2.5 py-1 rounded-full"
                              style={{
                                backgroundColor:
                                  colors.bg,
                                color:
                                  emp.role ===
                                    'admin'
                                    ? '#FAF8F5'
                                    : colors.text,
                              }}
                            >
                              {
                                roleLabels[
                                emp.role
                                ]
                              }
                            </span>

                          </td>

                          <td className="px-5 py-4 text-sm text-muted-foreground">
                            {emp.team ||
                              emp.department ||
                              'Sales'}
                          </td>

                          <td className="px-5 py-4">

                            <div className="space-y-0.5">

                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail
                                  size={11}
                                />
                                {emp.email ||
                                  '—'}
                              </p>

                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone
                                  size={11}
                                />
                                {emp.phone ||
                                  '—'}
                              </p>

                            </div>

                          </td>

                          <td className="px-5 py-4 text-sm text-muted-foreground">
                            —
                          </td>

                          <td className="px-5 py-4">

                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${emp.status ===
                                  'active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : emp.status ===
                                    'on-leave'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                            >
                              {emp.status ===
                                'active'
                                ? 'Active'
                                : emp.status ===
                                  'on-leave'
                                  ? 'On Leave'
                                  : 'Inactive'}
                            </span>

                          </td>

                        </tr>
                      )
                    }
                  )}

                </tbody>

              </table>

            </div>

          </div>
        )}

      </div>

      {/* EMPLOYEE DETAILS */}
      <Modal
        open={!!selected}
        onClose={() =>
          setSelectedId(null)
        }
        title="Employee Details"
      >

        {selected && (
          <div className="space-y-5">

            <div className="flex items-center gap-4">

              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-semibold font-serif shrink-0"
                style={{
                  backgroundColor:
                    roleColors[
                      selected.role
                    ].bg,
                  color:
                    roleColors[
                      selected.role
                    ].text,
                }}
              >
                {selected.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>

              <div>

                <h3 className="font-serif text-xl font-semibold text-foreground">
                  {selected.name}
                </h3>

                <p
                  className="text-xs font-semibold mt-0.5"
                  style={{
                    color: '#C9A96E',
                  }}
                >
                  {selected.department ||
                    (selected.role ===
                      'admin'
                      ? 'Director'
                      : roleLabels[
                      selected.role
                      ])}
                </p>

                <div className="flex items-center gap-2 mt-1.5">

                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor:
                        roleColors[
                          selected.role
                        ].bg,
                      color:
                        selected.role ===
                          'admin'
                          ? '#FAF8F5'
                          : roleColors[
                            selected.role
                          ].text,
                    }}
                  >
                    {roleLabels[
                      selected.role
                    ]}
                  </span>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${selected.status ===
                        'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                      }`}
                  >
                    {selected.status ===
                      'active'
                      ? 'Active'
                      : selected.status ===
                        'on-leave'
                        ? 'On Leave'
                        : 'Inactive'}
                  </span>

                </div>

              </div>

            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl"
              style={{
                backgroundColor:
                  '#F5F2EC',
              }}
            >

              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Mail size={13} />
                  <span className="text-xs">
                    Email
                  </span>
                </div>

                <p className="text-sm font-medium text-foreground break-all">
                  {selected.email ||
                    '—'}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Phone size={13} />
                  <span className="text-xs">
                    Phone
                  </span>
                </div>

                <p className="text-sm font-medium text-foreground">
                  {selected.phone ||
                    '—'}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Briefcase size={13} />
                  <span className="text-xs">
                    Department / Team
                  </span>
                </div>

                <p className="text-sm font-medium text-foreground">
                  {selected.department ||
                    '—'}{' '}
                  ·{' '}
                  {selected.team ||
                    'Sales'}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Calendar size={13} />
                  <span className="text-xs">
                    Joined
                  </span>
                </div>

                <p className="text-sm font-medium text-foreground">
                  —
                </p>
              </div>

            </div>

            {selected.role ===
              'agent' && (
                <div className="grid grid-cols-2 gap-4">

                  <div className="p-4 rounded-xl border border-border text-center">

                    <Target
                      size={16}
                      className="mx-auto mb-1.5 text-primary"
                    />

                    <p className="font-serif text-xl font-semibold text-foreground">

                      {leadCountByEmp[
                        selected.id
                      ] ?? 0}

                    </p>

                    <p className="text-xs text-muted-foreground">
                      Leads Assigned
                    </p>

                    <div className="mt-1">

                      <WorkloadBadge
                        status={getWorkloadStatus(
                          {
                            ...selected,
                            leadsAssigned:
                              leadCountByEmp[
                              selected.id
                              ] ?? 0,
                          } as Employee
                        )}
                        pct={getCapacityPct(
                          {
                            ...selected,
                            leadsAssigned:
                              leadCountByEmp[
                              selected.id
                              ] ?? 0,
                          } as Employee
                        )}
                        showBar
                      />

                    </div>

                  </div>

                  <div className="p-4 rounded-xl border border-border text-center">

                    <TrendingUp
                      size={16}
                      className="mx-auto mb-1.5 text-emerald-600"
                    />

                    <p className="font-serif text-xl font-semibold text-foreground">
                      0
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Conversions
                    </p>

                  </div>

                </div>
              )}

            {selectedManager && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border">

                <Users
                  size={15}
                  className="text-muted-foreground shrink-0"
                />

                <p className="text-sm text-muted-foreground">
                  Reports to{' '}
                  <span className="font-semibold text-foreground">
                    {
                      selectedManager.name
                    }
                  </span>
                </p>

              </div>
            )}

            {selectedDirectReports.length >
              0 && (
                <div>

                  <div className="flex items-center justify-between mb-2">

                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Direct Reports (
                      {
                        selectedDirectReports.length
                      }
                      )
                    </p>

                    <button
                      onClick={messageTeam}
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                      style={{
                        backgroundColor:
                          'rgba(201,169,110,0.12)',
                        color: '#C9A96E',
                      }}
                    >
                      <Users size={12} />
                      Message this team
                    </button>

                  </div>

                  <div className="flex flex-wrap gap-2">

                    {selectedDirectReports.map(
                      (r) => (
                        <button
                          key={r.id}
                          onClick={() =>
                            setSelectedId(
                              r.id
                            )
                          }
                          className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors"
                        >

                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                            style={{
                              backgroundColor:
                                roleColors[
                                  r.role
                                ].bg,
                              color:
                                roleColors[
                                  r.role
                                ].text,
                            }}
                          >
                            {r.name
                              .split(' ')
                              .map(
                                (n) =>
                                  n[0]
                              )
                              .join('')}
                          </span>

                          <span className="text-xs font-medium text-foreground">
                            {r.name}
                          </span>

                        </button>
                      )
                    )}

                  </div>

                </div>
              )}

          </div>
        )}

      </Modal>

    </div>
  )
}