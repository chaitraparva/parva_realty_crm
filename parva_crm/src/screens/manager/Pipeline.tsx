import { GitBranch } from 'lucide-react'
import { useData } from '../../contexts/DataContext'
import { PIPELINE_STAGES } from '../../utils/pipeline'

export default function Pipeline() {
  const { leads } = useData()
  const stageCounts = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: leads.filter((l) => l.status === stage).length,
  }))

  const hasData = leads.length > 0

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-lg font-semibold text-foreground">Lead Pipeline</h2>
        <p className="text-xs text-muted-foreground">Leads across all SOP stages</p>
      </div>

      {!hasData ? (
        <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
          <GitBranch size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm font-medium text-foreground">No leads in pipeline yet</p>
          <p className="text-xs text-muted-foreground mt-1">Pipeline stages will populate as leads are added and progressed through the SOP.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-3">
          {stageCounts.map((s) => (
            <div key={s.stage} className="flex items-center gap-4">
              <span className="text-xs font-medium text-muted-foreground w-52 shrink-0">{s.stage}</span>
              <div className="flex-1 h-7 rounded-lg bg-muted overflow-hidden">
                {s.count > 0 && (
                  <div className="h-full rounded-lg flex items-center px-3" style={{ width: `${Math.max(5, (s.count / leads.length) * 100)}%`, backgroundColor: '#1C2B4A' }}>
                    <span className="text-xs font-semibold text-white">{s.count}</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{s.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
