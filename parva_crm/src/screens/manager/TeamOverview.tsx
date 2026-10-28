import { useData } from '../../contexts/DataContext'
import KPICard from '../../components/ui/KPICard'
import { Users, Target, TrendingUp } from 'lucide-react'
import { FINAL_STAGE, PIPELINE_STAGES, STAGE_COLORS } from '../../utils/pipeline'
import type { Role } from '../../types'

interface TeamOverviewProps {
  role?: Role
  currentUserId?: string
  navigate?: (screen: string, params?: Record<string, string>) => void
}

// Lead Acquisition Manager view: who is handling which lead, and where it is
// in the sales process.
function AcquisitionTeamOverview({ currentUserId = '', navigate }: Pick<TeamOverviewProps, 'currentUserId' | 'navigate'>) {
  const { employees, leads } = useData()

  const team = employees.filter(
    (e) => e.managerId === currentUserId && e.status === 'active'
  )
  const people = [
    ...employees.filter((e) => e.id === currentUserId),
    ...team,
  ]
  const liveLeads = leads.filter((l) => l.status !== 'Cancelled')
  const unassigned = liveLeads.filter((l) => !l.assignedTo)
  const conversions = leads.filter((l) => l.status === FINAL_STAGE).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="My Team" value={team.length} sub="People reporting to you" accent icon={<Users size={18} />} />
        <KPICard title="Total Leads" value={liveLeads.length} sub="Created by you or your team" icon={<Target size={18} />} />
        <KPICard title="Conversions" value={conversions} sub="Deals finalized" icon={<TrendingUp size={18} />} />
      </div>

      {team.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
          No one reports to you yet. Once the Super Admin adds your team, each person&apos;s leads and their stages will show here.
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-serif text-lg text-foreground mb-1">Not assigned yet</h2>
          <p className="text-xs text-muted-foreground mb-3">{unassigned.length} lead{unassigned.length === 1 ? '' : 's'} waiting for you to assign</p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((l) => (
              <button key={l.id} onClick={() => navigate?.('lead-detail', { leadId: l.id })} className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted">
                {l.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {people.map((person) => {
        const mine = liveLeads.filter((l) => l.assignedTo === person.id)
        const isMe = person.id === currentUserId
        return (
          <div key={person.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">{person.name}{isMe ? ' (you)' : ''}</p>
                <p className="text-xs text-muted-foreground">{person.department || 'Sales'} · {person.office}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                {mine.length} lead{mine.length === 1 ? '' : 's'}
              </span>
            </div>

            {mine.length > 0 && (
              <div className="flex flex-wrap gap-2 px-5 pt-4">
                {PIPELINE_STAGES.map((stage) => {
                  const count = mine.filter((l) => l.status === stage).length
                  if (!count) return null
                  return (
                    <span key={stage} className="text-[11px] font-medium px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: STAGE_COLORS[stage] }}>
                      {stage} · {count}
                    </span>
                  )
                })}
              </div>
            )}

            <div className="divide-y divide-border mt-3">
              {mine.length === 0 ? (
                <p className="px-5 py-4 text-xs text-muted-foreground">No leads assigned.</p>
              ) : (
                mine.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => navigate?.('lead-detail', { leadId: l.id })}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.lastActivity ? `Last activity ${l.lastActivity}` : 'No activity yet'}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full text-white shrink-0" style={{ backgroundColor: STAGE_COLORS[l.status] }}>
                      {l.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TeamOverview({ role, currentUserId, navigate }: TeamOverviewProps = {}) {
  if (role === 'acquisition_manager') {
    return <AcquisitionTeamOverview currentUserId={currentUserId} navigate={navigate} />
  }
  return <SalesTeamOverview />
}

function SalesTeamOverview() {
  const { employees, leads } = useData()

  const activeMembers = employees.filter(
    (employee) => employee.status === 'active'
  ).length

  const totalLeads = leads.filter(
    (lead) => lead.status !== 'Cancelled'
  ).length

  const conversions = leads.filter(
    (lead) => lead.status === FINAL_STAGE
  ).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Team Size"
          value={activeMembers}
          sub="Active members"
          accent
          icon={<Users size={18} />}
        />

        <KPICard
          title="Total Leads"
          value={totalLeads}
          sub="In pipeline"
          icon={<Target size={18} />}
        />

        <KPICard
          title="Conversions"
          value={conversions}
          sub="Deals finalized"
          icon={<TrendingUp size={18} />}
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-serif text-lg text-foreground">
            Team Members
          </h2>
        </div>

        <div className="divide-y divide-border">
          {employees
            .filter(
              (employee) => employee.status === 'active'
            )
            .map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {employee.name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {employee.department || 'Sales'} ·{' '}
                    {employee.email}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {employee.office || 'India'}
                  </span>

                  <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">
                    Active
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}