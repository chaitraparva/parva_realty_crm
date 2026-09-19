import { useMemo, useRef, useState } from 'react'
import { Building2, MapPin, ShieldCheck, ShieldAlert, ShieldX, Search, Image as ImageIcon, Upload, X, Eye, Ruler, Compass, IndianRupee, Layers, CalendarClock, Plus, ExternalLink } from 'lucide-react'
import { projects, units } from '../data/mockData'
import Modal from '../components/ui/Modal'
import type { Role } from '../types'

const reraConfig = {
  Registered: { icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700' },
  Pending: { icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700' },
  Expired: { icon: ShieldX, cls: 'bg-red-50 text-red-700' },
}
const statusCls: Record<string, string> = {
  Available: 'bg-emerald-50 text-emerald-700',
  Held: 'bg-amber-50 text-amber-700',
  Sold: 'bg-gray-100 text-gray-600',
}
function formatPrice(p: number) {
  return p >= 10000000 ? `₹${(p / 10000000).toFixed(2)} Cr` : `₹${(p / 100000).toFixed(1)} L`
}

const ZONES = ['JVC', 'Downtown Dubai', 'Dubai Marina', 'Palm Jumeirah', 'Business Bay', 'Al Barsha', 'Jumeirah', 'DIFC', 'JBR', 'Mirdif']
const PROPERTY_TYPES = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Studio', 'Plot']
const TIERS = ['Luxury', 'Mid-Range', 'Affordable', 'Ultra-Luxury']

interface AddPropertyForm {
  name: string; developer: string; location: string; zone: string
  propertyType: string; unitTypes: string; tier: string; tagLabel: string
  priceINR: string; priceAED: string; rentalYield: string; appreciation: string
  minDeposit: string; areaRange: string; completionQ: string; floors: string
  totalUnits: string; availableInventory: string; listingStatus: string
  amenities: string[]; amenityInput: string
  paymentPlan: { label: string; pct: string }[]
  heroImage: string | null; galleryImages: string[]
}

const defaultForm = (): AddPropertyForm => ({
  name: '', developer: '', location: '', zone: 'JVC', propertyType: 'Apartment', unitTypes: '',
  tier: 'Mid-Range', tagLabel: 'NEW', priceINR: '', priceAED: '', rentalYield: '7', appreciation: '8',
  minDeposit: '', areaRange: '', completionQ: '', floors: '0', totalUnits: '0', availableInventory: '0',
  listingStatus: 'Available', amenities: [], amenityInput: '',
  paymentPlan: [], heroImage: null, galleryImages: [],
})

interface InventoryProps {
  role?: Role
  unitPhotos: Record<string, string[]>
  setUnitPhotos: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
}

export default function Inventory({ role = 'agent', unitPhotos, setUnitPhotos }: InventoryProps) {
  const [projectFilter, setProjectFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [viewUnitId, setViewUnitId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const heroInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [showAddProperty, setShowAddProperty] = useState(false)
  const [form, setForm] = useState<AddPropertyForm>(defaultForm())

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const project = projects.find((p) => p.id === u.projectId)
      const matchProject = projectFilter === 'All' || u.projectId === projectFilter
      const matchStatus = statusFilter === 'All' || u.status === statusFilter
      const matchSearch = !search || u.unitNumber.toLowerCase().includes(search.toLowerCase()) || project?.name.toLowerCase().includes(search.toLowerCase())
      return matchProject && matchStatus && matchSearch
    })
  }, [projectFilter, statusFilter, search])

  const viewUnit = units.find((u) => u.id === viewUnitId)
  const viewProject = viewUnit ? projects.find((p) => p.id === viewUnit.projectId) : null
  const photosForUnit = (unitId: string) => [...(units.find((u) => u.id === unitId)?.photos || []), ...(unitPhotos[unitId] || [])]

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !viewUnitId) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setUnitPhotos((prev) => ({ ...prev, [viewUnitId]: [...(prev[viewUnitId] || []), reader.result as string] }))
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }
  const removePhoto = (unitId: string, index: number) => {
    setUnitPhotos((prev) => ({ ...prev, [unitId]: (prev[unitId] || []).filter((_, i) => i !== index) }))
  }

  const addAmenity = () => {
    if (!form.amenityInput.trim()) return
    setForm((f) => ({ ...f, amenities: [...f.amenities, f.amenityInput.trim()], amenityInput: '' }))
  }
  const addMilestone = () => {
    setForm((f) => ({ ...f, paymentPlan: [...f.paymentPlan, { label: '', pct: '' }] }))
  }
  const handleHeroUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, heroImage: reader.result as string }))
    reader.readAsDataURL(file); e.target.value = ''
  }
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    Array.from(e.target.files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setForm((f) => ({ ...f, galleryImages: [...f.galleryImages, reader.result as string] }))
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const saveProperty = () => {
    // In a real system this POSTs to the backend. Here we navigate to parvarealty.ae as specified.
    window.open('https://www.parvarealty.ae', '_blank')
    setShowAddProperty(false)
    setForm(defaultForm())
  }

  const canAddProperty = role === 'admin' || role === 'manager' || role === 'agent'

  return (
    <div className="space-y-6">
      {/* Project cards */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="font-serif text-lg font-semibold text-foreground">Projects</h2>
          {canAddProperty && (
            <button
              onClick={() => setShowAddProperty(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ backgroundColor: '#C9A96E', color: '#1C2B4A' }}
            >
              <Plus size={15} /> Add Property
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {projects.map((p) => {
            const projectUnits = units.filter((u) => u.projectId === p.id)
            const available = projectUnits.filter((u) => u.status === 'Available').length
            const Rera = reraConfig[p.reraStatus]; const RIcon = Rera.icon
            return (
              <button key={p.id} onClick={() => setProjectFilter(projectFilter === p.id ? 'All' : p.id)} className="text-left bg-card rounded-xl border shadow-sm p-4 transition-all" style={{ borderColor: projectFilter === p.id ? '#C9A96E' : undefined, borderWidth: projectFilter === p.id ? 2 : 1 }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(28,43,74,0.08)' }}><Building2 size={16} color="#1C2B4A" /></div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${Rera.cls}`}><RIcon size={10} />{p.reraStatus}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground mb-2">{p.developer}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground mb-2"><MapPin size={11} />{p.location}</p>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                  <span className="text-muted-foreground">{p.possessionDate}</span>
                  <span className="font-semibold text-foreground">{available}/{projectUnits.length} avail.</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Units table */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="p-4 sm:p-5 border-b border-border flex items-center gap-4 flex-wrap">
          <h3 className="font-serif text-base font-semibold text-foreground mr-auto">Units</h3>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search unit or project" className="pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 w-48" />
          </div>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none">
            <option value="All">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none">
            {['All', 'Available', 'Held', 'Sold'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['', 'Unit', 'Project', 'BHK', 'Floor', 'Area', 'Facing', 'Price', 'Status', ''].map((h, i) => (
                  <th key={i} className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((u) => {
                const project = projects.find((p) => p.id === u.projectId)!
                const photos = photosForUnit(u.id)
                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="pl-4 sm:pl-5 py-3">
                      {photos[0] ? <img src={photos[0]} alt={u.unitNumber} className="w-10 h-10 rounded-lg object-cover border border-border" /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted"><ImageIcon size={14} className="text-muted-foreground" /></div>}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-sm font-semibold text-foreground">{u.unitNumber}</td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">{project.name}</td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-foreground">{u.bhk}</td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-muted-foreground">{u.floor}</td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-muted-foreground">{u.areaSqft.toLocaleString('en-IN')}</td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-muted-foreground">{u.facing}</td>
                    <td className="px-4 sm:px-5 py-3 text-sm font-semibold text-foreground whitespace-nowrap">{formatPrice(u.price)}</td>
                    <td className="px-4 sm:px-5 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusCls[u.status]}`}>{u.status}</span></td>
                    <td className="px-4 sm:px-5 py-3">
                      <button onClick={() => setViewUnitId(u.id)} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-accent transition-colors whitespace-nowrap"><Eye size={13} />View</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredUnits.length === 0 && <p className="text-center py-10 text-sm text-muted-foreground">No units match your filters</p>}
        </div>
      </div>

      {/* View Unit Modal */}
      <Modal open={!!viewUnit} onClose={() => setViewUnitId(null)} title={viewUnit ? `${viewProject?.name} · ${viewUnit.unitNumber}` : ''} width="max-w-2xl">
        {viewUnit && viewProject && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Photos</p>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}>
                    <Upload size={12} /> Add Photos
                  </button>
                </div>
              </div>
              {photosForUnit(viewUnit.id).length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photosForUnit(viewUnit.id).map((src, i) => {
                    const isCustom = i >= (viewUnit.photos?.length || 0)
                    return (
                      <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        {isCustom && (
                          <button onClick={() => removePhoto(viewUnit.id, i - (viewUnit.photos?.length || 0))} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={11} /></button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-8 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-accent hover:text-accent transition-colors">
                  <ImageIcon size={22} /><span className="text-xs font-medium">No photos yet — click to add</span>
                </button>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Property Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl" style={{ backgroundColor: '#F5F2EC' }}>
                <div><div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Layers size={12} /><span className="text-[11px]">BHK / Floor</span></div><p className="text-sm font-medium text-foreground">{viewUnit.bhk} · {viewUnit.floor}</p></div>
                <div><div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Ruler size={12} /><span className="text-[11px]">Area</span></div><p className="text-sm font-medium text-foreground">{viewUnit.areaSqft.toLocaleString('en-IN')} sqft</p></div>
                <div><div className="flex items-center gap-1.5 text-muted-foreground mb-1"><Compass size={12} /><span className="text-[11px]">Facing</span></div><p className="text-sm font-medium text-foreground">{viewUnit.facing}</p></div>
                <div><div className="flex items-center gap-1.5 text-muted-foreground mb-1"><IndianRupee size={12} /><span className="text-[11px]">Price</span></div><p className="text-sm font-medium text-foreground">{formatPrice(viewUnit.price)}</p></div>
                <div><div className="flex items-center gap-1.5 text-muted-foreground mb-1"><MapPin size={12} /><span className="text-[11px]">Location</span></div><p className="text-sm font-medium text-foreground">{viewProject.location}</p></div>
                <div><div className="flex items-center gap-1.5 text-muted-foreground mb-1"><CalendarClock size={12} /><span className="text-[11px]">Possession</span></div><p className="text-sm font-medium text-foreground">{viewProject.possessionDate}</p></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Project</p>
              <div className="p-4 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{viewProject.name}</p>
                    <p className="text-xs text-muted-foreground">{viewProject.developer}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${reraConfig[viewProject.reraStatus].cls}`}>{viewProject.reraStatus}</span>
                </div>
                {viewProject.priceAED && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
                    <div><p className="text-[10px] text-muted-foreground uppercase font-semibold">Price (AED)</p><p className="text-sm font-semibold text-foreground">{viewProject.priceAED}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase font-semibold">Price (INR)</p><p className="text-sm font-semibold text-foreground">{viewProject.priceINR}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase font-semibold">Rental Yield</p><p className="text-sm font-semibold text-foreground">{viewProject.rentalYield}%</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase font-semibold">Appreciation</p><p className="text-sm font-semibold text-foreground">{viewProject.appreciation}%</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase font-semibold">Min Deposit</p><p className="text-sm font-semibold text-foreground">{viewProject.minDeposit}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase font-semibold">Area Range</p><p className="text-sm font-semibold text-foreground">{viewProject.areaRange}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase font-semibold">Floors</p><p className="text-sm font-semibold text-foreground">{viewProject.floors}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Units</p><p className="text-sm font-semibold text-foreground">{viewProject.totalUnits}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase font-semibold">Handover</p><p className="text-sm font-semibold text-foreground">{viewProject.handoverQ}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase font-semibold">Unit Types</p><p className="text-sm font-semibold text-foreground">{viewProject.unitTypes}</p></div>
                  </div>
                )}
                {viewProject.standout && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Why Invest</p>
                    <p className="text-xs text-foreground leading-relaxed">{viewProject.standout}</p>
                  </div>
                )}
                {viewProject.amenities && viewProject.amenities.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Amenities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewProject.amenities.map((a) => (
                        <span key={a} className="px-2 py-1 rounded-full text-[10px] font-medium bg-muted text-foreground">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {viewProject.paymentPlan && viewProject.paymentPlan.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Payment Plan</p>
                    <div className="flex gap-3 flex-wrap">
                      {viewProject.paymentPlan.map((m, i) => (
                        <div key={i} className="flex flex-col items-center px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(201,169,110,0.1)' }}>
                          <p className="text-lg font-bold" style={{ color: '#C9A96E' }}>{m.pct}%</p>
                          <p className="text-[10px] text-muted-foreground text-center">{m.label || (i === 0 ? 'On Booking' : i === viewProject.paymentPlan!.length - 1 ? 'On Handover' : 'During Construction')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium ${statusCls[viewUnit.status]}`}>{viewUnit.status}</span>
          </div>
        )}
      </Modal>

      {/* Add Property Modal */}
      <Modal open={showAddProperty} onClose={() => { setShowAddProperty(false); setForm(defaultForm()) }} title="Add New Property" width="max-w-2xl">
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
          {/* Basic Information */}
          <div>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4 pb-2 border-b border-border">Basic Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Property Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Auresta Tower" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Developer *</label>
                <input value={form.developer} onChange={(e) => setForm({ ...form, developer: e.target.value })} placeholder="e.g. Tiger Properties" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Location</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Jumeirah Village Circle" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Zone</label>
                <select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                  {ZONES.map((z) => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Property Type</label>
                <input value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value })} list="ptypes" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
                <datalist id="ptypes">{PROPERTY_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Unit Types</label>
                <input value={form.unitTypes} onChange={(e) => setForm({ ...form, unitTypes: e.target.value })} placeholder="e.g. Studio / 1BR / 2BR" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Tier</label>
                <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                  {TIERS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Tag Label</label>
                <input value={form.tagLabel} onChange={(e) => setForm({ ...form, tagLabel: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Pricing & Returns */}
          <div>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4 pb-2 border-b border-border">Pricing & Returns</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Price (INR)</label>
                <input value={form.priceINR} onChange={(e) => setForm({ ...form, priceINR: e.target.value })} placeholder="e.g. ₹2.22 Cr" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Price (AED)</label>
                <input value={form.priceAED} onChange={(e) => setForm({ ...form, priceAED: e.target.value })} placeholder="e.g. ~AED 850K" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Rental Yield (%)</label>
                <input type="number" value={form.rentalYield} onChange={(e) => setForm({ ...form, rentalYield: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Appreciation (%)</label>
                <input type="number" value={form.appreciation} onChange={(e) => setForm({ ...form, appreciation: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Min Deposit</label>
                <input value={form.minDeposit} onChange={(e) => setForm({ ...form, minDeposit: e.target.value })} placeholder="e.g. ₹10L (AED 40K)" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Area Range</label>
                <input value={form.areaRange} onChange={(e) => setForm({ ...form, areaRange: e.target.value })} placeholder="e.g. 480 – 750 sq ft" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4 pb-2 border-b border-border">Project Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Completion Quarter</label>
                <input value={form.completionQ} onChange={(e) => setForm({ ...form, completionQ: e.target.value })} placeholder="e.g. Q2 2027" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Floors</label>
                <input type="number" value={form.floors} onChange={(e) => setForm({ ...form, floors: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Total Units</label>
                <input type="number" value={form.totalUnits} onChange={(e) => setForm({ ...form, totalUnits: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Available Inventory</label>
                <input type="number" value={form.availableInventory} onChange={(e) => setForm({ ...form, availableInventory: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Listing Status</label>
                <select value={form.listingStatus} onChange={(e) => setForm({ ...form, listingStatus: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none">
                  {['Available', 'Sold Out', 'Coming Soon', 'Off Plan'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4 pb-2 border-b border-border">Amenities</p>
            <div className="flex gap-2 mb-3">
              <input
                value={form.amenityInput}
                onChange={(e) => setForm({ ...form, amenityInput: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addAmenity()}
                placeholder="Add amenity and press Enter"
                className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <button onClick={addAmenity} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}>Add</button>
            </div>
            {form.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.amenities.map((a, i) => (
                  <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
                    {a}<button onClick={() => setForm((f) => ({ ...f, amenities: f.amenities.filter((_, j) => j !== i) }))}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Payment Plan */}
          <div>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4 pb-2 border-b border-border">Payment Plan</p>
            {form.paymentPlan.map((m, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={m.label} onChange={(e) => setForm((f) => ({ ...f, paymentPlan: f.paymentPlan.map((p, j) => j === i ? { ...p, label: e.target.value } : p) }))} placeholder="Milestone (e.g. On Booking)" className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none" />
                <input type="number" value={m.pct} onChange={(e) => setForm((f) => ({ ...f, paymentPlan: f.paymentPlan.map((p, j) => j === i ? { ...p, pct: e.target.value } : p) }))} placeholder="%" className="w-16 px-2 py-2 rounded-lg border border-border bg-background text-sm text-center focus:outline-none" />
                <button onClick={() => setForm((f) => ({ ...f, paymentPlan: f.paymentPlan.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-red-500"><X size={16} /></button>
              </div>
            ))}
            <button onClick={addMilestone} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors mt-1">
              <Plus size={14} /> Add Milestone
            </button>
          </div>

          {/* Images */}
          <div>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4 pb-2 border-b border-border">Images</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Hero / Cover Image *</label>
                <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
                {form.heroImage ? (
                  <div className="relative rounded-lg overflow-hidden">
                    <img src={form.heroImage} alt="Hero" className="w-full h-40 object-cover rounded-lg" />
                    <button onClick={() => setForm((f) => ({ ...f, heroImage: null }))} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white"><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => heroInputRef.current?.click()} className="w-full py-3 rounded-lg border border-border text-sm font-medium text-center text-foreground hover:bg-muted transition-colors">Upload Image</button>
                    <input value={form.heroImage || ''} onChange={(e) => setForm({ ...form, heroImage: e.target.value })} placeholder="Or paste image URL" className="w-full mt-2 px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none" />
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Gallery Images ({form.galleryImages.length})</label>
                <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                {form.galleryImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {form.galleryImages.map((src, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                        <img src={src} alt={`Gallery ${i}`} className="w-full h-full object-cover" />
                        <button onClick={() => setForm((f) => ({ ...f, galleryImages: f.galleryImages.filter((_, j) => j !== i) }))} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center text-white"><X size={9} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => galleryInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors">
                  <Plus size={14} /> Add Gallery Images
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-card pb-1">
            <button onClick={() => { setShowAddProperty(false); setForm(defaultForm()) }} className="flex-1 py-3 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button
              onClick={saveProperty}
              disabled={!form.name.trim() || !form.developer.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
              style={{ backgroundColor: '#C9A96E', color: '#1C2B4A', opacity: (!form.name.trim() || !form.developer.trim()) ? 0.5 : 1 }}
            >
              <ExternalLink size={14} /> Save Property
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
