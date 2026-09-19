import { useRef, useState } from 'react'
import { Camera, Upload, Check, FileText, X as XIcon } from 'lucide-react'
import Modal from '../ui/Modal'
import type { Role } from '../../types'

interface ProfileModalProps {
  open: boolean
  onClose: () => void
  role: Role
  name: string
  email: string
}

const requiredDocs = [
  'Government ID (Aadhaar / PAN)',
  'Address Proof',
  'Educational Certificate',
  'Previous Offer Letter / Resume',
]

export default function ProfileModal({ open, onClose, role, name, email }: ProfileModalProps) {
  const [photo, setPhoto] = useState<string | null>(null)
  const [fullName, setFullName] = useState(name)
  const [emailValue, setEmailValue] = useState(email)
  const [phone, setPhone] = useState('')
  const [about, setAbout] = useState('')
  const [docs, setDocs] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const [activeDoc, setActiveDoc] = useState<string | null>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  const openDocPicker = (doc: string) => {
    setActiveDoc(doc)
    docInputRef.current?.click()
  }

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeDoc) return
    setDocs((prev) => ({ ...prev, [activeDoc]: file.name }))
    setActiveDoc(null)
    e.target.value = ''
  }

  const removeDoc = (doc: string) => {
    setDocs((prev) => {
      const next = { ...prev }
      delete next[doc]
      return next
    })
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 900)
  }

  return (
    <Modal open={open} onClose={onClose} title="My Profile" width="max-w-xl">
      <div className="space-y-6">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-semibold overflow-hidden shrink-0"
              style={{ backgroundColor: 'rgba(28,43,74,0.1)', color: '#1C2B4A' }}
            >
              {photo ? (
                <img src={photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)
              )}
            </div>
            <button
              onClick={() => photoInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-sm border border-border"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
            >
              <Camera size={13} />
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{fullName}</p>
            <p className="text-xs text-muted-foreground">Click the camera icon to upload a profile picture</p>
          </div>
        </div>

        {/* Personal info */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email address</label>
            <input
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 00000 00000"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">About / additional details</label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={3}
              placeholder="Address, emergency contact, or anything else worth noting"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
          </div>
        </div>

        {/* Document uploads */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Documents</p>
          <input ref={docInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleDocChange} />
          <div className="space-y-2">
            {requiredDocs.map((doc) => {
              const uploadedName = docs[doc]
              return (
                <div
                  key={doc}
                  className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                  style={{
                    borderColor: uploadedName ? '#C9A96E' : '#E5DFD5',
                    backgroundColor: uploadedName ? 'rgba(201,169,110,0.05)' : '#fff',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: uploadedName ? 'rgba(201,169,110,0.15)' : '#F5F2EC' }}
                  >
                    {uploadedName ? <Check size={16} color="#C9A96E" /> : <FileText size={16} color="#7A7065" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{doc}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {uploadedName ? uploadedName : 'PDF or image, up to 5MB'}
                    </p>
                  </div>
                  {uploadedName ? (
                    <button onClick={() => removeDoc(doc)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors">
                      <XIcon size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => openDocPicker(doc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors shrink-0"
                    >
                      <Upload size={12} /> Upload
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: saved ? '#10B981' : '#1C2B4A', color: '#FAF8F5' }}
          >
            {saved ? '✓ Saved!' : 'Save Profile'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
