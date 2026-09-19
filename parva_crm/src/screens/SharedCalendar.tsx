import { useState, useMemo } from 'react'
import { Plus, Clock, CheckCircle2, X, Calendar as CalIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { calendarEvents as initialEvents } from '../data/mockData'
import { useData } from '../contexts/DataContext'
import Modal from '../components/ui/Modal'
import type { Role, CalendarEvent } from '../types'
import { currentUserByRole } from './Messages'

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8am–8pm
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

// Week dates centered on 2024-08-22
const WEEK_DATES = [
  '2024-08-19', '2024-08-20', '2024-08-21', '2024-08-22',
  '2024-08-23', '2024-08-24', '2024-08-25',
]

function parseHour(ts: string) {
  const t = ts.split(' ')[1] || ts
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function formatSlot(hour: number, half: boolean) {
  const h = hour
  const m = half ? 30 : 0
  const period = h >= 12 ? 'PM' : 'AM'
  const disp = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${disp}:${pad2(m)} ${period}`
}

function dateLabel(d: string) {
  const dt = new Date(d)
  return {
    weekday: dt.toLocaleDateString('en-IN', { weekday: 'short' }),
    day: dt.getDate(),
    month: dt.toLocaleDateString('en-IN', { month: 'short' }),
    isToday: d === '2024-08-22',
  }
}

interface SharedCalendarProps { role: Role; currentUserId?: string }

export default function SharedCalendar({ role, currentUserId: propUserId }: SharedCalendarProps) {
  const { employees } = useData()
  const currentUserId = propUserId || currentUserByRole[role]
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [showModal, setShowModal] = useState(false)
  const [viewDate, setViewDate] = useState('2024-08-22')
  const [hoverEvent, setHoverEvent] = useState<string | null>(null)

  // The form is pre-filled when clicking a slot
  const [form, setForm] = useState({
    title: '',
    date: '2024-08-22',
    startH: '09', startM: '00',
    endH: '10', endM: '00',
    type: 'meeting' as CalendarEvent['type'],
    category: 'personal' as 'personal' | 'client' | 'internal' | 'team',
    isPublic: true,
  })

  const dayEvents = useMemo(
    () => events.filter(
      (e) => e.start.startsWith(viewDate) && (e.isPublic || e.ownerId === currentUserId)
    ),
    [events, viewDate, currentUserId]
  )

  // Demo "now" = 10:30am
  const demoNow = 10.5
  const activeBusy = dayEvents.filter(
    (e) => parseHour(e.start) <= demoNow && parseHour(e.end) > demoNow
  )
  const activeOwners = activeBusy.map((e) => e.ownerId)

  // Mobile: only show current user column. Desktop: all active employees
  const allEmployees = employees.filter((e) => e.status === 'active')
  const visibleEmployees = allEmployees

  // Click a time slot: pre-fill form with that hour + person, open modal
  const handleSlotClick = (hour: number, half: boolean, empId: string) => {
    const startH = hour
    const startM = half ? 30 : 0
    const endH = startM === 30 ? hour + 1 : hour
    const endM = startM === 30 ? 0 : 30
    setForm({
      title: '',
      date: viewDate,
      startH: pad2(startH),
      startM: pad2(startM),
      endH: pad2(endH === 21 ? 20 : endH),
      endM: pad2(endM),
      type: 'meeting',
      category: 'personal',
      isPublic: empId === currentUserId ? true : true,
    })
    setShowModal(true)
  }

  const openBlankModal = () => {
    setForm({ title: '', date: viewDate, startH: '09', startM: '00', endH: '10', endM: '00', type: 'meeting', category: 'personal', isPublic: true })
    setShowModal(true)
  }

  const submitEvent = () => {
    if (!form.title.trim()) return
    const start = `${form.date} ${form.startH}:${form.startM}`
    const end = `${form.date} ${form.endH}:${form.endM}`
    setEvents((prev) => [
      ...prev,
      { id: `cal-${Date.now()}`, ownerId: currentUserId, title: form.title.trim(), start, end, type: form.type, isPublic: form.isPublic },
    ])
    setShowModal(false)
  }

  const removeEvent = (id: string) => setEvents((prev) => prev.filter((e) => e.id !== id))

  const dateInfo = dateLabel(viewDate)

  return (
    <div className="space-y-4">
      {/* Busy banner */}
      {activeBusy.length > 0 && viewDate === '2024-08-22' && (
        <div className="rounded-xl border p-3 sm:p-4 flex items-start gap-3" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
          <Clock size={14} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700 mb-1">Currently In Session (10:30 AM)</p>
            <div className="flex flex-wrap gap-2">
              {activeBusy.map((ev) => {
                const owner = employees.find((e) => e.id === ev.ownerId)
                return (
                  <span key={ev.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: TYPE_COLORS[ev.type] + '20', color: TYPE_COLORS[ev.type] }}>
                    🔴 {owner?.name} — {ev.title}
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
            <p className="text-xs text-muted-foreground">Tap any time slot to add an event. Click existing events to remove.</p>
          </div>
        </div>
        <button onClick={openBlankModal} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shrink-0" style={{ backgroundColor: '#C9A96E', color: '#1C2B4A' }}>
          <Plus size={15} /> Add Event
        </button>
      </div>

      {/* Week strip date picker */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {WEEK_DATES.map((d) => {
          const { weekday, day, month, isToday } = dateLabel(d)
          const active = d === viewDate
          return (
            <button
              key={d}
              onClick={() => setViewDate(d)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl shrink-0 transition-all min-w-12"
              style={{
                backgroundColor: active ? '#1C2B4A' : isToday ? 'rgba(201,169,110,0.15)' : 'transparent',
                border: `1px solid ${active ? '#1C2B4A' : isToday ? '#C9A96E' : 'transparent'}`,
              }}
            >
              <span className="text-[10px] font-medium" style={{ color: active ? 'rgba(250,248,245,0.6)' : '#7A7065' }}>{weekday}</span>
              <span className="text-lg font-bold" style={{ color: active ? '#FAF8F5' : isToday ? '#C9A96E' : '#1C2B4A' }}>{day}</span>
              <span className="text-[10px]" style={{ color: active ? 'rgba(250,248,245,0.5)' : '#7A7065' }}>{month}</span>
            </button>
          )
        })}
      </div>

      {/* Calendar grid */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <p className="text-xs text-muted-foreground px-4 pt-2 pb-1 sm:hidden">← Scroll right to see all members</p>
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${72 + visibleEmployees.length * 110}px` }}>

            {/* Column headers */}
            <div className="flex border-b border-border sticky top-0 bg-card z-10">
              <div className="w-16 sm:w-20 shrink-0" />
              {visibleEmployees.map((emp) => {
                const isBusy = activeOwners.includes(emp.id)
                const isMe = emp.id === currentUserId
                return (
                  <div
                    key={emp.id}
                    className="w-24 sm:w-32 shrink-0 px-1 py-2 text-center border-l border-border"
                    style={{ backgroundColor: isMe ? 'rgba(201,169,110,0.06)' : undefined }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1" style={{ backgroundColor: isMe ? '#C9A96E' : 'rgba(28,43,74,0.1)', color: isMe ? '#1C2B4A' : '#1C2B4A' }}>
                      {emp.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <p className="text-[10px] sm:text-xs font-semibold text-foreground truncate">{emp.name.split(' ')[0]}</p>
                    <span className={`inline-flex items-center text-[9px] sm:text-[10px] font-medium px-1 py-0.5 rounded-full mt-0.5 ${isBusy ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isBusy ? '🔴 Busy' : '🟢 Free'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Time rows — each hour split into two 30-min halves */}
            {HOURS.map((hour) => (
              [false, true].map((half) => {
                const slotKey = `${hour}-${half ? '30' : '00'}`
                const slotHour = hour + (half ? 0.5 : 0)
                // Show hour label only on the :00 slot
                return (
                  <div key={slotKey} className={`flex ${half ? '' : 'border-t border-border'}`} style={{ minHeight: 32 }}>
                    <div className="w-16 sm:w-20 shrink-0 text-right pr-2 sm:pr-3 flex items-start pt-1">
                      {!half && <span className="text-[10px] sm:text-xs text-muted-foreground">{formatSlot(hour, false)}</span>}
                    </div>
                    {visibleEmployees.map((emp) => {
                      const isMe = emp.id === currentUserId
                      // Events that START in this 30-min slot
                      const slotEvents = dayEvents.filter((e) => {
                        const sh = parseHour(e.start)
                        return e.ownerId === emp.id && sh >= slotHour && sh < slotHour + 0.5
                      })
                      const canAdd = isMe || role === 'admin'
                      return (
                        <div
                          key={emp.id}
                          onClick={() => canAdd && slotEvents.length === 0 && handleSlotClick(hour, half, emp.id)}
                          className={`w-24 sm:w-32 shrink-0 border-l border-border relative ${half ? 'border-t border-dashed border-border/40' : ''}`}
                          style={{
                            backgroundColor: isMe ? 'rgba(201,169,110,0.03)' : undefined,
                            cursor: canAdd && slotEvents.length === 0 ? 'pointer' : 'default',
                          }}
                        >
                          {/* Hover hint for empty slots */}
                          {canAdd && slotEvents.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}>
                              <Plus size={12} className="text-accent" />
                            </div>
                          )}

                          {/* Events */}
                          {slotEvents.map((ev) => {
                            const startH = parseHour(ev.start)
                            const endH = parseHour(ev.end)
                            const durSlots = Math.max(1, Math.round((endH - startH) * 2))
                            const heightPx = durSlots * 32 - 2
                            const color = TYPE_COLORS[ev.type]
                            const canEdit = ev.ownerId === currentUserId || role === 'admin'
                            return (
                              <div
                                key={ev.id}
                                className="absolute left-0.5 right-0.5 top-0.5 rounded-lg px-1.5 py-1 text-white overflow-hidden group cursor-pointer z-10"
                                style={{ backgroundColor: color, height: `${heightPx}px` }}
                                onMouseEnter={() => setHoverEvent(ev.id)}
                                onMouseLeave={() => setHoverEvent(null)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p className="text-[10px] sm:text-xs font-semibold leading-tight truncate">{ev.title}</p>
                                <p className="text-[9px] sm:text-[10px] opacity-75 hidden sm:block">{ev.start.split(' ')[1]}–{ev.end.split(' ')[1]}</p>
                                {(hoverEvent === ev.id) && canEdit && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeEvent(ev.id) }}
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
            ))}
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

      {/* Add / Edit Event Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Event">
        <div className="space-y-4">
          {/* Category — first and most prominent */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Who is this with?</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'personal' as const, label: '🧑 Personal / Internal', desc: 'Team huddle, internal review' },
                { id: 'client' as const, label: '🤝 Client Meeting', desc: 'Call or visit with a lead/client' },
                { id: 'team' as const, label: '👥 Team Call', desc: 'Group call with your team' },
                { id: 'internal' as const, label: '🏢 Company', desc: 'Management or cross-team' },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setForm({ ...form, category: opt.id })}
                  className="text-left px-3 py-2.5 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: form.category === opt.id ? '#C9A96E' : '#E5DFD5',
                    backgroundColor: form.category === opt.id ? 'rgba(201,169,110,0.08)' : 'transparent',
                  }}
                >
                  <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Event Title</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && form.title.trim() && submitEvent()}
              placeholder={
                form.category === 'client' ? 'e.g. Call — Arjun Malhotra' :
                form.category === 'team' ? 'e.g. Team Alpha Huddle' :
                form.category === 'internal' ? 'e.g. Q3 Review Meeting' :
                'e.g. Personal block'
              }
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CalendarEvent['type'] })}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Start time</label>
              <div className="flex gap-1 items-center">
                <select value={form.startH} onChange={(e) => setForm({ ...form, startH: e.target.value })} className="flex-1 px-2 py-2.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none">
                  {HOURS.map((h) => <option key={h} value={pad2(h)}>{pad2(h)}</option>)}
                </select>
                <span className="text-muted-foreground text-sm font-bold">:</span>
                <select value={form.startM} onChange={(e) => setForm({ ...form, startM: e.target.value })} className="flex-1 px-2 py-2.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none">
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">End time</label>
              <div className="flex gap-1 items-center">
                <select value={form.endH} onChange={(e) => setForm({ ...form, endH: e.target.value })} className="flex-1 px-2 py-2.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none">
                  {HOURS.map((h) => <option key={h} value={pad2(h)}>{pad2(h)}</option>)}
                </select>
                <span className="text-muted-foreground text-sm font-bold">:</span>
                <select value={form.endM} onChange={(e) => setForm({ ...form, endM: e.target.value })} className="flex-1 px-2 py-2.5 rounded-lg border border-border bg-background text-sm text-center focus:outline-none">
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
              </div>
            </div>
          </div>

          {/* Preview chip */}
          {form.title.trim() && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white font-medium" style={{ backgroundColor: TYPE_COLORS[form.type] }}>
              <span>{form.title}</span>
              <span className="opacity-75 ml-auto">{form.startH}:{form.startM} – {form.endH}:{form.endM}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="pub2" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="rounded" />
            <label htmlFor="pub2" className="text-sm text-foreground select-none cursor-pointer">
              Visible to everyone as Busy
            </label>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              onClick={submitEvent}
              disabled={!form.title.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity flex items-center justify-center gap-1.5"
              style={{ backgroundColor: form.title.trim() ? TYPE_COLORS[form.type] : '#D7CFC2', color: '#fff', opacity: form.title.trim() ? 1 : 0.6 }}
            >
              <CheckCircle2 size={14} /> Save Event
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
