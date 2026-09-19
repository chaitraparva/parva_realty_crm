import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, MapPin, ShieldCheck, ShieldAlert, ShieldX, Search, Image as ImageIcon, Upload, X, Eye, Ruler, Compass, IndianRupee, Layers, CalendarClock, Plus, ExternalLink, Trash2 } from 'lucide-react'
import { projects as mockProjects, units as mockUnits } from '../data/mockData'
import { supabase } from '../lib/supabase'
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
  heroFile: File | null; galleryFiles: File[]
}

interface DbProject {
  id: string
  legacy_id: string | null
  name: string
  developer: string
  location: string | null
  zone: string | null
  property_type: string | null
  unit_types: string | null
  tier: string | null
  tag_label: string | null
  rera_status: string
  possession_date: string | null
  price_inr: string | null
  price_aed: string | null
  rental_yield: number | null
  appreciation: number | null
  min_deposit: string | null
  area_range: string | null
  completion_q: string | null
  handover_q: string | null
  floors: number | null
  total_units: number | null
  available_inventory: number | null
  listing_status: string | null
  standout: string | null
  amenities: string[] | null
  payment_plan: { label: string; pct: string }[] | null
  hero_image_url: string | null
  gallery_image_urls: string[] | null
  created_by: string | null
  created_at: string
}

interface DbUnit {
  id: string
  legacy_id: string | null
  project_id: string
  unit_number: string
  bhk: string
  floor: string
  area_sqft: number
  facing: string
  price: number
  status: 'Available' | 'Held' | 'Sold'
  created_at: string
}

interface DbUnitPhoto {
  id: string
  unit_id: string
  storage_path: string | null
  public_url: string
  created_at: string
}

type UiProject = {
  id: string
  legacyId?: string | null
  name: string
  developer: string
  location: string
  zone?: string
  propertyType?: string
  unitTypes: string
  tier?: string
  tagLabel?: string
  reraStatus: 'Registered' | 'Pending' | 'Expired' | string
  possessionDate: string
  priceINR: string
  priceAED: string
  rentalYield: number
  appreciation: number
  minDeposit: string
  areaRange: string
  completionQ?: string
  handoverQ: string
  floors: number
  totalUnits: number
  availableInventory: number
  listingStatus?: string
  standout: string
  amenities: string[]
  paymentPlan: { label: string; pct: string }[]
  heroImage?: string | null
  galleryImages?: string[]
}

type UiUnit = {
  id: string
  legacyId?: string | null
  projectId: string
  unitNumber: string
  bhk: string
  floor: string
  areaSqft: number
  facing: string
  price: number
  status: 'Available' | 'Held' | 'Sold'
  photos: string[]
}

interface PhotoItem {
  src: string
  photoId?: string
  storagePath?: string | null
  source: 'base' | 'stored' | 'local'
}

