import { useEffect, useMemo, useState } from 'react'
import { Search, X, User, Target, Users, CalendarClock, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useData } from '../../contexts/DataContext'
import { StatusBadge } from '../ui/Badge'
import type { Group } from '../../types'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
  onNavigate: (screen: string, params?: Record<string, string>) => void
  groupList?: Group[]
}

export default function GlobalSearch({ open, onClose, onNavigate, groupList = [] }: GlobalSearchProps) {
  const { leads, employees } = useData()
  const [q, setQ] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string; location: string }[]>([])
  const [units, setUnits] = useState<{ id: string; unitNumber: string; bhk: string; projectId: string }[]>([])
  const [siteVisits, setSiteVisits] = useState<{ id: string; leadName: string; projectName: string; date: string }[]>([])

  useEffect(() => {
    if (!open) {
      setQ('')
      return
    }
    let active = true
    async function loadSearchData() {
      try {
        const [pRes, uRes, vRes] = await Promise.all([
          supabase.from('inventory_projects').select('id, name, location'),
          supabase.from('inventory_units').select('id, unit_number, bhk, project_id'),
          supabase.from('site_visits').select('id, lead_id, location, date')
        ])
        if (!active) return
        if (pRes.data) {
          setProjects(pRes.data.map((p) => ({ id: p.id, name: p.name, location: p.location || '' })))
        }
        if (uRes.data) {
          setUnits(uRes.data.map((u) => ({ id: u.id, unitNumber: u.unit_number, bhk: u.bhk || '', projectId: u.project_id })))
        }
        if (vRes.data) {
          setSiteVisits(vRes.data.map((v) => {
            const lead = leads.find((l) => l.id === v.lead_id)
            return {
              id: v.id,
              leadName: lead?.name || 'Site Visit Lead',
              projectName: v.location || 'Property',
              date: v.date || ''
            }
          }))
        }
      } catch (err) {
        console.error('Failed to load search data', err)
      }
    }
    loadSearchData()
    return () => { active = false }
  }, [open, leads])

  const leadResults = useMemo(
    () => (q ? leads.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()) || l.phone.includes(q)).slice(0, 5) : []),
    [q, leads]
  )
  const peopleResults = useMemo(
    () => (q ? employees.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : []),
    [q, employees]
  )
  const groupResults = useMemo(
    () => (q ? groupList.filter((g) => g.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : []),
    [q, groupList]
  )
  const visitResults = useMemo(
    () => (q ? siteVisits.filter((v) => v.leadName.toLowerCase().includes(q.toLowerCase()) || v.projectName.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : []),
    [q, siteVisits]
  )
  const propertyResults = useMemo(() => {
    if (!q) return []
    const projectMatches = projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.location.toLowerCase().includes(q.toLowerCase()))
    const unitMatches = units.filter((u) => u.unitNumber.toLowerCase().includes(q.toLowerCase()))
    return [
      ...projectMatches.map((p) => ({ label: p.name, sub: p.location })),
      ...unitMatches.map((u) => ({ label: u.unitNumber, sub: `${u.bhk} · ${projects.find((p) => p.id === u.projectId)?.name || 'Property'}` }))
    ].slice(0, 5)
  }, [q, projects, units])

  const noResults = q && !leadResults.length && !peopleResults.length && !groupResults.length && !visitResults.length && !propertyResults.length

  if (!open) return null

  const goToLead = (leadId: string) => {
    onNavigate('lead-detail', { leadId })
    onClose()
  }
  const goToPerson = (employeeId: string) => {
    onNavigate('messages', { employeeId })
    onClose()
  }
  const goToGroup = (groupId: string) => {
    onNavigate('messages', { groupId })
    onClose()
  }
  const goToVisits = () => {
    onNavigate('site-visits')
    onClose()
  }
  const goToInventory = () => {
    onNavigate('inventory')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-card rounded-2xl border border-border shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search leads, people, groups, visits, properties…"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {noResults && (
            <p className="text-center py-8 text-sm text-muted-foreground">No matches for "{q}"</p>
          )}
          {leadResults.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Leads</p>
              {leadResults.map((l) => (
                <button
                  key={l.id}
                  onClick={() => goToLead(l.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <Target size={14} className="text-accent shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{l.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">{l.phone} · {l.location}</span>
                  </span>
                  <StatusBadge status={l.status} compact />
                </button>
              ))}
            </div>
          )}
          {peopleResults.length > 0 && (
            <div className="py-2 border-t border-border">
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">People</p>
              {peopleResults.map((e) => (
                <button
                  key={e.id}
                  onClick={() => goToPerson(e.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <User size={14} className="text-primary shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{e.name}</span>
                    <span className="block text-xs text-muted-foreground truncate capitalize">{e.role} · {e.team}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {groupResults.length > 0 && (
            <div className="py-2 border-t border-border">
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Groups</p>
              {groupResults.map((g) => (
                <button
                  key={g.id}
                  onClick={() => goToGroup(g.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <Users size={14} className="text-accent shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{g.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">{g.memberIds.length} members</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {visitResults.length > 0 && (
            <div className="py-2 border-t border-border">
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Site Visits</p>
              {visitResults.map((v) => (
                <button
                  key={v.id}
                  onClick={goToVisits}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <CalendarClock size={14} className="text-orange-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{v.leadName}</span>
                    <span className="block text-xs text-muted-foreground truncate">{v.projectName} · {v.date}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {propertyResults.length > 0 && (
            <div className="py-2 border-t border-border">
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Property Inventory</p>
              {propertyResults.map((p) => (
                <button
                  key={p.label}
                  onClick={goToInventory}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <Building2 size={14} className="text-primary shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{p.label}</span>
                    <span className="block text-xs text-muted-foreground truncate">{p.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {!q && (
            <p className="text-center py-8 text-xs text-muted-foreground">Type to search, or press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Esc</kbd> to close</p>
          )}
        </div>
      </div>
    </div>
  )
}
