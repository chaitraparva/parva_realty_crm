import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  Search,
  Loader2,
} from 'lucide-react'
import type { AuditEntry } from '../../types'
import { supabase } from '../../lib/supabase'

interface AuditLogProps {
  entries: AuditEntry[]
}

type DbAuditLog = {
  id: string
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type EmployeeRow = {
  id: string
  name: string
}

function formatTimestamp(value: string) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function mapAuditRow(
  row: DbAuditLog,
  employees: EmployeeRow[]
): AuditEntry {
  const metadata =
    row.metadata || {}

  const actor =
    employees.find(
      (employee) =>
        employee.id ===
        row.actor_id
    )

  return {
    id: row.id,

    timestamp:
      formatTimestamp(
        row.created_at
      ),

    actorName:
      actor?.name ||
      'System',

    action:
      row.action,

    details:
      row.description ||
      row.action,

    previousValue:
      typeof metadata.previousValue ===
        'string'
        ? metadata.previousValue
        : undefined,

    newValue:
      typeof metadata.newValue ===
        'string'
        ? metadata.newValue
        : undefined,

    reason:
      typeof metadata.reason ===
        'string'
        ? metadata.reason
        : undefined,
  }
}

export default function AuditLog({
  entries,
}: AuditLogProps) {
  const [
    dbEntries,
    setDbEntries,
  ] = useState<AuditEntry[]>([])

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState('')

  /*
   * ============================================================
   * LOAD AUDIT LOG FROM SUPABASE
   * ============================================================
   */
  const loadAuditLog =
    async () => {
      setError('')

      const [
        auditResult,
        employeeResult,
      ] =
        await Promise.all([
          supabase
            .from('audit_logs')
            .select(`
              id,
              actor_id,
              action,
              entity_type,
              entity_id,
              description,
              metadata,
              created_at
            `)
            .order(
              'created_at',
              {
                ascending:
                  false,
              }
            ),

          supabase
            .from('employees')
            .select(
              'id, name'
            ),
        ])

      if (
        auditResult.error
      ) {
        throw new Error(
          auditResult.error.message
        )
      }

      if (
        employeeResult.error
      ) {
        throw new Error(
          employeeResult.error.message
        )
      }

      const employees =
        (employeeResult.data ||
          []) as EmployeeRow[]

      const mapped =
        (
          (auditResult.data ||
            []) as DbAuditLog[]
        ).map((row) =>
          mapAuditRow(
            row,
            employees
          )
        )

      setDbEntries(mapped)
    }

  useEffect(() => {
    let active = true

    const run =
      async () => {
        setLoading(true)

        try {
          await loadAuditLog()
        } catch (err) {
          if (!active) return

          setError(
            err instanceof Error
              ? err.message
              : 'Could not load audit log.'
          )
        } finally {
          if (active) {
            setLoading(false)
          }
        }
      }

    void run()

    return () => {
      active = false
    }
  }, [])

  /*
   * ============================================================
   * REALTIME AUDIT LOG
   * ============================================================
   */
  useEffect(() => {
    const channel =
      supabase
        .channel(
          'audit-log-realtime'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'audit_logs',
          },
          () => {
            void loadAuditLog()
          }
        )
        .subscribe()

    return () => {
      void supabase.removeChannel(
        channel
      )
    }
  }, [])

  /*
   * ============================================================
   * MERGE LOCAL ENTRIES + DATABASE ENTRIES
   * ============================================================
   *
   * This keeps a newly-created audit entry visible immediately
   * while the database record is being written.
   *
   * Same ID = no duplicate.
   * ============================================================
   */
  const allEntries =
    useMemo(() => {
      const map =
        new Map<
          string,
          AuditEntry
        >()

      for (
        const entry of dbEntries
      ) {
        map.set(
          entry.id,
          entry
        )
      }

      for (
        const entry of entries
      ) {
        if (
          !map.has(
            entry.id
          )
        ) {
          map.set(
            entry.id,
            entry
          )
        }
      }

      return Array.from(
        map.values()
      ).sort((a, b) =>
        b.timestamp.localeCompare(
          a.timestamp
        )
      )
    }, [
      dbEntries,
      entries,
    ])

  const filtered =
    allEntries.filter(
      (entry) => {
        const q =
          search
            .trim()
            .toLowerCase()

        if (!q) {
          return true
        }

        return (
          entry.actorName
            .toLowerCase()
            .includes(q) ||
          entry.action
            .toLowerCase()
            .includes(q) ||
          entry.details
            .toLowerCase()
            .includes(q) ||
          (
            entry.reason ||
            ''
          )
            .toLowerCase()
            .includes(q)
        )
      }
    )

  return (
    <div>

      {/* HEADER */}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">

        <div>

          <h2 className="font-serif text-lg font-semibold text-foreground">
            Audit Log
          </h2>

          <p className="text-xs text-muted-foreground">
            A permanent record of sensitive actions and system activity
          </p>

        </div>

        <div className="relative">

          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search by person or action"
            className="pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 w-64"
          />

        </div>

      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* LOADING */}

      {loading ? (
        <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">

          <Loader2
            size={28}
            className="mx-auto mb-3 animate-spin text-muted-foreground"
          />

          <p className="text-sm text-muted-foreground">
            Loading audit log…
          </p>

        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">

          {filtered.map(
            (entry) => (
              <div
                key={
                  entry.id
                }
                className="flex items-start gap-4 p-4"
              >

                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    backgroundColor:
                      'rgba(28,43,74,0.08)',
                  }}
                >
                  <ClipboardList
                    size={16}
                    color="#1C2B4A"
                  />
                </div>

                <div className="flex-1 min-w-0">

                  <div className="flex items-center gap-2 flex-wrap">

                    <p className="text-sm font-semibold text-foreground">
                      {
                        entry.action
                      }
                    </p>

                    <span className="text-xs text-muted-foreground">
                      by{' '}
                      {
                        entry.actorName
                      }
                    </span>

                  </div>

                  <p className="text-sm text-muted-foreground mt-0.5">
                    {
                      entry.details
                    }
                  </p>

                  {(
                    entry.previousValue ||
                    entry.newValue
                  ) && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">

                        {entry.previousValue && (
                          <span className="line-through opacity-60">
                            {
                              entry.previousValue
                            }
                          </span>
                        )}

                        {entry.previousValue &&
                          entry.newValue && (
                            <span>
                              →
                            </span>
                          )}

                        {entry.newValue && (
                          <span className="font-medium text-foreground">
                            {
                              entry.newValue
                            }
                          </span>
                        )}

                      </p>
                    )}

                  {entry.reason && (
                    <p className="text-xs text-amber-700 mt-0.5">
                      Reason:{' '}
                      {
                        entry.reason
                      }
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    {
                      entry.timestamp
                    }
                  </p>

                </div>

              </div>
            )
          )}

          {filtered.length ===
            0 && (
              <p className="text-center py-12 text-sm text-muted-foreground">
                No audit entries match your search
              </p>
            )}

        </div>
      )}

    </div>
  )
}