import { useState } from 'react'
import { ClipboardList, Search } from 'lucide-react'
import type { AuditEntry } from '../../types'

interface AuditLogProps {
  entries: AuditEntry[]
}

export default function AuditLog({ entries }: AuditLogProps) {
  const [search, setSearch] = useState('')

  const filtered = entries
    .filter((e) =>
      !search ||
      e.actorName.toLowerCase().includes(search.toLowerCase()) ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.details.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">Audit Log</h2>
          <p className="text-xs text-muted-foreground">A record of sensitive actions — payroll sign-offs, flags, and lead cancellations</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by person or action"
            className="pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 w-64"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
        {filtered.map((entry) => (
          <div key={entry.id} className="flex items-start gap-4 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(28,43,74,0.08)' }}>
              <ClipboardList size={16} color="#1C2B4A" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{entry.action}</p>
                <span className="text-xs text-muted-foreground">by {entry.actorName}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{entry.details}</p>
              {(entry.previousValue || entry.newValue) && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  {entry.previousValue && <span className="line-through opacity-60">{entry.previousValue}</span>}
                  {entry.previousValue && entry.newValue && <span>→</span>}
                  {entry.newValue && <span className="font-medium text-foreground">{entry.newValue}</span>}
                </p>
              )}
              {entry.reason && <p className="text-xs text-amber-700 mt-0.5">Reason: {entry.reason}</p>}
              <p className="text-xs text-muted-foreground mt-1">{entry.timestamp}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-12 text-sm text-muted-foreground">No audit entries match your search</p>
        )}
      </div>
    </div>
  )
}
