import { useState } from 'react'
import { useData } from '../../contexts/DataContext'
import { Mail, Phone, Search, Calendar, Briefcase, Target, TrendingUp, Users, BarChart2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { WorkloadBadge } from '../../components/ui/Badge'
import type { Role, Group, Employee } from '../../types'
import { currentUserByRole } from '../Messages'
import { getWorkloadStatus, getCapacityPct, getWorkloadColor } from '../../utils/aiAssignment'

const roleColors: Record<Role, { bg: string; text: string; border: string }> = {
  admin: { bg: '#1C2B4A', text: '#FAF8F5', border: '#1C2B4A' },
  manager: { bg: 'rgba(201,169,110,0.12)', text: '#1C2B4A', border: '#C9A96E' },
  agent: { bg: '#F5F2EC', text: '#1C2B4A', border: '#E5DFD5' },
}

const roleLabels: Record<Role, string> = {
  admin: 'Super Admin',
  manager: 'Sales Manager',
  agent: 'CRM Agent',
}

function EmployeeCard({ emp, size = 'normal', onClick, liveCount }: { emp: Employee; size?: 'large' | 'normal' | 'small'; onClick?: () => void; liveCount?: number }) {
  const colors = roleColors[emp.role]
  const enrichedEmp = liveCount !== undefined ? { ...emp, leadsAssigned: liveCount } : emp
  const wStatus = emp.role === 'agent' ? getWorkloadStatus(enrichedEmp) : null
  const wColor = wStatus ? getWorkloadColor(wStatus) : null
  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-xl border shadow-sm p-4 text-center transition-all hover:shadow-md hover:-translate-y-0.5 relative"
      style={{ borderColor: wColor ? wColor + '60' : colors.border }}
    >
      {wColor && (
        <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: wColor }} title={`Workload: ${wStatus}`} />
      )}
      <div
        className="mx-auto rounded-full flex items-center justify-center font-semibold font-serif mb-3"
        style={{
          width: size === 'large' ? 56 : size === 'small' ? 36 : 44,
          height: size === 'large' ? 56 : size === 'small' ? 36 : 44,
          fontSize: size === 'large' ? 20 : size === 'small' ? 14 : 16,
          backgroundColor: colors.bg,
          color: colors.text,
        }}
      >
        {emp.name.split(' ').map((n) => n[0]).join('')}
      </div>
      <p className={`font-semibold text-foreground ${size === 'small' ? 'text-xs' : 'text-sm'}`}>{emp.name}</p>
      <p className={`text-muted-foreground mt-0.5 ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}>{roleLabels[emp.role]}</p>
      {size !== 'small' && (
        <div className="mt-2 pt-2 border-t border-border space-y-0.5">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Mail size={10} />{emp.email.split('@')[0]}</p>
          <p className="text-[10px] font-medium text-accent">{emp.department || emp.team}</p>
          {liveCount !== undefined && emp.role === 'agent' && (
            <p className="text-xs font-medium" style={{ color: wColor || '#7A7065' }}>{liveCount}/{emp.capacityLimit} leads</p>
          )}
        </div>
      )}
    </button>
  )
}

interface OrgChartProps {
  groupList?: Group[]
  onCreateGroup?: (g: Group) => void
  onNavigate?: (screen: string, params?: Record<string, string>) => void
}

export default function OrgChart({ groupList = [], onCreateGroup, onNavigate }: OrgChartProps) {
  const { employees, leads } = useData()
  const [tab, setTab] = useState<'chart' | 'directory'>('chart')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = employees.find((e) => e.id === selectedId) || null
  const selectedManager = selected?.managerId ? employees.find((e) => e.id === selected.managerId) : null
  const selectedDirectReports = selected ? employees.filter((e) => e.managerId === selected.id) : []

  // Live lead counts per employee
  const liveLeads = leads.filter((l) => l.status !== 'Cancelled')
  const leadCountByEmp = Object.fromEntries(
    employees.map((e) => [e.id, liveLeads.filter((l) => l.assignedTo === e.id).length])
  )
  // Enrich employee with live lead count for workload calc
  const enriched = (emp: Employee) => ({ ...emp, leadsAssigned: leadCountByEmp[emp.id] ?? emp.leadsAssigned })

  const messageTeam = () => {
    if (!selected || selectedDirectReports.length === 0) return
    const adminId = currentUserByRole.admin
    const memberIds = Array.from(new Set([adminId, selected.id, ...selectedDirectReports.map((r) => r.id)]))
    const existing = groupList.find(
      (g) => g.memberIds.length === memberIds.length && memberIds.every((id) => g.memberIds.includes(id))
    )
    if (existing) {
      onNavigate?.('messages', { groupId: existing.id })
      return
    }
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name: `${selected.name.split(' ')[0]}'s Team`,
      memberIds,
      createdBy: adminId,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    onCreateGroup?.(newGroup)
    onNavigate?.('messages', { groupId: newGroup.id })
  }

  const admin = employees.find((e) => e.role === 'admin')!
  const managers = employees.filter((e) => e.role === 'manager')
  const bangaloreManagers = managers.filter((m) => m.office === 'Bangalore')
  const dubaiManagers = managers.filter((m) => m.office === 'Dubai')
  const agentsByManager: Record<string, Employee[]> = {}
  managers.forEach((m) => {
    agentsByManager[m.id] = employees.filter((e) => e.role === 'agent' && e.managerId === m.id)
  })

  const filtered = employees.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) || e.email.includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="border-b border-border px-5 flex gap-6">
          {(['chart', 'directory'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="py-4 text-sm font-medium capitalize transition-colors border-b-2 -mb-px"
              style={{ borderColor: tab === t ? '#C9A96E' : 'transparent', color: tab === t ? '#1C2B4A' : '#7A7065' }}>
              {t === 'chart' ? 'Org Chart' : 'People Directory'}
            </button>
          ))}
        </div>

        {tab === 'chart' && (
          <div className="p-4 sm:p-8 overflow-x-auto">
            {/* Chaitra — Super Admin / Director */}
            <div className="flex justify-center mb-6">
              <div className="w-56"><EmployeeCard emp={admin} size="large" onClick={() => setSelectedId(admin.id)} liveCount={leadCountByEmp[admin.id]} /></div>
            </div>
            <div className="flex justify-center mb-4"><div className="w-px h-8 bg-border" /></div>

            {/* India team */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700">🇮🇳 India</span>
              </div>
              <div className="flex gap-6 justify-center flex-wrap">
                {bangaloreManagers.map((mgr) => (
                  <div key={mgr.id} className="flex flex-col items-center gap-3">
                    <div className="w-px h-6 bg-border" />
                    <div className="w-48"><EmployeeCard emp={mgr} onClick={() => setSelectedId(mgr.id)} liveCount={leadCountByEmp[mgr.id]} /></div>
                    {agentsByManager[mgr.id]?.length > 0 && (
                      <>
                        <div className="w-px h-6 bg-border" />
                        <div className="flex gap-3">
                          {agentsByManager[mgr.id].map((agent) => (
                            <div key={agent.id} className="w-36"><EmployeeCard emp={agent} size="small" onClick={() => setSelectedId(agent.id)} liveCount={leadCountByEmp[agent.id]} /></div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Dubai team */}
            {dubaiManagers.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4 justify-center">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">🇦🇪 Dubai</span>
                </div>
                <div className="flex gap-6 justify-center flex-wrap">
                  {dubaiManagers.map((mgr) => (
                    <div key={mgr.id} className="flex flex-col items-center gap-3">
                      <div className="w-px h-6 bg-border" />
                      <div className="w-48"><EmployeeCard emp={mgr} onClick={() => setSelectedId(mgr.id)} liveCount={leadCountByEmp[mgr.id]} /></div>
                      {agentsByManager[mgr.id]?.length > 0 && (
                        <>
                          <div className="w-px h-6 bg-border" />
                          <div className="flex gap-3">
                            {agentsByManager[mgr.id].map((agent) => (
                              <div key={agent.id} className="w-36"><EmployeeCard emp={agent} size="small" onClick={() => setSelectedId(agent.id)} liveCount={leadCountByEmp[agent.id]} /></div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'directory' && (
          <div>
            <div className="p-5 border-b border-border">
              <div className="relative max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees…" className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Employee', 'Role', 'Team', 'Contact', 'Join Date', 'Status'].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => {
                  const colors = roleColors[emp.role]
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedId(emp.id)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                            {emp.name.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.bg, color: emp.role === 'admin' ? '#FAF8F5' : colors.text }}>
                          {roleLabels[emp.role]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{emp.team}</td>
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={11} />{emp.email.split('@')[0]}@…</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={11} />{emp.phone}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{emp.joinDate}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {emp.status === 'active' ? 'Active' : 'On Leave'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelectedId(null)} title="Employee Details">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-semibold font-serif shrink-0"
                style={{ backgroundColor: roleColors[selected.role].bg, color: roleColors[selected.role].text }}
              >
                {selected.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <h3 className="font-serif text-xl font-semibold text-foreground">{selected.name}</h3>
                <p className="text-xs font-semibold mt-0.5" style={{ color: '#C9A96E' }}>{
                  selected.department || (selected.role === 'admin' ? 'Director' : roleLabels[selected.role])
                }</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: roleColors[selected.role].bg, color: selected.role === 'admin' ? '#FAF8F5' : roleColors[selected.role].text }}
                  >
                    {roleLabels[selected.role]}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${selected.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {selected.status === 'active' ? 'Active' : selected.status === 'on-leave' ? 'On Leave' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl" style={{ backgroundColor: '#F5F2EC' }}>
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Mail size={13} /><span className="text-xs">Email</span></div>
                <p className="text-sm font-medium text-foreground break-all">{selected.email}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Phone size={13} /><span className="text-xs">Phone</span></div>
                <p className="text-sm font-medium text-foreground">{selected.phone}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Briefcase size={13} /><span className="text-xs">Department / Team</span></div>
                <p className="text-sm font-medium text-foreground">{selected.department} · {selected.team}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Calendar size={13} /><span className="text-xs">Joined</span></div>
                <p className="text-sm font-medium text-foreground">{selected.joinDate}</p>
              </div>
            </div>

            {selected.role === 'agent' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border text-center">
                  <Target size={16} className="mx-auto mb-1.5 text-primary" />
                  <p className="font-serif text-xl font-semibold text-foreground">{leadCountByEmp[selected.id] ?? selected.leadsAssigned}<span className="text-sm text-muted-foreground font-normal">/{selected.capacityLimit}</span></p>
                  <p className="text-xs text-muted-foreground">Leads Assigned</p>
                  {selected.role === 'agent' && (
                    <div className="mt-1">
                      <WorkloadBadge status={getWorkloadStatus(enriched(selected))} pct={getCapacityPct(enriched(selected))} showBar />
                    </div>
                  )}
                </div>
                <div className="p-4 rounded-xl border border-border text-center">
                  <TrendingUp size={16} className="mx-auto mb-1.5 text-emerald-600" />
                  <p className="font-serif text-xl font-semibold text-foreground">{selected.conversions}</p>
                  <p className="text-xs text-muted-foreground">Conversions</p>
                </div>
                <div className="p-4 rounded-xl border border-border text-center col-span-2">
                  <p className="text-xs text-muted-foreground">Avg. Response Time</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{selected.responseTime}</p>
                </div>
              </div>
            )}

            {selectedManager && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
                <Users size={15} className="text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">Reports to <span className="font-semibold text-foreground">{selectedManager.name}</span></p>
              </div>
            )}

            {selectedDirectReports.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Direct Reports ({selectedDirectReports.length})</p>
                  <button
                    onClick={messageTeam}
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                    style={{ backgroundColor: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}
                  >
                    <Users size={12} /> Message this team
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedDirectReports.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors"
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                        style={{ backgroundColor: roleColors[r.role].bg, color: roleColors[r.role].text }}
                      >
                        {r.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                      <span className="text-xs font-medium text-foreground">{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
