import { FileText } from 'lucide-react'

export default function Reports() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-lg font-semibold text-foreground">Reports Center</h2>
        <p className="text-xs text-muted-foreground">Export and review business reports</p>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
        <FileText size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm font-medium text-foreground">No reports available yet</p>
        <p className="text-xs text-muted-foreground mt-1">Reports will be generated automatically as leads, payroll and activity data accumulates.</p>
      </div>
    </div>
  )
}
