import { TrendingUp, Target, Clock, Star, BarChart2 } from 'lucide-react'
import KPICard from '../../components/ui/KPICard'

export default function Performance() {
  return (
    <div className="space-y-6">
      {/* KPI tiles — all empty until real data flows in */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <KPICard title="Leads Worked"      value="—" sub="No data yet"  accent icon={<Target size={18} />} />
        <KPICard title="Conversions"       value="—" sub="No data yet"  icon={<TrendingUp size={18} />} />
        <KPICard title="Avg Response Time" value="—" sub="No data yet"  icon={<Clock size={18} />} />
        <KPICard title="Client Rating"     value="—" sub="No reviews yet" icon={<Star size={18} />} />
      </div>

      {/* Empty state */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: 'rgba(201,169,110,0.1)' }}>
          <BarChart2 size={28} style={{ color: '#C9A96E' }} />
        </div>
        <h3 className="font-serif text-xl font-semibold text-foreground mb-2">No performance data yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your performance metrics — leads worked, conversions, response time and commission — will appear here once you start logging lead activity.
        </p>
      </div>
    </div>
  )
}
