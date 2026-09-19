import { useState } from 'react'
import { Check, Upload, ChevronRight } from 'lucide-react'
import type { Role } from '../types'
import LogoMark from '../components/ui/LogoMark'

const steps = ['Personal Info', 'Documents', 'Role Assignment', 'Complete']

interface OnboardingProps {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', dob: '' })
  const [role, setRole] = useState<Role>('agent')
  const [team, setTeam] = useState('India Sales')
  const [uploaded, setUploaded] = useState<string[]>([])

  const docs = ['Aadhar Card', 'PAN Card', 'Degree Certificate', 'Offer Letter', 'Bank Details']

  const toggleDoc = (doc: string) => {
    setUploaded((prev) => prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc])
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <LogoMark size={30} color="#C9A96E" />
            <div className="text-left">
              <p className="font-serif text-lg font-bold leading-none tracking-wider text-primary">PARVA</p>
              <p className="text-[9px] tracking-[0.3em] uppercase font-light" style={{ color: '#7A7065' }}>— REALTIES —</p>
            </div>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">Employee Onboarding</h1>
          <p className="text-muted-foreground">Complete your profile to get started</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center mb-10">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: i < step ? '#C9A96E' : i === step ? '#1C2B4A' : '#F0EDE7',
                    color: i <= step ? '#fff' : '#7A7065',
                  }}
                >
                  {i < step ? <Check size={16} /> : i + 1}
                </div>
                <span className="text-xs mt-1.5 font-medium" style={{ color: i === step ? '#1C2B4A' : '#7A7065' }}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="w-16 h-px mx-2 mb-4" style={{ backgroundColor: i < step ? '#C9A96E' : '#E5DFD5' }} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-8">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-6">Personal Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">First Name</label>
                  <input className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" placeholder="Vikash" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Last Name</label>
                  <input className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" placeholder="Tiwari" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Work Email</label>
                <input type="email" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" placeholder="vikash.tiwari@parvarrealties.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone Number</label>
                  <input className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" placeholder="+91 98765 XXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date of Birth</label>
                  <input type="date" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-2">Document Upload</h2>
              <p className="text-sm text-muted-foreground mb-6">Upload the required documents to complete your profile.</p>
              <div className="space-y-3">
                {docs.map((doc) => (
                  <div
                    key={doc}
                    onClick={() => toggleDoc(doc)}
                    className="flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all"
                    style={{
                      borderColor: uploaded.includes(doc) ? '#C9A96E' : '#E5DFD5',
                      backgroundColor: uploaded.includes(doc) ? 'rgba(201,169,110,0.05)' : '#fff',
                    }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: uploaded.includes(doc) ? 'rgba(201,169,110,0.15)' : '#F5F2EC' }}>
                      {uploaded.includes(doc) ? <Check size={18} color="#C9A96E" /> : <Upload size={18} color="#7A7065" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{doc}</p>
                      <p className="text-xs text-muted-foreground">{uploaded.includes(doc) ? 'Uploaded successfully' : 'Click to upload PDF or image'}</p>
                    </div>
                    {uploaded.includes(doc) && <span className="text-xs font-medium text-emerald-600">✓ Done</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-6">Role Assignment</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">Assign Role</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['agent', 'manager'] as Role[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRole(r)}
                        className="p-3 rounded-xl border text-left transition-all capitalize text-sm font-medium"
                        style={{
                          borderColor: role === r ? '#C9A96E' : '#E5DFD5',
                          backgroundColor: role === r ? 'rgba(201,169,110,0.08)' : '#fff',
                          color: role === r ? '#1C2B4A' : '#7A7065',
                        }}
                      >
                        {r === 'agent' ? 'CRM Agent' : r === 'manager' ? 'Sales Manager' : 'HR Manager'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">Assign to Team</label>
                  <select
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option>India Sales</option>
                    <option>Dubai Sales</option>
                    <option>HR</option>
                    <option>Leadership</option>
                  </select>
                </div>
                <div className="p-4 rounded-xl bg-muted border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Reporting Manager</p>
                  <p className="text-sm font-medium text-foreground">Chaitra</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg, #C9A96E, #A8823C)' }}>
                <Check size={36} color="#fff" strokeWidth={3} />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-foreground mb-3">Onboarding Complete</h2>
              <p className="text-muted-foreground mb-8">Your profile has been set up successfully. Welcome to Parvar Realties!</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {[{ label: 'Role', value: role === 'agent' ? 'CRM Agent' : 'Manager' }, { label: 'Team', value: team }, { label: 'Documents', value: `${uploaded.length}/${docs.length}` }].map((s) => (
                  <div key={s.label} className="p-3 rounded-xl bg-muted text-center">
                    <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                    <p className="text-sm font-semibold text-foreground capitalize">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={() => step > 0 && setStep(step - 1)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
            >
              Back
            </button>
            <button
              onClick={() => step < 3 ? setStep(step + 1) : onComplete()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}
            >
              {step === 3 ? 'Go to Dashboard' : 'Continue'}
              {step < 3 && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
