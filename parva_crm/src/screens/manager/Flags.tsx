import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Plus,
  Flag as FlagIcon,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { supabase } from '../../lib/supabase'
import {
  getCurrentEmployee,
  getAllEmployees,
  type ChatEmployee,
} from '../../services/chatService'
import type {
  Notification,
  Flag,
} from '../../types'

interface FlagsProps {
  flagList: Flag[]
  setFlagList: React.Dispatch<
    React.SetStateAction<Flag[]>
  >
  onAddNotification?: (
    n: Omit<
      Notification,
      'id' | 'timestamp' | 'read'
    >
  ) => void
  onAddAudit?: (
    action: string,
    details: string
  ) => void
}

type DbFlag = {
  id: string
  lead_id: string | null
  raised_by: string | null
  assigned_to: string | null
  type:
  | 'Warning'
  | 'Performance'
  | 'Attendance'
  | 'Conduct'
  | 'Self-Reported'
  | string
  title: string
  description: string | null
  priority: string
  status:
  | 'Open'
  | 'Acknowledged'
  | 'Resolved'
  | string
  created_at: string
  updated_at: string
}

const severityCls = {
  Low: 'bg-sky-50 text-sky-700',
  Medium:
    'bg-amber-50 text-amber-700',
  High: 'bg-red-50 text-red-700',
}

const statusCls = {
  Open: 'bg-red-50 text-red-600',
  Acknowledged:
    'bg-amber-50 text-amber-600',
  Resolved:
    'bg-emerald-50 text-emerald-700',
}

function normalizeSeverity(
  value: string
): Flag['severity'] {
  const v = value.toLowerCase()

  if (v === 'high') return 'High'
  if (v === 'medium') return 'Medium'

  return 'Low'
}

function normalizeStatus(
  value: string
): Flag['status'] {
  const v = value.toLowerCase()

  if (v === 'resolved')
    return 'Resolved'

  if (v === 'acknowledged')
    return 'Acknowledged'

  return 'Open'
}

function mapFlag(
  row: DbFlag,
  employees: ChatEmployee[]
): Flag {
  const employeeId =
    row.assigned_to ||
    row.raised_by ||
    ''

  const employee =
    employees.find(
      (e) => e.id === employeeId
    )

  const issuer =
    employees.find(
      (e) =>
        e.id === row.raised_by
    )

  return {
    id: row.id,

    employeeId,

    employeeName:
      employee?.name ||
      'Unknown employee',

    type:
      row.type as Flag['type'],

    description:
      row.description ||
      row.title ||
      '',

    severity:
      normalizeSeverity(
        row.priority
      ),

    issuedBy:
      issuer?.name ||
      'Unknown',

    date:
      row.created_at
        ? new Date(
          row.created_at
        )
          .toISOString()
          .slice(0, 10)
        : new Date()
          .toISOString()
          .slice(0, 10),

    status:
      normalizeStatus(
        row.status
      ),
  }
}

