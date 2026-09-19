import { useData } from '../../contexts/DataContext'
import { Users } from 'lucide-react'
import KPICard from '../../components/ui/KPICard'

interface TeamOverviewProps {
  navigate: (screen: string, params?: Record<string, string>) => void
}

export default function TeamOverview({ navigate }: TeamOverviewProps) {
  const { employees, leads } = useData()
  const team = employees.filter((e) => e.role !== 'admin')
  const totalLeads = leads.length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        <KPICard title="Team Size"   value={team.length}  sub="Active members" accent icon={<Users size={18} />} />
        <KPICard title="Total Leads" value={totalLeads || '—'} sub="In pipeline" />
        <KPICard title="Conversions" value="—" sub="No data yet" />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-5 border-b border-border">
          <h3 className="font-serif text-base font-semibold text-foreground">Team Members</h3>
        </div>
        <div className="divide-y divide-border">
          {team.map((emp) => (
            <div key={emp.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors flex-wrap">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}>
                {emp.name.split(' ').map((n) => n[0]).join('').slice(0,2)}
              </div>
              <div className="flex-1 min-w-40">
                <p className="text-sm font-semibold text-foreground">{emp.name}</p>
                <p className="text-xs text-muted-foreground">
                  {emp.department || 'Sales Manager'}
                  {' · '}{emp.email}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${emp.office === 'Dubai' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
                {emp.office === 'Dubai' ? '🇦🇪 Dubai' : '🇮🇳 India'}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700">Active</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
