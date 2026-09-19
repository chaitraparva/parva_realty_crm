import { useData } from '../../contexts/DataContext'
import KPICard from '../../components/ui/KPICard'
import { Users, Target, TrendingUp } from 'lucide-react'
import { FINAL_STAGE } from '../../utils/pipeline'

export default function TeamOverview() {
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