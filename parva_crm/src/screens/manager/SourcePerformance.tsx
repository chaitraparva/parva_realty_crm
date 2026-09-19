import { PieChart } from 'lucide-react'

export default function SourcePerformance() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-lg font-semibold text-foreground">Source Performance</h2>
        <p className="text-xs text-muted-foreground">Conversion rates by lead source</p>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
        <PieChart size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm font-medium text-foreground">No source data yet</p>
        <p className="text-xs text-muted-foreground mt-1">Source performance analytics will appear once leads are added with source information.</p>
      </div>
    </div>
  )
}
