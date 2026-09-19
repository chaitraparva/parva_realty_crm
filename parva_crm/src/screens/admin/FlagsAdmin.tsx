import { useState } from 'react'
import { SeverityBadge } from '../../components/ui/Badge'
import { AlertTriangle, TrendingDown, Users } from 'lucide-react'
import type { Flag } from '../../types'

interface FlagsAdminProps {
  flagList: Flag[]
  setFlagList: React.Dispatch<React.SetStateAction<Flag[]>>
}

export default function FlagsAdmin({ flagList, setFlagList }: FlagsAdminProps) {
  const [filter, setFilter] = useState<'All' | 'Open' | 'Acknowledged' | 'Resolved'>('All')

  const resolve = (id: string) => setFlagList((prev) => prev.map((f) => f.id === id ? { ...f, status: 'Resolved' as const } : f))

  const filtered = filter === 'All' ? flagList : flagList.filter((f) => f.status === filter)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Total Flags', value: flagList.length, color: '#1C2B4A', bg: 'rgba(28,43,74,0.08)' },
          { label: 'Open', value: flagList.filter((f) => f.status === 'Open').length, color: '#EF4444', bg: '#FEF2F2' },
          { label: 'High Severity', value: flagList.filter((f) => f.severity === 'High').length, color: '#DC2626', bg: '#FEE2E2' },
          { label: 'Resolved', value: flagList.filter((f) => f.status === 'Resolved').length, color: '#10B981', bg: '#ECFDF5' },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg }}>
              <AlertTriangle size={20} style={{ color: s.color }} />
            </div>
            <div>
              <p className="font-serif text-3xl font-semibold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground">Company-wide Flags & Warnings</h3>
            <p className="text-xs text-muted-foreground mt-0.5">All teams — 2024</p>
          </div>
          <div className="flex gap-2">
            {(['All', 'Open', 'Acknowledged', 'Resolved'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ backgroundColor: filter === f ? '#1C2B4A' : '#F5F2EC', color: filter === f ? '#FAF8F5' : '#7A7065' }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border">
          {filtered.map((flag) => (
            <div key={flag.id} className={`p-5 ${flag.severity === 'High' && flag.status === 'Open' ? 'bg-red-50/30' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${flag.severity === 'High' ? 'bg-red-50' : flag.severity === 'Medium' ? 'bg-amber-50' : 'bg-teal-50'}`}>
                  <AlertTriangle size={18} className={flag.severity === 'High' ? 'text-red-500' : flag.severity === 'Medium' ? 'text-amber-500' : 'text-teal-500'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                      <Users size={14} className="text-muted-foreground" />
                      {flag.employeeName}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">{flag.type}</span>
                    <SeverityBadge severity={flag.severity} />
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${flag.status === 'Open' ? 'bg-red-50 text-red-600' : flag.status === 'Acknowledged' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {flag.status}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-2">{flag.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Issued by <strong>{flag.issuedBy}</strong></span>
                    <span>on {flag.date}</span>
                  </div>
                </div>
                {flag.status !== 'Resolved' && (
                  <button onClick={() => resolve(flag.id)} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors">
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <TrendingDown size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">No flags in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
