import { useEffect, useMemo, useState } from 'react'
import { Plus, Clock, CheckCircle2, X, Calendar as CalIcon, ChevronLeft, ChevronRight, User } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/ui/Modal'
import type { Role, CalendarEvent } from '../types'

// Minimal employee shape needed for the calendar grid.
// Fetched directly from Supabase (bypasses the role-filtered /api/users backend)
// so ALL active employees appear regardless of the logged-in user's role.
type EmployeeStub = { id: string; name: string }

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8 AM – 8 PM

const TYPE_COLORS: Record<CalendarEvent['type'], string> = {
  call: '#2563EB',
  meeting: '#7C3AED',
  review: '#D97706',
  personal: '#6B7280',
  blocked: '#DC2626',
}

const TYPE_LABELS: Record<CalendarEvent['type'], string> = {
  call: 'Call',
  meeting: 'Meeting',
  review: 'Review',
  personal: 'Personal',
  blocked: 'Blocked',
}

// Shape returned by the calendar_events Supabase query
type CalendarRow = {
  id: string
  created_by: string       // UUID of the employee who created and owns the event
  title: string
  description: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  location: string | null
  lead_id: string | null
  attendees: string[]
  created_at: string
  updated_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatSlot(hour: number, minute = 0) {
  const period = hour >= 12 ? 'PM' : 'AM'
  const disp = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${disp}:${pad2(minute)} ${period}`
}

function isoToDateKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function parseHour(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0)
  return hour + minute / 60
}

function dateLabel(d: string) {
  const dt = new Date(`${d}T00:00:00+05:30`)
  const todayKey = isoToDateKey(new Date().toISOString())
  return {
    weekday: dt.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }),
    day: dt.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' }),
    month: dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }),
    isToday: d === todayKey,
  }
}

function addDays(dateKey: string, amount: number) {
  const dt = new Date(`${dateKey}T00:00:00+05:30`)
  dt.setUTCDate(dt.getUTCDate() + amount)
  return isoToDateKey(dt.toISOString())
}

function startOfWeek(dateKey: string) {
  const dt = new Date(`${dateKey}T00:00:00+05:30`)
  return addDays(dateKey, -dt.getUTCDay())
}

function currentDateKey() {
  return isoToDateKey(new Date().toISOString())
}

/**
 * Maps a raw DB row to the CalendarEvent UI type.
 *
 * Key mapping:
 *   ownerId   = row.created_by (event belongs to creator and appears in their column)
 *   createdBy = row.created_by (used for edit/delete permissions)
 *
 * isPublic:
 *   true  → event is visible to everyone in the grid
 *   false → only visible to the creator
 */
function toUiEvent(row: CalendarRow): CalendarEvent {
  const ownerId = row.created_by

  let type: CalendarEvent['type'] = 'meeting'
  try {
    const metadata = row.description ? JSON.parse(row.description) : null
    if (metadata?.type && metadata.type in TYPE_COLORS) {
      type = metadata.type as CalendarEvent['type']
    }
  } catch {
    // Older events may have plain-text descriptions; keep the default type.
  }

  return {
    id: row.id,
    ownerId,
    createdBy: row.created_by,
    title: row.title,
    start: row.start_at,
    end: row.end_at || row.start_at,
    type,
    // All events on a shared calendar are public by default.
    // The "Visible to everyone as Busy" toggle in the form can override this.
    // We store the attendees array to determine if it was marked shared.
    isPublic: Array.isArray(row.attendees) && row.attendees.length > 0,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SharedCalendarProps {
  role: Role
  currentUserId?: string
}

export default function SharedCalendar({ role, currentUserId: propUserId }: SharedCalendarProps) {
  // contextEmployees is role-filtered (manager = same office, agent = self).
  // Used ONLY as a fallback for currentUserId resolution and the "In Session" banner.
  // The calendar grid uses allEmployees (direct Supabase fetch) — see loadAllEmployees.
  const { employees: contextEmployees } = useData()
  const currentUserId = propUserId || contextEmployees.find((e) => e.role === role)?.id || ''

  // All active employees — loaded directly from Supabase, bypassing the
  // role-filtered backend API so every active employee is always visible.
  const [allEmployees, setAllEmployees] = useState<EmployeeStub[]>([])
  const employeeIds = useMemo(() => allEmployees.map((e) => e.id), [allEmployees])

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [showModal, setShowModal] = useState(false)
  const [viewDate, setViewDate] = useState(currentDateKey())
  const [hoverEvent, setHoverEvent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const weekDates = useMemo(() => {
    const start = startOfWeek(viewDate)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [viewDate])

  // Form state
  const [form, setForm] = useState({
    title: '',
    date: currentDateKey(),
    startH: '09',
    startM: '00',
    endH: '10',
    endM: '00',
    type: 'meeting' as CalendarEvent['type'],
    category: 'personal' as 'personal' | 'client' | 'internal' | 'team',
    isPublic: true,
  })

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadAllEmployees = async () => {
    const { data, error: empError } = await supabase
      .from('employees')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
    if (!empError && data) {
      setAllEmployees(data as EmployeeStub[])
    }
  }

  const loadEvents = async () => {
    setError('')
    const { data, error: loadError } = await supabase
      .from('calendar_events')
      .select(
        'id, created_by, title, description, start_at, end_at, all_day, location, lead_id, attendees, created_at, updated_at'
      )
      .order('start_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    const rows = (data || []) as CalendarRow[]
    setEvents(rows.map(toUiEvent))
    setLoading(false)
  }

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Load employees once on mount (independent of currentUserId)
  useEffect(() => {
    void loadAllEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load events and subscribe to realtime updates whenever userId/employees change
  useEffect(() => {
    void loadEvents()

    const channel = supabase
      .channel('shared-calendar-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        () => { void loadEvents() }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, employeeIds.join(',')])

  // ── Derived state ────────────────────────────────────────────────────────────

  // Events for the currently viewed date. All authenticated employees see all events company-wide.
  const dayEvents = useMemo(
    () => events.filter((e) => isoToDateKey(e.start) === viewDate),
    [events, viewDate]
  )

  const nowHour = useMemo(() => parseHour(new Date().toISOString()), [])
  const isViewedToday = dateLabel(viewDate).isToday
  const activeBusy = isViewedToday
    ? dayEvents.filter((e) => parseHour(e.start) <= nowHour && parseHour(e.end) > nowHour)
    : []
  const activeOwners = activeBusy.map((e) => e.ownerId)

  // Current employee name for display in the modal
  const currentEmployee =
    allEmployees.find((e) => e.id === currentUserId) ||
    contextEmployees.find((e) => e.id === currentUserId)
  const currentEmployeeName = currentEmployee?.name || 'You'

  // ── Event handlers ───────────────────────────────────────────────────────────

  /**
   * Called when an open time slot in the user's OWN column is clicked.
   * Only the logged-in employee can create events in their own calendar.
   */
  const handleSlotClick = (hour: number, half: boolean) => {
    const startM = half ? 30 : 0
    const endH = half ? hour + 1 : hour
    const endM = half ? 0 : 30
    setForm({
      title: '',
      date: viewDate,
      startH: pad2(hour),
      startM: pad2(startM),
      endH: pad2(Math.min(endH, 20)),
      endM: pad2(endM),
      type: 'meeting',
      category: 'personal',
      isPublic: true,
    })
    setShowModal(true)
  }

  /** "Add Event" button — creates an event for the logged-in user. */
  const openBlankModal = () => {
    setForm({
      title: '',
      date: viewDate,
      startH: '09',
      startM: '00',
      endH: '10',
      endM: '00',
      type: 'meeting',
      category: 'personal',
      isPublic: true,
    })
    setShowModal(true)
  }

  const submitEvent = async () => {
    if (!form.title.trim() || !currentUserId || saving) return

    setSaving(true)
    setError('')

    const startIso = new Date(`${form.date}T${form.startH}:${form.startM}:00+05:30`).toISOString()
    const endIso   = new Date(`${form.date}T${form.endH}:${form.endM}:00+05:30`).toISOString()

    // Attendees list includes all active employees for company-wide visibility
    const attendees = employeeIds.length > 0 ? employeeIds : [currentUserId]

    const { error: insertError } = await supabase.from('calendar_events').insert({
      created_by: currentUserId,   // person who created and owns the event
      title: form.title.trim(),
      description: JSON.stringify({ type: form.type, category: form.category }),
      start_at: startIso,
      end_at: endIso,
      all_day: false,
      location: null,
      lead_id: null,
      attendees,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setShowModal(false)
    setSaving(false)
    await loadEvents()
  }

  /**
   * Delete an event.
   * Only the creator/owner of the event can delete it.
   */
  const removeEvent = async (id: string) => {
    setError('')
    const previous = events
    setEvents((prev) => prev.filter((e) => e.id !== id))

    const { error: deleteError } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setEvents(previous)
      setError(deleteError.message)
    }
  }

  const moveWeek = (amount: number) => setViewDate(addDays(viewDate, amount * 7))

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div
          className="rounded-xl border p-3 text-sm text-red-700"
          style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}
        >
          {error}
        </div>
      )}

      {/* Currently in session banner */}
      {activeBusy.length > 0 && (
        <div
          className="rounded-xl border p-3 sm:p-4 flex items-start gap-3"
          style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}
        >
          <Clock size={14} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 mb-1">Currently In Session</p>
            <div className="flex flex-wrap gap-2">
              {activeBusy.map((ev) => {
                // Prefer allEmployees (full company list) for name lookup
                const owner =
                  allEmployees.find((e) => e.id === ev.ownerId) ??
                  contextEmployees.find((e) => e.id === ev.ownerId)
                return (
                  <span
                    key={ev.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: TYPE_COLORS[ev.type] + '20',
                      color: TYPE_COLORS[ev.type],
                    }}
                  >
                    🔴 {owner?.name || 'Team member'} — {ev.title}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalIcon size={18} className="text-accent" />
          <div>
            <h2 className="font-serif text-lg font-semibold text-foreground">Shared Calendar</h2>
            <p className="text-xs text-muted-foreground">
              Company-wide schedule. Click an open slot in your column to schedule an event.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => moveWeek(-1)}
            className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setViewDate(currentDateKey())}
            className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground"
          >
            Today
          </button>
          <button
            onClick={() => moveWeek(1)}
            className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={openBlankModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shrink-0"
            style={{ backgroundColor: '#C9A96E', color: '#1C2B4A' }}
          >
            <Plus size={15} /> Add Event
          </button>
        </div>
      </div>

      {/* Week date strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {weekDates.map((d) => {
          const { weekday, day, month, isToday } = dateLabel(d)
          const active = d === viewDate
          return (
            <button
              key={d}
              onClick={() => setViewDate(d)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl shrink-0 transition-all min-w-12"
              style={{
                backgroundColor: active
                  ? '#1C2B4A'
                  : isToday
                  ? 'rgba(201,169,110,0.15)'
                  : 'transparent',
                border: `1px solid ${
                  active ? '#1C2B4A' : isToday ? '#C9A96E' : 'transparent'
                }`,
              }}
            >
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? 'rgba(250,248,245,0.6)' : '#7A7065' }}
              >
                {weekday}
              </span>
              <span
                className="text-lg font-bold"
                style={{ color: active ? '#FAF8F5' : isToday ? '#C9A96E' : '#1C2B4A' }}
              >
                {day}
              </span>
              <span
                className="text-[10px]"
                style={{ color: active ? 'rgba(250,248,245,0.5)' : '#7A7065' }}
              >
                {month}
              </span>
            </button>
          )
        })}
      </div>

      {/* Calendar grid */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <p className="text-xs text-muted-foreground px-4 pt-2 pb-1 sm:hidden">
          ← Scroll right to see all members
        </p>
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${72 + allEmployees.length * 110}px` }}>
            {/* Column headers (employee names) */}
            <div className="flex border-b border-border sticky top-0 bg-card z-10">
              <div className="w-16 sm:w-20 shrink-0" />
              {allEmployees.map((emp) => {
                const isBusy = activeOwners.includes(emp.id)
                const isMe = emp.id === currentUserId
                return (
                  <div
                    key={emp.id}
                    className="w-24 sm:w-32 shrink-0 px-1 py-2 text-center border-l border-border"
                    style={{ backgroundColor: isMe ? 'rgba(201,169,110,0.06)' : undefined }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1"
                      style={{
                        backgroundColor: isMe ? '#C9A96E' : 'rgba(28,43,74,0.1)',
                        color: '#1C2B4A',
                      }}
                    >
                      {emp.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <p className="text-[10px] sm:text-xs font-semibold text-foreground truncate">
                      {emp.name.split(' ')[0]}
                    </p>
                    <span
                      className={`inline-flex items-center text-[9px] sm:text-[10px] font-medium px-1 py-0.5 rounded-full mt-0.5 ${
                        isBusy ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isBusy ? '🔴 Busy' : '🟢 Free'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Time slots */}
            {loading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Loading calendar…
              </div>
            ) : (
              HOURS.map((hour) =>
                [false, true].map((half) => {
                  const slotKey = `${hour}-${half ? '30' : '00'}`
                  const slotHour = hour + (half ? 0.5 : 0)
                  return (
                    <div
                      key={slotKey}
                      className={`flex ${half ? '' : 'border-t border-border'}`}
                      style={{ minHeight: 32 }}
                    >
                      {/* Time label */}
                      <div className="w-16 sm:w-20 shrink-0 text-right pr-2 sm:pr-3 flex items-start pt-1">
                        {!half && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatSlot(hour)}
                          </span>
                        )}
                      </div>

                      {/* Per-employee cells */}
                      {allEmployees.map((emp) => {
                        const isMe = emp.id === currentUserId
                        const slotEvents = dayEvents.filter((e) => {
                          const sh = parseHour(e.start)
                          return (
                            e.ownerId === emp.id &&
                            sh >= slotHour &&
                            sh < slotHour + 0.5
                          )
                        })

                        // Only the logged-in employee can create events in their own column
                        const canAdd = isMe && slotEvents.length === 0

                        return (
                          <div
                            key={emp.id}
                            onClick={() => canAdd && handleSlotClick(hour, half)}
                            className={`w-24 sm:w-32 shrink-0 border-l border-border relative ${
                              half ? 'border-t border-dashed border-border/40' : ''
                            }`}
                            style={{
                              backgroundColor: isMe
                                ? 'rgba(201,169,110,0.03)'
                                : undefined,
                              cursor: canAdd ? 'pointer' : 'default',
                            }}
                          >
                            {/* Hover add indicator — only for the logged-in employee's column */}
                            {canAdd && (
                              <div
                                className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}
                              >
                                <Plus size={12} className="text-accent" />
                              </div>
                            )}

                            {/* Events in this slot */}
                            {slotEvents.map((ev) => {
                              const startH = parseHour(ev.start)
                              const endH   = parseHour(ev.end)
                              const durSlots = Math.max(1, Math.round((endH - startH) * 2))
                              const heightPx = durSlots * 32 - 2
                              const color = TYPE_COLORS[ev.type]

                              // Only the creator or owner can delete an event
                              const canEdit =
                                ev.createdBy === currentUserId || ev.ownerId === currentUserId

                              return (
                                <div
                                  key={ev.id}
                                  className="absolute left-0.5 right-0.5 top-0.5 rounded-lg px-1.5 py-1 text-white overflow-hidden group cursor-pointer z-10"
                                  style={{ backgroundColor: color, height: `${heightPx}px` }}
                                  onMouseEnter={() => setHoverEvent(ev.id)}
                                  onMouseLeave={() => setHoverEvent(null)}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <p className="text-[10px] sm:text-xs font-semibold leading-tight truncate">
                                    {ev.title}
                                  </p>
                                  <p className="text-[9px] sm:text-[10px] opacity-75 hidden sm:block">
                                    {new Date(ev.start).toLocaleTimeString('en-IN', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true,
                                      timeZone: 'Asia/Kolkata',
                                    })}
                                    –
                                    {new Date(ev.end).toLocaleTimeString('en-IN', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true,
                                      timeZone: 'Asia/Kolkata',
                                    })}
                                  </p>
                                  {hoverEvent === ev.id && canEdit && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        void removeEvent(ev.id)
                                      }}
                                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white/90 flex items-center justify-center shadow"
                                      style={{ color }}
                                    >
                                      <X size={9} />
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            {TYPE_LABELS[type as CalendarEvent['type']]}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#C9A96E' }} />
          You
        </span>
      </div>

      {/* Add Event Modal */}
      <Modal open={showModal} onClose={() => !saving && setShowModal(false)} title="Add Event">
        <div className="space-y-4">

          {/* ── Event for: Current Employee (Read-only, no dropdown) ── */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <User size={12} className="text-accent" />
              Event for
            </label>
            <div className="w-full px-3 py-2.5 rounded-lg border border-border bg-muted/20 text-sm font-semibold text-foreground flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: '#C9A96E', color: '#1C2B4A' }}
                >
                  {currentEmployeeName.split(' ').map((n) => n[0]).join('')}
                </div>
                <span>{currentEmployeeName}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800">
                You
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Events are created in your personal calendar and visible company-wide.
            </p>
          </div>

          {/* ── Category ── */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'personal' as const, label: '🧑 Personal / Internal', desc: 'Team huddle, internal review' },
                  { id: 'client'   as const, label: '🤝 Client Meeting',       desc: 'Call or visit with a lead/client' },
                  { id: 'team'     as const, label: '👥 Team Call',            desc: 'Group call with your team' },
                  { id: 'internal' as const, label: '🏢 Company',              desc: 'Management or cross-team' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setForm({ ...form, category: opt.id })}
                  className="text-left px-3 py-2.5 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: form.category === opt.id ? '#C9A96E' : '#E5DFD5',
                    backgroundColor:
                      form.category === opt.id ? 'rgba(201,169,110,0.08)' : 'transparent',
                  }}
                >
                  <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Title ── */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Event Title
            </label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && form.title.trim() && void submitEvent()}
              placeholder={
                form.category === 'client'
                  ? 'e.g. Call — Arjun Malhotra'
                  : form.category === 'team'
                  ? 'e.g. Team Alpha Huddle'
                  : form.category === 'internal'
                  ? 'e.g. Q3 Review Meeting'
                  : 'e.g. Personal block'
              }
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {/* ── Type + Time ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as CalendarEvent['type'] })
                }
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Start time
              </label>
              <div className="flex gap-1 items-center">
                <select
                  value={form.startH}
                  onChange={(e) => setForm({ ...form, startH: e.target.value })}
                  className="flex-1 px-2 py-2.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={pad2(h)}>{pad2(h)}</option>
                  ))}
                </select>
                <span className="text-muted-foreground text-sm font-bold">:</span>
                <select
                  value={form.startM}
                  onChange={(e) => setForm({ ...form, startM: e.target.value })}
                  className="flex-1 px-2 py-2.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none"
                >
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                End time
              </label>
              <div className="flex gap-1 items-center">
                <select
                  value={form.endH}
                  onChange={(e) => setForm({ ...form, endH: e.target.value })}
                  className="flex-1 px-2 py-2.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={pad2(h)}>{pad2(h)}</option>
                  ))}
                </select>
                <span className="text-muted-foreground text-sm font-bold">:</span>
                <select
                  value={form.endM}
                  onChange={(e) => setForm({ ...form, endM: e.target.value })}
                  className="flex-1 px-2 py-2.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none"
                >
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
              </div>
            </div>
          </div>

          {/* Preview pill */}
          {form.title.trim() && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white font-medium"
              style={{ backgroundColor: TYPE_COLORS[form.type] }}
            >
              <span>{form.title}</span>
              <span className="opacity-75 ml-auto">
                {form.startH}:{form.startM} – {form.endH}:{form.endM}
              </span>
            </div>
          )}

          {/* Public toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pub2"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              className="rounded"
            />
            <label
              htmlFor="pub2"
              className="text-sm text-foreground select-none cursor-pointer"
            >
              Visible to everyone as Busy
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowModal(false)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void submitEvent()}
              disabled={!form.title.trim() || saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity flex items-center justify-center gap-1.5"
              style={{
                backgroundColor:
                  form.title.trim() && !saving ? TYPE_COLORS[form.type] : '#D7CFC2',
                color: '#fff',
                opacity: form.title.trim() && !saving ? 1 : 0.6,
              }}
            >
              <CheckCircle2 size={14} /> {saving ? 'Saving…' : 'Save Event'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
