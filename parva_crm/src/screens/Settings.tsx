import { useEffect, useState } from 'react'
import { RotateCcw, Bell, Moon, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getCurrentEmployee } from '../services/chatService'

const DEFAULTS = {
  roundRobin: true,
  autoAssign: true,
  followUpHours: '24',
  unassignedAlert: '4',
  notifMissedFollowup: true,
  notifUnassigned: true,
  notifPayroll: true,
  notifLeave: true,
}

interface SettingsProps {
  darkMode?: boolean
  onToggleDarkMode?: () => void
}

interface EmployeeSettingsRow {
  employee_id: string
  dark_mode: boolean
  round_robin: boolean
  auto_assign: boolean
  follow_up_hours: number
  unassigned_alert_hours: number
  notif_missed_followup: boolean
  notif_unassigned: boolean
  notif_payroll: boolean
  notif_leave: boolean
}

export default function Settings({
  darkMode = false,
  onToggleDarkMode,
}: SettingsProps) {
  const [roundRobin, setRoundRobin] = useState(DEFAULTS.roundRobin)
  const [autoAssign, setAutoAssign] = useState(DEFAULTS.autoAssign)
  const [followUpHours, setFollowUpHours] = useState(DEFAULTS.followUpHours)
  const [unassignedAlert, setUnassignedAlert] = useState(
    DEFAULTS.unassignedAlert
  )

  const [notifMissedFollowup, setNotifMissedFollowup] = useState(
    DEFAULTS.notifMissedFollowup
  )
  const [notifUnassigned, setNotifUnassigned] = useState(
    DEFAULTS.notifUnassigned
  )
  const [notifPayroll, setNotifPayroll] = useState(DEFAULTS.notifPayroll)
  const [notifLeave, setNotifLeave] = useState(DEFAULTS.notifLeave)

  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [justReset, setJustReset] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadSettings = async () => {
      try {
        setLoading(true)
        setError('')

        const employee = await getCurrentEmployee()

        if (!active) return

        setEmployeeId(employee.id)

        const { data, error: settingsError } = await supabase
          .from('employee_settings')
          .select(`
            employee_id,
            dark_mode,
            round_robin,
            auto_assign,
            follow_up_hours,
            unassigned_alert_hours,
            notif_missed_followup,
            notif_unassigned,
            notif_payroll,
            notif_leave
          `)
          .eq('employee_id', employee.id)
          .maybeSingle()

        if (settingsError) throw settingsError

        if (!active) return

        if (!data) {
          const { error: insertError } = await supabase
            .from('employee_settings')
            .insert({
              employee_id: employee.id,
              dark_mode: false,
              round_robin: DEFAULTS.roundRobin,
              auto_assign: DEFAULTS.autoAssign,
              follow_up_hours: Number(DEFAULTS.followUpHours),
              unassigned_alert_hours: Number(DEFAULTS.unassignedAlert),
              notif_missed_followup: DEFAULTS.notifMissedFollowup,
              notif_unassigned: DEFAULTS.notifUnassigned,
              notif_payroll: DEFAULTS.notifPayroll,
              notif_leave: DEFAULTS.notifLeave,
            })

          if (insertError) throw insertError

          return
        }

        const settings = data as EmployeeSettingsRow

        setRoundRobin(settings.round_robin)
        setAutoAssign(settings.auto_assign)
        setFollowUpHours(String(settings.follow_up_hours))
        setUnassignedAlert(String(settings.unassigned_alert_hours))
        setNotifMissedFollowup(settings.notif_missed_followup)
        setNotifUnassigned(settings.notif_unassigned)
        setNotifPayroll(settings.notif_payroll)
        setNotifLeave(settings.notif_leave)
      } catch (err) {
        console.error('Could not load employee settings:', err)

        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : 'Could not load your settings.'
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSettings()

    return () => {
      active = false
    }
  }, [])

  const resetToDefaults = () => {
    setRoundRobin(DEFAULTS.roundRobin)
    setAutoAssign(DEFAULTS.autoAssign)
    setFollowUpHours(DEFAULTS.followUpHours)
    setUnassignedAlert(DEFAULTS.unassignedAlert)
    setNotifMissedFollowup(DEFAULTS.notifMissedFollowup)
    setNotifUnassigned(DEFAULTS.notifUnassigned)
    setNotifPayroll(DEFAULTS.notifPayroll)
    setNotifLeave(DEFAULTS.notifLeave)

    setJustReset(true)

    window.setTimeout(() => {
      setJustReset(false)
    }, 2000)
  }

  const save = async () => {
    if (!employeeId) {
      setError('Your employee profile could not be resolved.')
      return
    }

    const followUpValue = Number(followUpHours)
    const unassignedValue = Number(unassignedAlert)

    if (!Number.isFinite(followUpValue) || followUpValue < 1) {
      setError('Follow-up threshold must be at least 1 hour.')
      return
    }

    if (!Number.isFinite(unassignedValue) || unassignedValue < 1) {
      setError('Unassigned lead alert threshold must be at least 1 hour.')
      return
    }

    try {
      setSaving(true)
      setSaved(false)
      setError('')

      const { error: saveError } = await supabase
        .from('employee_settings')
        .upsert(
          {
            employee_id: employeeId,
            dark_mode: darkMode,
            round_robin: roundRobin,
            auto_assign: autoAssign,
            follow_up_hours: followUpValue,
            unassigned_alert_hours: unassignedValue,
            notif_missed_followup: notifMissedFollowup,
            notif_unassigned: notifUnassigned,
            notif_payroll: notifPayroll,
            notif_leave: notifLeave,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'employee_id',
          }
        )

      if (saveError) throw saveError

      setSaved(true)

      window.setTimeout(() => {
        setSaved(false)
      }, 2000)
    } catch (err) {
      console.error('Could not save employee settings:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your settings.'
      )
    } finally {
      setSaving(false)
    }
  }

  const Toggle = ({
    value,
    onChange,
  }: {
    value: boolean
    onChange: (v: boolean) => void
  }) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative w-11 h-6 rounded-full transition-all shrink-0"
      style={{
        backgroundColor: value ? '#C9A96E' : '#E5DFD5',
      }}
      aria-pressed={value}
    >
      <div
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all"
        style={{
          left: value ? '22px' : '2px',
        }}
      />
    </button>
  )

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="bg-card rounded-xl border border-border shadow-sm p-10 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          Loading your settings...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {error && (
        <div
          className="px-4 py-3 rounded-lg border text-sm"
          style={{
            backgroundColor: '#FEF2F2',
            borderColor: '#FECACA',
            color: '#DC2626',
          }}
        >
          {error}
        </div>
      )}

      {/* Appearance */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}
          >
            <Moon size={16} className="text-accent" />
          </div>

          <div>
            <h3 className="font-serif text-base font-semibold text-foreground">
              Appearance
            </h3>
            <p className="text-xs text-muted-foreground">
              Choose how Parva CRM looks on this device
            </p>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Dark Mode
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Switch to a dark color scheme
              </p>
            </div>

            <Toggle
              value={darkMode}
              onChange={() => onToggleDarkMode?.()}
            />
          </div>
        </div>
      </div>

      {/* Lead Assignment */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}
          >
            <RotateCcw size={16} className="text-accent" />
          </div>

          <div>
            <h3 className="font-serif text-base font-semibold text-foreground">
              Lead Assignment
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure how new leads are distributed to agents
            </p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Round-robin Auto-assignment
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                New leads are automatically assigned to agents in rotation
              </p>
            </div>

            <Toggle
              value={roundRobin}
              onChange={setRoundRobin}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Auto-assign on Lead Creation
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign immediately when a lead enters the system
              </p>
            </div>

            <Toggle
              value={autoAssign}
              onChange={setAutoAssign}
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground mb-2">
              Unassigned Lead Alert Threshold
            </p>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={unassignedAlert}
                onChange={(e) => setUnassignedAlert(e.target.value)}
                className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />

              <span className="text-sm text-muted-foreground">
                hours before alert is triggered
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}
          >
            <Bell size={16} className="text-accent" />
          </div>

          <div>
            <h3 className="font-serif text-base font-semibold text-foreground">
              Notification Rules
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure which alerts are sent and when
            </p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {[
            {
              label: 'Missed Follow-up Alerts',
              desc: 'Alert when lead has no activity for the set threshold',
              value: notifMissedFollowup,
              onChange: setNotifMissedFollowup,
            },
            {
              label: 'Unassigned Lead Alerts',
              desc: 'Alert managers when leads remain unassigned',
              value: notifUnassigned,
              onChange: setNotifUnassigned,
            },
            {
              label: 'Payroll Reminders',
              desc: 'Remind approvers of pending payroll actions',
              value: notifPayroll,
              onChange: setNotifPayroll,
            },
            {
              label: 'Leave Request Alerts',
              desc: 'Notify managers of pending leave requests',
              value: notifLeave,
              onChange: setNotifLeave,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {item.label}
                </p>

                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.desc}
                </p>
              </div>

              <Toggle
                value={item.value}
                onChange={item.onChange}
              />
            </div>
          ))}

          <div>
            <p className="text-sm font-semibold text-foreground mb-2">
              Follow-up Inactivity Threshold
            </p>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={followUpHours}
                onChange={(e) => setFollowUpHours(e.target.value)}
                className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />

              <span className="text-sm text-muted-foreground">
                hours of inactivity triggers missed-follow-up alert
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={resetToDefaults}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {justReset ? '✓ Reset' : 'Reset to Defaults'}
        </button>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
          style={{
            backgroundColor: saved ? '#10B981' : '#1C2B4A',
            color: '#FAF8F5',
          }}
        >
          {saving && <Loader2 size={15} className="animate-spin" />}

          {saved
            ? '✓ Saved!'
            : saving
              ? 'Saving...'
              : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}