const defaultForm = (): AddPropertyForm => ({
  name: '', developer: '', location: '', zone: 'JVC', propertyType: 'Apartment', unitTypes: '',
  tier: 'Mid-Range', tagLabel: 'NEW', priceINR: '', priceAED: '', rentalYield: '7', appreciation: '8',
  minDeposit: '', areaRange: '', completionQ: '', floors: '0', totalUnits: '0', availableInventory: '0',
  listingStatus: 'Available', amenities: [], amenityInput: '',
  paymentPlan: [], heroImage: null, galleryImages: [], heroFile: null, galleryFiles: [],
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
  const [dbProjects, setDbProjects] = useState<UiProject[]>([])
  const [dbUnits, setDbUnits] = useState<UiUnit[]>([])
  const [unitPhotoRows, setUnitPhotoRows] = useState<Record<string, DbUnitPhoto[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [error, setError] = useState('')


  const getCurrentEmployeeId = async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw new Error('Not authenticated')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('employee_id')
      .eq('id', authData.user.id)
      .single()
    if (profileError || !profile?.employee_id) throw new Error('No employee record found for this account')
    return profile.employee_id as string
  }

  const mapProject = (p: DbProject): UiProject => ({
    id: p.id,
    legacyId: p.legacy_id,
    name: p.name,
    developer: p.developer,
    location: p.location || '—',
    zone: p.zone || 'JVC',
    propertyType: p.property_type || 'Apartment',
    unitTypes: p.unit_types || '—',
    tier: p.tier || 'Mid-Range',
    tagLabel: p.tag_label || 'NEW',
    reraStatus: p.rera_status || 'Registered',
    possessionDate: p.possession_date || p.completion_q || p.handover_q || '—',
    priceINR: p.price_inr || '—',
    priceAED: p.price_aed || '—',
    rentalYield: Number(p.rental_yield ?? 0),
    appreciation: Number(p.appreciation ?? 0),
    minDeposit: p.min_deposit || '—',
    areaRange: p.area_range || '—',
    completionQ: p.completion_q || '',
    handoverQ: p.handover_q || '—',
    floors: Number(p.floors ?? 0),
    totalUnits: Number(p.total_units ?? 0),
    availableInventory: Number(p.available_inventory ?? 0),
    listingStatus: p.listing_status || 'Available',
    standout: p.standout || '',
    amenities: Array.isArray(p.amenities) ? p.amenities : [],
    paymentPlan: Array.isArray(p.payment_plan) ? p.payment_plan : [],
    heroImage: p.hero_image_url || null,
    galleryImages: Array.isArray(p.gallery_image_urls) ? p.gallery_image_urls : [],
  })

  const mapUnit = (u: DbUnit, project: UiProject | undefined, storedPhotos: DbUnitPhoto[]): UiUnit => ({
    id: u.id,
    legacyId: u.legacy_id,
    projectId: u.project_id,
    unitNumber: u.unit_number,
    bhk: u.bhk,
    floor: u.floor,
    areaSqft: Number(u.area_sqft ?? 0),
    facing: u.facing,
    price: Number(u.price ?? 0),
    status: u.status,
    photos: [
      ...(((mockUnits.find((mu: any) => mu.id === u.legacy_id) as any)?.photos || []) as string[]),
      ...storedPhotos.map((p) => p.public_url),
      ...(project?.galleryImages?.filter(Boolean) || []).slice(0, 0),
    ],
  })

  const loadInventory = async () => {
    setError('')
    setLoading(true)
    try {
      let { data: projectRows, error: projectError } = await supabase
        .from('inventory_projects')
        .select('*')
        .order('created_at', { ascending: true })
      if (projectError) throw projectError

      // First run: migrate the existing mock projects/units into Supabase once.
      if (!projectRows?.length && mockProjects.length) {
        const employeeId = await getCurrentEmployeeId()

        const projectPayload = (mockProjects as any[]).map((p) => ({
          legacy_id: String(p.id),
          name: p.name,
          developer: p.developer || '—',
          location: p.location || null,
          zone: p.zone || 'JVC',
          property_type: p.propertyType || 'Apartment',
          unit_types: p.unitTypes || null,
          tier: p.tier || 'Mid-Range',
          tag_label: p.tagLabel || 'NEW',
          rera_status: p.reraStatus || 'Registered',
          possession_date: p.possessionDate || p.handoverQ || null,
          price_inr: p.priceINR || null,
          price_aed: p.priceAED || null,
          rental_yield: Number(p.rentalYield || 0),
          appreciation: Number(p.appreciation || 0),
          min_deposit: p.minDeposit || null,
          area_range: p.areaRange || null,
          completion_q: p.completionQ || p.handoverQ || null,
          handover_q: p.handoverQ || p.completionQ || null,
          floors: Number(p.floors || 0),
          total_units: Number(p.totalUnits || 0),
          available_inventory: Number(p.availableInventory ?? p.totalUnits ?? 0),
          listing_status: p.listingStatus || 'Available',
          standout: p.standout || null,
          amenities: Array.isArray(p.amenities) ? p.amenities : [],
          payment_plan: Array.isArray(p.paymentPlan) ? p.paymentPlan : [],
          hero_image_url: typeof p.heroImage === 'string' ? p.heroImage : null,
          gallery_image_urls: Array.isArray(p.galleryImages) ? p.galleryImages : [],
          created_by: employeeId,
        }))
        const { error: seedProjectError } = await supabase
          .from('inventory_projects')
          .upsert(projectPayload, { onConflict: 'legacy_id' })
        if (seedProjectError) throw seedProjectError

        const { data: seededProjects, error: seededProjectsError } = await supabase
          .from('inventory_projects').select('*').order('created_at', { ascending: true })
        if (seededProjectsError) throw seededProjectsError
        projectRows = seededProjects || []

        const projectIdByLegacy = new Map<string, string>((projectRows as DbProject[]).map((p) => [String(p.legacy_id), p.id]))
        const unitPayload = (mockUnits as any[])
          .map((u) => {
            const projectId = projectIdByLegacy.get(String(u.projectId))
            if (!projectId) return null
            return {
              legacy_id: String(u.id),
              project_id: projectId,
              unit_number: String(u.unitNumber || u.id),
              bhk: String(u.bhk || '—'),
              floor: String(u.floor ?? '—'),
              area_sqft: Number(u.areaSqft || 0),
              facing: String(u.facing || '—'),
              price: Number(u.price || 0),
              status: ['Available', 'Held', 'Sold'].includes(u.status) ? u.status : 'Available',
            }
          })
          .filter(Boolean)
        if (unitPayload.length) {
          const { error: seedUnitError } = await supabase
            .from('inventory_units')
            .upsert(unitPayload, { onConflict: 'legacy_id' })
          if (seedUnitError) throw seedUnitError
        }

        const { data: seededUnits } = await supabase
          .from('inventory_units').select('*')
        const unitIdByLegacy = new Map<string, string>((seededUnits || []).map((u: DbUnit) => [String(u.legacy_id), u.id]))
        const photoPayload = (mockUnits as any[])
          .flatMap((u) => {
            const unitId = unitIdByLegacy.get(String(u.id))
            const photos = Array.isArray(u.photos) ? u.photos : []
            return unitId ? photos.map((url: string) => ({ unit_id: unitId, public_url: url, storage_path: null })) : []
          })
        if (photoPayload.length) {
          const { error: seedPhotoError } = await supabase.from('inventory_unit_photos').insert(photoPayload)
          if (seedPhotoError) throw seedPhotoError
        }
      }

      const { data: finalProjects, error: finalProjectError } = await supabase
        .from('inventory_projects').select('*').order('created_at', { ascending: true })
      if (finalProjectError) throw finalProjectError
      const projectUi = (finalProjects || []).map((p: DbProject) => mapProject(p))
      const projectMap = new Map(projectUi.map((p) => [p.id, p]))

      const { data: unitRows, error: unitError } = await supabase
        .from('inventory_units').select('*').order('created_at', { ascending: true })
      if (unitError) throw unitError

      const { data: photoRows, error: photoError } = await supabase
        .from('inventory_unit_photos').select('*').order('created_at', { ascending: true })
      if (photoError) throw photoError

      const groupedPhotos: Record<string, DbUnitPhoto[]> = {}
        ; ((photoRows || []) as DbUnitPhoto[]).forEach((row) => {
          groupedPhotos[row.unit_id] = [...(groupedPhotos[row.unit_id] || []), row]
        })
      setUnitPhotoRows(groupedPhotos)
      setDbProjects(projectUi)
      setDbUnits(((unitRows || []) as DbUnit[]).map((u) => mapUnit(u, projectMap.get(u.project_id), groupedPhotos[u.id] || [])))
    } catch (err: any) {
      setError(err?.message || 'Could not load property inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredUnits = useMemo(() => {
    return dbUnits.filter((u) => {
      const project = dbProjects.find((p) => p.id === u.projectId)
      const matchProject = projectFilter === 'All' || u.projectId === projectFilter
      const matchStatus = statusFilter === 'All' || u.status === statusFilter
      const q = search.trim().toLowerCase()
      const matchSearch = !q || u.unitNumber.toLowerCase().includes(q) || project?.name.toLowerCase().includes(q)
      return matchProject && matchStatus && matchSearch
    })
  }, [dbProjects, dbUnits, projectFilter, statusFilter, search])

  const viewUnit = dbUnits.find((u) => u.id === viewUnitId)
  const viewProject = viewUnit ? dbProjects.find((p) => p.id === viewUnit.projectId) : null

  const photoItemsForUnit = (unitId: string): PhotoItem[] => {
    const unit = dbUnits.find((u) => u.id === unitId)
    const basePhotos = (((mockUnits.find((mu: any) => String(mu.id) === String(unit?.legacyId)) as any)?.photos || []) as string[])
      .map((src) => ({ src, source: 'base' as const }))
    const storedPhotos = (unitPhotoRows[unitId] || []).map((p) => ({
      src: p.public_url,
      photoId: p.id,
      storagePath: p.storage_path,
      source: 'stored' as const,
    }))
    const localPhotos = (unitPhotos[unitId] || []).map((src) => ({ src, source: 'local' as const }))
    return [...basePhotos, ...storedPhotos, ...localPhotos]
  }

  const uploadFile = async (bucket: string, folder: string, file: File) => {
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-')
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const path = `${folder}/${id}-${safeName}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
    })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return { path, url: data.publicUrl }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !viewUnitId) return
    setError('')
    try {
      for (const file of files) {
        const uploaded = await uploadFile('property-images', `inventory/units/${viewUnitId}`, file)
        const { data: inserted, error: insertError } = await supabase
          .from('inventory_unit_photos')
          .insert({ unit_id: viewUnitId, storage_path: uploaded.path, public_url: uploaded.url })
          .select('*')
          .single()
        if (insertError) throw insertError
        setUnitPhotoRows((prev) => ({ ...prev, [viewUnitId]: [...(prev[viewUnitId] || []), inserted as DbUnitPhoto] }))
      }
    } catch (err: any) {
      setError(err?.message || 'Could not upload photo')
    } finally {
      e.target.value = ''
    }
  }

  const removePhoto = async (item: PhotoItem, unitId: string) => {
    try {
      setError('')
      if (item.source === 'stored' && item.photoId) {
        if (item.storagePath) {
          const { error: storageError } = await supabase.storage.from('property-images').remove([item.storagePath])
          if (storageError) throw storageError
        }
        const { error: dbError } = await supabase.from('inventory_unit_photos').delete().eq('id', item.photoId)
        if (dbError) throw dbError
        setUnitPhotoRows((prev) => ({ ...prev, [unitId]: (prev[unitId] || []).filter((p) => p.id !== item.photoId) }))
      } else if (item.source === 'local') {
        setUnitPhotos((prev) => ({ ...prev, [unitId]: (prev[unitId] || []).filter((src) => src !== item.src) }))
      }
    } catch (err: any) {
      setError(err?.message || 'Could not remove photo')
    }
  }

  const addAmenity = () => {
    if (!form.amenityInput.trim()) return
    setForm((f) => ({ ...f, amenities: [...f.amenities, f.amenityInput.trim()], amenityInput: '' }))
  }
  const addMilestone = () => {
    setForm((f) => ({ ...f, paymentPlan: [...f.paymentPlan, { label: '', pct: '' }] }))
  }
  const handleHeroUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, heroImage: reader.result as string, heroFile: file }))
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setForm((f) => ({ ...f, galleryImages: [...f.galleryImages, reader.result as string], galleryFiles: [...f.galleryFiles, file] }))
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const deleteProject = async (project: UiProject) => {
    const confirmed = window.confirm(
      `Delete \"${project.name}\"?\n\nThis will permanently remove the property, its units, and all stored property/unit photos from this CRM.`
    )
    if (!confirmed) return

    setDeletingProjectId(project.id)
    setError('')
    try {
      // Collect storage files first so we can remove them before the DB rows.
      const { data: unitsForProject, error: unitsError } = await supabase
        .from('inventory_units')
        .select('id')
        .eq('project_id', project.id)
      if (unitsError) throw unitsError

      const unitIds = (unitsForProject || []).map((u: { id: string }) => u.id)
      let storedPaths: string[] = []

      if (unitIds.length) {
        const { data: unitPhotos, error: photosError } = await supabase
          .from('inventory_unit_photos')
          .select('storage_path')
          .in('unit_id', unitIds)
        if (photosError) throw photosError
        storedPaths.push(
          ...((unitPhotos || []) as { storage_path: string | null }[])
            .map((p) => p.storage_path)
            .filter((p): p is string => !!p)
        )
      }

      // Project images are stored under these folders. Only remove paths
      // belonging to this property; external URLs are left untouched.
      const projectStorageFolders = [
        `inventory/projects/${project.id}/hero`,
        `inventory/projects/${project.id}/gallery`,
      ]

      const projectStoragePaths: string[] = []
      for (const folder of projectStorageFolders) {
        const { data: files, error: listError } = await supabase.storage
          .from('property-images')
          .list(folder, { limit: 1000 })
        if (listError) throw listError
        for (const file of files || []) {
          if (file.name) projectStoragePaths.push(`${folder}/${file.name}`)
        }
      }

      storedPaths = [...new Set([...storedPaths, ...projectStoragePaths])]

      if (storedPaths.length) {
        const { error: storageError } = await supabase.storage
          .from('property-images')
          .remove(storedPaths)
        if (storageError) throw storageError
      }

      const { error: deleteError } = await supabase
        .from('inventory_projects')
        .delete()
        .eq('id', project.id)
      if (deleteError) throw deleteError

      if (projectFilter === project.id) setProjectFilter('All')
      if (viewUnitId && dbUnits.some((u) => u.projectId === project.id && u.id === viewUnitId)) {
        setViewUnitId(null)
      }

      await loadInventory()
    } catch (err: any) {
      setError(err?.message || 'Could not delete property')
    } finally {
      setDeletingProjectId(null)
    }
  }

  const saveProperty = async () => {
    setSaving(true)
    setError('')
    try {
      const employeeId = await getCurrentEmployeeId()
      const { data: inserted, error: insertError } = await supabase
        .from('inventory_projects')
        .insert({
          name: form.name.trim(),
          developer: form.developer.trim(),
          location: form.location.trim() || null,
          zone: form.zone,
          property_type: form.propertyType || 'Apartment',
          unit_types: form.unitTypes || null,
          tier: form.tier,
          tag_label: form.tagLabel,
          rera_status: 'Registered',
          possession_date: form.completionQ || null,
          price_inr: form.priceINR || null,
          price_aed: form.priceAED || null,
          rental_yield: Number(form.rentalYield || 0),
          appreciation: Number(form.appreciation || 0),
          min_deposit: form.minDeposit || null,
          area_range: form.areaRange || null,
          completion_q: form.completionQ || null,
          handover_q: form.completionQ || null,
          floors: Number(form.floors || 0),
          total_units: Number(form.totalUnits || 0),
          available_inventory: Number(form.availableInventory || 0),
          listing_status: form.listingStatus,
          amenities: form.amenities,
          payment_plan: form.paymentPlan,
          created_by: employeeId,
        })
        .select('*')
        .single()
      if (insertError) throw insertError
      const project = inserted as DbProject

      let heroUrl = form.heroImage && !form.heroFile ? form.heroImage : null
      if (form.heroFile) {
        const uploaded = await uploadFile('property-images', `inventory/projects/${project.id}/hero`, form.heroFile)
        heroUrl = uploaded.url
      }

      const galleryUrls: string[] = []
      for (const file of form.galleryFiles) {
        const uploaded = await uploadFile('property-images', `inventory/projects/${project.id}/gallery`, file)
        galleryUrls.push(uploaded.url)
      }

      if (heroUrl || galleryUrls.length) {
        const { error: updateError } = await supabase
          .from('inventory_projects')
          .update({
            hero_image_url: heroUrl,
            gallery_image_urls: galleryUrls,
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id)
        if (updateError) throw updateError
      }

      setShowAddProperty(false)
      setForm(defaultForm())
      await loadInventory()
    } catch (err: any) {
      setError(err?.message || 'Could not save property')
    } finally {
      setSaving(false)
    }
  }

  const canAddProperty = role === 'admin' || role === 'manager' || role === 'agent'

  return (
    <div className="space-y-6">
      {loading && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Loading property inventory…</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
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
          {dbProjects.map((p) => {
            const projectUnits = dbUnits.filter((u) => u.projectId === p.id)
            const available = projectUnits.filter((u) => u.status === 'Available').length
            const Rera = reraConfig[p.reraStatus] || reraConfig.Registered; const RIcon = Rera.icon
            return (
              <div key={p.id} className="text-left bg-card rounded-xl border shadow-sm p-4 transition-all" style={{ borderColor: projectFilter === p.id ? '#C9A96E' : undefined, borderWidth: projectFilter === p.id ? 2 : 1 }}>
                <button
                  onClick={() => setProjectFilter(projectFilter === p.id ? 'All' : p.id)}
                  className="w-full text-left"
                  disabled={deletingProjectId === p.id}
                >
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
                {canAddProperty && (
                  <div className="mt-3 pt-3 border-t border-border flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); void deleteProject(p) }}
                      disabled={deletingProjectId === p.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                    >
                      <Trash2 size={12} />
                      {deletingProjectId === p.id ? 'Deleting…' : 'Delete Property'}
                    </button>
                  </div>
                )}
              </div>
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
            {dbProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                const project = dbProjects.find((p) => p.id === u.projectId)!
                const photos = photoItemsForUnit(u.id)
                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="pl-4 sm:pl-5 py-3">
                      {photos[0]?.src ? <img src={photos[0].src} alt={u.unitNumber} className="w-10 h-10 rounded-lg object-cover border border-border" /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted"><ImageIcon size={14} className="text-muted-foreground" /></div>}
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
              {photoItemsForUnit(viewUnit.id).length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photoItemsForUnit(viewUnit.id).map((item, i) => {
                    return (
                      <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={item.src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        {item.source !== 'base' && (
                          <button onClick={() => removePhoto(item, viewUnit.id)} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={11} /></button>
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
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${(reraConfig[viewProject.reraStatus] || reraConfig.Registered).cls}`}>{viewProject.reraStatus}</span>
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
              disabled={saving || !form.name.trim() || !form.developer.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
              style={{ backgroundColor: '#C9A96E', color: '#1C2B4A', opacity: (!form.name.trim() || !form.developer.trim()) ? 0.5 : 1 }}
            >
              <ExternalLink size={14} /> {saving ? 'Saving…' : 'Save Property'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
