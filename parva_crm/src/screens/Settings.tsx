import { useState } from 'react'
import { RotateCcw, Bell, Moon } from 'lucide-react'

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

export default function Settings({ darkMode = false, onToggleDarkMode }: SettingsProps) {
  const [roundRobin, setRoundRobin] = useState(DEFAULTS.roundRobin)
  const [autoAssign, setAutoAssign] = useState(DEFAULTS.autoAssign)
  const [followUpHours, setFollowUpHours] = useState(DEFAULTS.followUpHours)
  const [unassignedAlert, setUnassignedAlert] = useState(DEFAULTS.unassignedAlert)
  const [notifMissedFollowup, setNotifMissedFollowup] = useState(DEFAULTS.notifMissedFollowup)
  const [notifUnassigned, setNotifUnassigned] = useState(DEFAULTS.notifUnassigned)
  const [notifPayroll, setNotifPayroll] = useState(DEFAULTS.notifPayroll)
  const [notifLeave, setNotifLeave] = useState(DEFAULTS.notifLeave)
  const [saved, setSaved] = useState(false)
  const [justReset, setJustReset] = useState(false)

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
    setTimeout(() => setJustReset(false), 2000)
  }

  const save = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className="relative w-11 h-6 rounded-full transition-all"
      style={{ backgroundColor: value ? '#C9A96E' : '#E5DFD5' }}
    >
      <div className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all" style={{ left: value ? '22px' : '2px' }} />
    </button>
  )

  return (
    <div className="max-w-3xl space-y-6">
      {/* Appearance */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}>
            <Moon size={16} className="text-accent" />
          </div>
          <div>
            <h3 className="font-serif text-base font-semibold text-foreground">Appearance</h3>
            <p className="text-xs text-muted-foreground">Choose how Parva CRM looks on this device</p>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Dark Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">Switch to a dark color scheme</p>
            </div>
            <Toggle value={darkMode} onChange={() => onToggleDarkMode?.()} />
          </div>
        </div>
      </div>

      {/* Lead Assignment */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}>
            <RotateCcw size={16} className="text-accent" />
          </div>
          <div>
            <h3 className="font-serif text-base font-semibold text-foreground">Lead Assignment</h3>
            <p className="text-xs text-muted-foreground">Configure how new leads are distributed to agents</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Round-robin Auto-assignment</p>
              <p className="text-xs text-muted-foreground mt-0.5">New leads are automatically assigned to agents in rotation</p>
            </div>
            <Toggle value={roundRobin} onChange={setRoundRobin} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Auto-assign on Lead Creation</p>
              <p className="text-xs text-muted-foreground mt-0.5">Assign immediately when a lead enters the system</p>
            </div>
            <Toggle value={autoAssign} onChange={setAutoAssign} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">Unassigned Lead Alert Threshold</p>
            <div className="flex items-center gap-3">
              <input type="number" value={unassignedAlert} onChange={(e) => setUnassignedAlert(e.target.value)}
                className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <span className="text-sm text-muted-foreground">hours before alert is triggered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}>
            <Bell size={16} className="text-accent" />
          </div>
          <div>
            <h3 className="font-serif text-base font-semibold text-foreground">Notification Rules</h3>
            <p className="text-xs text-muted-foreground">Configure which alerts are sent and when</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {[
            { label: 'Missed Follow-up Alerts', desc: 'Alert when lead has no activity for the set threshold', value: notifMissedFollowup, onChange: setNotifMissedFollowup },
            { label: 'Unassigned Lead Alerts', desc: 'Alert managers when leads remain unassigned', value: notifUnassigned, onChange: setNotifUnassigned },
            { label: 'Payroll Reminders', desc: 'Remind approvers of pending payroll actions', value: notifPayroll, onChange: setNotifPayroll },
            { label: 'Leave Request Alerts', desc: 'Notify managers of pending leave requests', value: notifLeave, onChange: setNotifLeave },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <Toggle value={item.value} onChange={item.onChange} />
            </div>
          ))}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">Follow-up Inactivity Threshold</p>
            <div className="flex items-center gap-3">
              <input type="number" value={followUpHours} onChange={(e) => setFollowUpHours(e.target.value)}
                className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <span className="text-sm text-muted-foreground">hours of inactivity triggers missed-follow-up alert</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={resetToDefaults}
          className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {justReset ? '✓ Reset' : 'Reset to Defaults'}
        </button>
        <button onClick={save} className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ backgroundColor: saved ? '#10B981' : '#1C2B4A', color: '#FAF8F5' }}>
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