export default function Flags({
  flagList: _flagList,
  setFlagList,
  onAddNotification,
  onAddAudit,
}: FlagsProps) {
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
    flags,
    setFlags,
  ] = useState<Flag[]>([])

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
    employeeId: '',
    type:
      'Performance' as Flag['type'],
    severity:
      'Low' as Flag['severity'],
    description: '',
  })

  /*
   * ==========================================================
   * LOAD ALL EMPLOYEES
   * ==========================================================
   */
  useEffect(() => {
    let active = true

    const loadEmployees =
      async () => {
        try {
          const [
            employeeList,
            me,
          ] = await Promise.all([
            getAllEmployees(),
            getCurrentEmployee(),
          ])

          if (!active) return

          setEmployees(
            employeeList
          )

          setCurrentEmployee(
            me
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

    void loadEmployees()

    return () => {
      active = false
    }
  }, [])

  /*
   * ==========================================================
   * LOAD FLAGS
   * ==========================================================
   */
  const loadFlags =
    async () => {
      const {
        data,
        error: dbError,
      } = await supabase
        .from('flags')
        .select(
          `
            id,
            lead_id,
            raised_by,
            assigned_to,
            type,
            title,
            description,
            priority,
            status,
            created_at,
            updated_at
          `
        )
        .order(
          'created_at',
          {
            ascending:
              false,
          }
        )

      if (dbError) {
        throw new Error(
          dbError.message
        )
      }

      const mapped =
        ((data ||
          []) as DbFlag[]).map(
            (row) =>
              mapFlag(
                row,
                employees
              )
          )

      setFlags(mapped)
      setFlagList(mapped)
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
          await loadFlags()
        } catch (err) {
          if (!active) return

          setError(
            err instanceof Error
              ? err.message
              : 'Could not load flags.'
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
  }, [employees])

  /*
   * ==========================================================
   * REALTIME
   * ==========================================================
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
          `flags-${Date.now()}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'flags',
          },
          async () => {
            try {
              await loadFlags()
            } catch (err) {
              console.error(
                'Realtime flag reload failed:',
                err
              )
            }
          }
        )
        .subscribe()

    return () => {
      void supabase.removeChannel(
        channel
      )
    }
  }, [employees])

  /*
   * ==========================================================
   * TEAM MEMBERS
   * ==========================================================
   */
  const teamMembers =
    employees.filter(
      (employee) =>
        employee.role !==
        'admin' &&
        employee.status ===
        'active'
    )

  /*
   * ==========================================================
   * CREATE FLAG
   * ==========================================================
   */
  const submit = async () => {
    if (
      !form.employeeId ||
      !form.description.trim()
    ) {
      return
    }

    if (!currentEmployee) {
      setError(
        'Could not identify the logged-in employee.'
      )
      return
    }

    setSaving(true)
    setError('')

    const {
      data,
      error: dbError,
    } = await supabase
      .from('flags')
      .insert({
        lead_id: null,
        raised_by:
          currentEmployee.id,
        assigned_to:
          form.employeeId,
        type: form.type,
        title: `${form.type} Flag`,
        description:
          form.description.trim(),
        priority:
          form.severity,
        status: 'Open',
      })
      .select(
        `
          id,
          lead_id,
          raised_by,
          assigned_to,
          type,
          title,
          description,
          priority,
          status,
          created_at,
          updated_at
        `
      )
      .single()

    if (dbError || !data) {
      setError(
        dbError?.message ||
        'Failed to save the flag.'
      )
      setSaving(false)
      return
    }

    const newFlag =
      mapFlag(
        data as DbFlag,
        employees
      )

    setFlags(
      (prev) => [
        newFlag,
        ...prev,
      ]
    )

    setFlagList(
      (prev) => [
        newFlag,
        ...prev.filter(
          (f) =>
            f.id !==
            newFlag.id
        ),
      ]
    )

    const employee =
      employees.find(
        (e) =>
          e.id ===
          form.employeeId
      )

    onAddNotification?.({
      type: 'flag',
      title: 'Flag Raised',
      message: `${form.severity} flag on ${employee?.name ||
        'employee'
        }: ${form.description.trim()}`,
      priority:
        form.severity === 'High'
          ? 'high'
          : form.severity ===
            'Medium'
            ? 'medium'
            : 'low',
      forUserId:
        form.employeeId,
    })

    onAddAudit?.(
      'Flag Issued',
      `${form.type} flag issued for ${employee?.name ||
      'employee'
      }`
    )

    setForm({
      employeeId: '',
      type: 'Performance',
      severity: 'Low',
      description: '',
    })

    setShowModal(false)
    setSaving(false)
  }

  /*
   * ==========================================================
   * UPDATE STATUS
   * ==========================================================
   */
  const updateStatus =
    async (
      flag: Flag,
      status: Flag['status']
    ) => {
      const {
        error: dbError,
      } = await supabase
        .from('flags')
        .update({
          status,
        })
        .eq('id', flag.id)

      if (dbError) {
        setError(
          dbError.message
        )
        return
      }

      const updated =
        flags.map((f) =>
          f.id === flag.id
            ? {
              ...f,
              status,
            }
            : f
        )

      setFlags(updated)
      setFlagList(updated)

      onAddAudit?.(
        `Flag ${status}`,
        `${flag.type} flag for ${flag.employeeName} marked ${status}`
      )

      if (
        status === 'Resolved'
      ) {
        onAddNotification?.({
          type: 'flag',
          title:
            'Flag Resolved',
          message: `${flag.type} flag for ${flag.employeeName} has been resolved.`,
          priority:
            'low',
          forUserId:
            flag.employeeId,
        })
      }
    }

  const openCount =
    flags.filter(
      (f) =>
        f.status === 'Open'
    ).length

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">

        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Flags & Warnings
          </h2>

          <p className="text-xs text-muted-foreground">
            {openCount} open flags
          </p>
        </div>

        <button
          onClick={() =>
            setShowModal(true)
          }
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            backgroundColor:
              '#C9A96E',
            color:
              '#1C2B4A',
          }}
        >
          <Plus size={15} />
          Raise Flag
        </button>

      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">

          <Loader2
            size={28}
            className="mx-auto mb-3 animate-spin text-muted-foreground"
          />

          <p className="text-sm text-muted-foreground">
            Loading flags…
          </p>

        </div>
      ) : flags.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">

          <FlagIcon
            size={28}
            className="mx-auto mb-3 text-muted-foreground opacity-30"
          />

          <p className="text-sm font-medium text-foreground">
            No flags raised yet
          </p>

          <p className="text-xs text-muted-foreground mt-1">
            Raise a flag when a team member requires attention.
          </p>

        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">

          {flags.map((f) => (
            <div
              key={f.id}
              className="p-5"
            >

              <div className="flex items-start justify-between flex-wrap gap-2 mb-2">

                <div className="flex items-center gap-2 flex-wrap">

                  <p className="text-sm font-semibold text-foreground">
                    {f.employeeName}
                  </p>

                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${severityCls[
                      f.severity
                      ]
                      }`}
                  >
                    {f.severity}
                  </span>

                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusCls[
                      f.status
                      ]
                      }`}
                  >
                    {f.status}
                  </span>

                </div>

                <p className="text-xs text-muted-foreground">
                  {f.date}
                </p>

              </div>

              <p className="text-sm text-muted-foreground">
                {f.description}
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                Issued by{' '}
                {f.issuedBy}
                {' · '}
                {f.type}
              </p>

              {f.status ===
                'Open' && (
                  <button
                    onClick={() =>
                      void updateStatus(
                        f,
                        'Acknowledged'
                      )
                    }
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <AlertTriangle
                      size={12}
                    />
                    Acknowledge
                  </button>
                )}

              {f.status !==
                'Resolved' && (
                  <button
                    onClick={() =>
                      void updateStatus(
                        f,
                        'Resolved'
                      )
                    }
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      backgroundColor:
                        'rgba(16,185,129,0.1)',
                      color:
                        '#059669',
                    }}
                  >
                    <CheckCircle2
                      size={12}
                    />
                    Resolve
                  </button>
                )}

            </div>
          ))}

        </div>
      )}

      {/* MODAL */}
      <Modal
        open={showModal}
        onClose={() =>
          !saving &&
          setShowModal(false)
        }
        title="Raise a Flag"
      >

        <div className="space-y-4">

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Team Member
            </label>

            <select
              value={
                form.employeeId
              }
              disabled={saving}
              onChange={(e) =>
                setForm({
                  ...form,
                  employeeId:
                    e.target.value,
                })
              }
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none"
            >
              <option value="">
                Select…
              </option>

              {teamMembers.map(
                (emp) => (
                  <option
                    key={emp.id}
                    value={emp.id}
                  >
                    {emp.name}
                  </option>
                )
              )}

            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Type
            </label>

            <select
              value={form.type}
              disabled={saving}
              onChange={(e) =>
                setForm({
                  ...form,
                  type:
                    e.target.value as Flag['type'],
                })
              }
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none"
            >
              {[
                'Warning',
                'Performance',
                'Attendance',
                'Conduct',
                'Self-Reported',
              ].map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Priority
            </label>

            <div className="flex gap-2">

              {(
                [
                  'Low',
                  'Medium',
                  'High',
                ] as const
              ).map(
                (severity) => (
                  <button
                    key={severity}
                    type="button"
                    disabled={
                      saving
                    }
                    onClick={() =>
                      setForm({
                        ...form,
                        severity,
                      })
                    }
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor:
                        form.severity ===
                          severity
                          ? '#1C2B4A'
                          : '#F5F2EC',
                      color:
                        form.severity ===
                          severity
                          ? '#FAF8F5'
                          : '#7A7065',
                    }}
                  >
                    {severity}
                  </button>
                )
              )}

            </div>
          </div>

          <div>

            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Description
            </label>

            <textarea
              rows={3}
              value={
                form.description
              }
              disabled={saving}
              onChange={(e) =>
                setForm({
                  ...form,
                  description:
                    e.target.value,
                })
              }
              placeholder="Describe the issue…"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
            />

          </div>

          <div className="flex gap-3 pt-2">

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                setShowModal(
                  false
                )
              }
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={
                saving ||
                !form.employeeId ||
                !form.description.trim()
              }
              onClick={() =>
                void submit()
              }
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{
                backgroundColor:
                  '#DC2626',
                color: '#fff',
                opacity:
                  saving ||
                    !form.employeeId ||
                    !form.description.trim()
                    ? 0.5
                    : 1,
              }}
            >
              {saving && (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              )}

              {saving
                ? 'Saving…'
                : 'Raise Flag'}
            </button>

          </div>

        </div>

      </Modal>
    </div>
  )
}