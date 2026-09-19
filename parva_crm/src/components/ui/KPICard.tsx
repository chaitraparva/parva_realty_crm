interface KPICardProps {
  title: string
  value: string | number
  sub?: string
  trend?: { value: string; up: boolean }
  accent?: boolean
  icon?: React.ReactNode
}

export default function KPICard({ title, value, sub, trend, accent, icon }: KPICardProps) {
  return (
    <div className={`bg-card rounded-xl p-4 sm:p-5 shadow-sm border border-border flex flex-col ${accent ? 'border-l-4 border-l-accent' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest leading-tight">{title}</p>
        {icon && <div className="text-muted-foreground opacity-60 shrink-0 ml-1">{icon}</div>}
      </div>
      <p className="font-serif text-2xl sm:text-3xl font-semibold text-foreground mb-1">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-auto">{sub}</p>}
      {trend && (
        <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-emerald-600' : 'text-red-600'}`}>
          <span>{trend.up ? '↑' : '↓'}</span>
          <span>{trend.value} vs last month</span>
        </div>
      )}
    </div>
  )
}
