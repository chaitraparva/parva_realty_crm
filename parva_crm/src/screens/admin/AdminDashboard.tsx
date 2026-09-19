import { LayoutDashboard, Users, Target, Building2 } from 'lucide-react'
import { projects } from '../../data/mockData'
import { useData } from '../../contexts/DataContext'
import KPICard from '../../components/ui/KPICard'

export default function AdminDashboard() {
  const { employees, leads } = useData()
  const totalLeads = leads.length
  const teamSize = employees.filter((e) => e.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <KPICard title="Total Leads"      value={totalLeads || '—'} sub="Active pipeline"     accent icon={<Target size={18} />} />
        <KPICard title="Team Members"     value={teamSize}          sub="Across India & Dubai"       icon={<Users size={18} />} />
        <KPICard title="Properties Listed" value={projects.length}  sub="In inventory"               icon={<Building2 size={18} />} />
        <KPICard title="Conversions"      value="—"                 sub="No data yet"                icon={<LayoutDashboard size={18} />} />
      </div>

      {/* Team overview */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h3 className="font-serif text-lg font-semibold text-foreground mb-5">Team</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Name', 'Designation', 'Office', 'Email', 'Status'].map((h) => (
                  <th key={h} className="pb-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-6 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-border last:border-0">
                  <td className="py-3.5 pr-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}>
                        {emp.name.split(' ').map((n) => n[0]).join('').slice(0,2)}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{emp.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 pr-6 text-sm text-muted-foreground">
                    {emp.department || (emp.role === 'admin' ? 'Director' : 'Sales Manager')}
                  </td>
                  <td className="py-3.5 pr-6">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${emp.office === 'Dubai' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
                      {emp.office === 'Dubai' ? '🇦🇪 Dubai' : '🇮🇳 India'}
                    </span>
                  </td>
                  <td className="py-3.5 pr-6 text-sm text-muted-foreground">{emp.email}</td>
                  <td className="py-3.5">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700">Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty state for data */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-10 text-center">
        <LayoutDashboard size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm font-medium text-foreground mb-1">No performance data yet</p>
        <p className="text-xs text-muted-foreground">Revenue, conversion trends and pipeline reports will appear here once leads are added.</p>
      </div>
    </div>
  )
}
