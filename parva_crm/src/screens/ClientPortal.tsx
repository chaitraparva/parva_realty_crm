import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, Download, FileCheck2, MapPin, Phone, Mail } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { supabase } from '../lib/supabase'
import type { Project, Unit } from '../types'
import LogoMark from '../components/ui/LogoMark'

function formatPrice(p: number) {
  return p >= 10000000 ? `₹${(p / 10000000).toFixed(2)} Cr` : `₹${(p / 100000).toFixed(1)} L`
}

const documents = [
  { name: 'Booking Application Form', status: 'Signed' },
  { name: 'Cost Sheet & Payment Plan', status: 'Shared' },
  { name: 'Allotment Letter', status: 'Pending' },
  { name: 'Sale Agreement', status: 'Pending' },
]

interface ClientPortalProps {
  leadId: string
  onBack: () => void
  unitPhotos?: Record<string, string[]>
}

export default function ClientPortal({ leadId, onBack, unitPhotos = {} }: ClientPortalProps) {
  const { leads } = useData()
  const [projects, setProjects] = useState<Project[]>([])
  const [units, setUnits] = useState<Unit[]>([])

  useEffect(() => {
    let active = true
    async function loadInventory() {
      try {
        const [pRes, uRes] = await Promise.all([
          supabase.from('inventory_projects').select('*'),
          supabase.from('inventory_units').select('*')
        ])
        if (!active) return
        if (pRes.data) {
          setProjects(pRes.data.map((p) => ({
            id: p.id,
            name: p.name,
            developer: p.developer,
            location: p.location,
            reraNumber: p.rera_number || '',
            reraStatus: p.rera_status || 'Registered',
            possessionDate: p.possession_date || '',
            totalUnits: p.total_units || 0,
          })))
        }
        if (uRes.data) {
          setUnits(uRes.data.map((u) => ({
            id: u.id,
            projectId: u.project_id,
            unitNumber: u.unit_number,
            bhk: u.bhk || '',
            floor: u.floor || '',
            areaSqft: u.area_sqft || 0,
            price: u.price || 0,
            facing: u.facing || '',
            status: u.status || 'Available',
            photos: []
          })))
        }
      } catch (err) {
        console.error('Failed to load inventory for ClientPortal', err)
      }
    }
    loadInventory()
    return () => { active = false }
  }, [])

  const lead = leads.find((l) => l.id === leadId) || leads[0]
  if (!lead) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background px-4">
        <p className="text-sm font-medium">No lead to preview yet.</p>
        <button onClick={onBack} className="text-sm underline">Go back</button>
      </div>
    )
  }
  const shortlisted = (lead.shortlistedUnitIds || [])
    .map((id) => units.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u)

  const paymentPlan = [
    { milestone: 'On Booking', pct: 10 },
    { milestone: 'On Agreement (30 days)', pct: 15 },
    { milestone: 'On Foundation', pct: 15 },
    { milestone: 'On Slab Completion (per floor)', pct: 30 },
    { milestone: 'On Finishing', pct: 20 },
    { milestone: 'On Possession', pct: 10 },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={32} color="#1C2B4A" />
            <div>
              <p className="font-serif text-base font-bold leading-none text-foreground">PARVA REALTIES</p>
              <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-0.5">Client Portal</p>
            </div>
          </div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} /> Back to CRM
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8 space-y-8">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Welcome back</p>
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-3">{lead.name}</h1>
          <div className="flex items-center gap-5 flex-wrap text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Phone size={13} />{lead.phone}</span>
            <span className="flex items-center gap-1.5"><Mail size={13} />{lead.email}</span>
            <span className="flex items-center gap-1.5"><MapPin size={13} />Looking in {lead.location}</span>
          </div>
        </div>

        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-3">Your Shortlisted Properties</h2>
          {shortlisted.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {shortlisted.map((u) => {
                const project = projects.find((p) => p.id === u.projectId)
                const photos = [...(u.photos || []), ...(unitPhotos[u.id] || [])]
                return (
                  <div key={u.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    {photos.length > 0 ? (
                      <div className="flex gap-1 p-1.5 overflow-x-auto">
                        {photos.map((src, i) => (
                          <img key={i} src={src} alt={`${u.unitNumber} ${i + 1}`} className="w-24 h-20 rounded-lg object-cover shrink-0" />
                        ))}
                      </div>
                    ) : (
                      <div className="h-20 flex items-center justify-center bg-muted">
                        <Building2 size={20} className="text-muted-foreground opacity-40" />
                      </div>
                    )}
                    <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(28,43,74,0.08)' }}>
                        <Building2 size={16} color="#1C2B4A" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{project?.name || 'Property'}</p>
                        <p className="text-xs text-muted-foreground">{project?.location || ''}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <p>Unit: <span className="text-foreground font-medium">{u.unitNumber}</span></p>
                      <p>{u.bhk}</p>
                      <p>{u.areaSqft.toLocaleString('en-IN')} sqft</p>
                      <p>{u.facing} facing</p>
                    </div>
                    <p className="text-base font-bold text-foreground mt-3">{formatPrice(u.price)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-card rounded-xl border border-border p-5">Your agent hasn't shortlisted any properties yet.</p>
          )}
        </div>

        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-3">Documents</h2>
          <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
            {documents.map((d) => (
              <div key={d.name} className="flex items-center gap-3 p-4">
                <FileCheck2 size={16} className={d.status === 'Signed' ? 'text-emerald-600' : 'text-muted-foreground'} />
                <p className="flex-1 text-sm font-medium text-foreground">{d.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.status === 'Signed' ? 'bg-emerald-50 text-emerald-700' : d.status === 'Shared' ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-600'}`}>
                  {d.status}
                </span>
                {d.status !== 'Pending' && (
                  <button
                    onClick={() => {
                      const blob = new Blob(
                        [`${d.name}\n\nParva Realties — ${lead.name}\nStatus: ${d.status}\n\nThis is a placeholder document for demo purposes.`],
                        { type: 'text/plain' }
                      )
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${d.name.replace(/\s+/g, '_')}.txt`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Download size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-3">Indicative Payment Schedule</h2>
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {paymentPlan.map((p, i) => (
              <div key={p.milestone} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0">
                <span className="text-xs font-semibold text-muted-foreground w-5">{i + 1}</span>
                <span className="flex-1 text-sm text-foreground">{p.milestone}</span>
                <span className="text-sm font-bold text-foreground">{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pt-4">
          This is a preview of what {lead.name.split(' ')[0]} would see — for demo purposes only.
        </p>
      </main>
    </div>
  )
}
