import { useState, useEffect, useCallback, useRef } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { Role } from '../types'
import LogoMark from '../components/ui/LogoMark'
import { supabase } from '../lib/supabase'
import { authApi, ApiError } from '../services/api'

// Role cards — a UI selection / expectation-setting aid only. The
// authoritative role always comes from the employee record the backend
// returns after a real Supabase Auth login; selecting a different card here
// can never grant access to that role (see requirement: role security).
const ROLE_CARDS: { id: Role; label: string; sublabel: string }[] = [
  { id: 'agent', label: 'CRM Executive', sublabel: 'Manage leads & client follow-ups' },
  { id: 'manager', label: 'Sales Manager', sublabel: 'Team oversight & lead distribution' },
  { id: 'admin', label: 'Super Admin', sublabel: 'Full organisation control' },
]

function PasswordStrength({ value }: { value: string }) {
  if (!value) return null
  const checks = [
    { label: 'At least 8 characters', ok: value.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(value) },
    { label: 'One number', ok: /[0-9]/.test(value) },
    { label: 'One special character', ok: /[^A-Za-z0-9]/.test(value) },
  ]
  const score = checks.filter((c) => c.ok).length
  const color = ['#DC2626', '#DC2626', '#F59E0B', '#F97316', '#10B981'][score]
  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][score]
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all" style={{ backgroundColor: i <= score ? color : '#E5E7EB' }} />
        ))}
      </div>
      <p className="text-xs font-semibold" style={{ color }}>{label}</p>
      <div className="space-y-0.5">
        {checks.map((c) => (
          <p key={c.label} className="text-[11px] flex items-center gap-1.5" style={{ color: c.ok ? '#10B981' : '#9CA3AF' }}>
            {c.ok ? '✓' : '○'} {c.label}
          </p>
        ))}
      </div>
    </div>
  )
}

export interface AuthenticatedProfile {
  id: string
  name: string
  email: string
  role: Role
  office: string
}

interface LoginProps {
  onLogin: (profile: AuthenticatedProfile) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'login' | 'set-password' | 'forgot' | 'reset-sent'>('login')
  const [checkingSession, setCheckingSession] = useState(true)
  const loginStartedRef = useRef(false)

  // Set-password state — used for BOTH first-time invite links and
  // forgot-password recovery links. Supabase delivers both as the same
  // PASSWORD_RECOVERY auth event once the link's token is detected.
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [setPassError, setSetPassError] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [pendingLabel, setPendingLabel] = useState('')

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  // Loads the authoritative employee/role record for whatever Supabase
  // session currently exists and hands off to the app. Never trusts
  // anything read from the client for role/identity — only what the
  // backend, which itself verified the Supabase token, returns.
  const completeLogin = useCallback(async () => {
    try {
      const profile = await authApi.me()
      onLogin({
        id: profile.id as string,
        name: profile.name as string,
        email: profile.email as string,
        role: profile.role as Role,
        office: (profile.office as string) || '',
      })
    } catch (err) {
      await supabase.auth.signOut()
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not load your profile. Please sign in again.'
      )
    }
  }, [onLogin])

  // On mount: restore an existing session (page refresh / reopen), and
  // listen for invite / password-reset links landing on this page.
  useEffect(() => {
    let active = true

    // Detect both Supabase auth flows for password recovery:
    //  Implicit flow → #access_token=...&type=recovery in the URL hash
    //  PKCE flow     → ?code=XXXX in the query string (Supabase default email template)
    // In both cases we MUST keep the spinner alive until onAuthStateChange fires
    // PASSWORD_RECOVERY. Calling getSession() first returns null before the PKCE code
    // exchange completes, which would incorrectly show the login page.
    const hash = window.location.hash
    const search = window.location.search
    const isRecoveryLink =
      hash.includes('type=recovery') ||
      (hash.includes('access_token') && hash.includes('recovery')) ||
      search.includes('code=')

    if (isRecoveryLink) {
      // Keep checkingSession=true — onAuthStateChange will clear it.
      // Safety timeout: if Supabase never fires the event, stop spinning after 10s.
      const timeout = setTimeout(() => {
        if (active) setCheckingSession(false)
      }, 10000)

      const { data: sub } = supabase.auth.onAuthStateChange(
        (event: AuthChangeEvent, session: Session | null) => {
          if (!active) return
          if (event === 'PASSWORD_RECOVERY' && session) {
            clearTimeout(timeout)
            setPendingLabel(session.user.email || 'there')
            setStep('set-password')
            setCheckingSession(false)
          } else if (event === 'SIGNED_IN' && session && search.includes('code=')) {
            // PKCE: some Supabase versions fire SIGNED_IN instead of PASSWORD_RECOVERY
            // when the recovery code is exchanged. Treat it as a recovery flow.
            clearTimeout(timeout)
            setPendingLabel(session.user.email || 'there')
            setStep('set-password')
            setCheckingSession(false)
          }
        }
      )

      return () => {
        active = false
        clearTimeout(timeout)
        sub.subscription.unsubscribe()
      }
    }

    // Normal flow — no recovery hash or code in URL
    supabase.auth.getSession().then(({ data }) => {
      if (!active || loginStartedRef.current) return

      if (data.session) {
        completeLogin().finally(() => {
          if (active && !loginStartedRef.current) {
            setCheckingSession(false)
          }
        })
      } else {
        setCheckingSession(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          setPendingLabel(session.user.email || 'there')
          setStep('set-password')
          setCheckingSession(false)
        }
      }
    )

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Cancel any in-progress session restoration.
    loginStartedRef.current = true

    setError('')
    if (!selectedRole) { setError('Please select your role first.'); return }
    setLoading(true)
    try {
      // The backend verifies the password against Supabase Auth and
      // returns the authoritative employee record + a real session pair.
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (loginError || !data.session) {
        throw new Error('Invalid email or password.')
      }

      const profile = await authApi.me()

      onLogin({
        id: profile.id as string,
        name: profile.name as string,
        email: profile.email as string,
        role: profile.role as Role,
        office: (profile.office as string) || '',
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSetPassError('')
    if (newPass.length < 8) { setSetPassError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(newPass)) { setSetPassError('Add at least one uppercase letter.'); return }
    if (!/[0-9]/.test(newPass)) { setSetPassError('Add at least one number.'); return }
    if (!/[^A-Za-z0-9]/.test(newPass)) { setSetPassError('Add at least one special character.'); return }
    if (newPass !== confirmPass) { setSetPassError('Passwords do not match.'); return }

    setSettingPassword(true)
    try {
      // Sets the real Supabase Auth password for this account. No password
      // is ever stored anywhere by this app itself.
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPass })
      if (updateErr) throw updateErr
      await completeLogin()
    } catch (err) {
      setSetPassError(
        err instanceof Error
          ? err.message
          : 'Could not set your password. The link may have expired — request a new one.'
      )
    } finally {
      setSettingPassword(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotLoading(true)
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: window.location.origin,
      })
      if (resetErr) throw resetErr
    } catch {
      // Swallow the error deliberately — don't reveal whether an email is
      // registered. Either way we show the same "check your email" screen.
    } finally {
      setForgotLoading(false)
      setStep('reset-sent')
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <svg className="animate-spin h-6 w-6" style={{ color: '#C9A96E' }} viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  // ── Set Password screen (first-time invite OR password recovery) ──
  if (step === 'set-password') return (
    <div className="min-h-screen flex">
      <LeftBrand />
      <div className="flex-1 flex items-center justify-center px-5 sm:px-10 py-12 bg-background">
        <div className="w-full max-w-md">
          <div className="p-4 rounded-xl mb-6" style={{ backgroundColor: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)' }}>
            <p className="text-sm font-semibold text-foreground">Welcome{pendingLabel ? `, ${pendingLabel}` : ''}! 👋</p>
            <p className="text-xs text-muted-foreground mt-1">Set a secure password to access your portal.</p>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-foreground mb-1">Set your password</h2>
          <p className="text-sm text-muted-foreground mb-6">Choose a strong password you'll remember.</p>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">New Password</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPass} onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Create a strong password" required autoFocus
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 pr-20" />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground select-none">
                  {showNew ? '🙈 Hide' : '👁 Show'}
                </button>
              </div>
              <PasswordStrength value={newPass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm Password</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Re-enter your password" required
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 pr-20"
                  style={{ borderColor: confirmPass && confirmPass !== newPass ? '#DC2626' : undefined }} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground select-none">
                  {showConfirm ? '🙈 Hide' : '👁 Show'}
                </button>
              </div>
              {confirmPass && confirmPass !== newPass && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
              {confirmPass && confirmPass === newPass && <p className="text-xs text-emerald-600 mt-1">✓ Passwords match</p>}
            </div>
            {setPassError && <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>⚠ {setPassError}</div>}
            <button type="submit" disabled={settingPassword} className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity" style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: settingPassword ? 0.75 : 1 }}>
              {settingPassword ? 'Setting password…' : 'Set Password & Enter Portal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  // ── Reset sent ───────────────────────────────────────────────────
  if (step === 'reset-sent') return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}>
          <span className="text-3xl">📧</span>
        </div>
        <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">Check your email</h2>
        <p className="text-sm text-muted-foreground mb-1">If that address has a Parva Realty account, a password reset link has been sent to</p>
        <p className="font-semibold text-foreground mb-6">{forgotEmail}</p>
        <p className="text-xs text-muted-foreground mb-8">
          Didn't receive it? Contact <a href="mailto:chaitra@parvarealty.ae" className="text-accent hover:underline">chaitra@parvarealty.ae</a>
        </p>
        <button onClick={() => { setStep('login'); setForgotEmail(''); setForgotError('') }}
          className="w-full py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5' }}>
          ← Back to Sign In
        </button>
      </div>
    </div>
  )

  // ── Forgot password ──────────────────────────────────────────────
  if (step === 'forgot') return (
    <div className="min-h-screen flex">
      <LeftBrand />
      <div className="flex-1 flex items-center justify-center px-5 sm:px-10 py-12 bg-background">
        <div className="w-full max-w-md">
          <button onClick={() => { setStep('login'); setForgotError('') }} className="text-sm text-muted-foreground hover:text-foreground mb-8 flex items-center gap-1">← Back</button>
          <h2 className="font-serif text-2xl font-semibold text-foreground mb-1">Forgot Password</h2>
          <p className="text-sm text-muted-foreground mb-6">Enter your work email and we'll send you a reset link.</p>
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Work Email</label>
              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@parvarealty.ae" required autoFocus
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            {forgotError && <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>{forgotError}</div>}
            <button type="submit" disabled={forgotLoading} className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity" style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: forgotLoading ? 0.75 : 1 }}>
              {forgotLoading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  // ── Main login — matches Parva Group Portal design ───────────────
  return (
    <div className="min-h-screen flex">
      <LeftBrand />

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-5 sm:px-10 lg:px-16 py-12 bg-background overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <LogoMark size={34} color="#C9A96E" />
            <p className="font-serif text-base font-bold tracking-widest" style={{ color: '#C9A96E' }}>PARVA REALTY</p>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-foreground mb-1">Welcome</h1>
          <p className="text-sm text-muted-foreground mb-7">Select your role, then sign in with your registered work email</p>

          {/* Role cards — 2 column grid. UI aid only; see note above. */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">I AM A...</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
            {ROLE_CARDS.map((card) => {
              const isSelected = selectedRole === card.id
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => { setSelectedRole(card.id); setError('') }}
                  className="text-left p-4 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: isSelected ? '#C9A96E' : '#E5DFD5',
                    backgroundColor: isSelected ? 'rgba(201,169,110,0.08)' : 'transparent',
                  }}
                >
                  <p className="text-sm font-semibold text-foreground">{card.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{card.sublabel}</p>
                </button>
              )
            })}
          </div>

          {/* Email + password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Work email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="you@parvarealty.ae"
                required
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-muted-foreground">Password</label>
                <button type="button" onClick={() => { setForgotEmail(email); setStep('forgot') }} className="text-xs font-medium hover:underline" style={{ color: '#C9A96E' }}>
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 pr-20"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground select-none">
                  {showPass ? '🙈 Hide' : '👁 Show'}
                </button>
              </div>
              <p className="text-xs mt-1.5 text-muted-foreground">First time signing in? Use the password-setup link from your invitation email instead.</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                <span className="shrink-0">⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
              style={{ backgroundColor: '#1C2B4A', color: '#FAF8F5', opacity: loading ? 0.75 : 1 }}
            >
              {loading ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg> Signing in…</>
              ) : 'Continue'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Access issues? <a href="mailto:chaitra@parvarealty.ae" className="hover:underline" style={{ color: '#C9A96E' }}>chaitra@parvarealty.ae</a>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Left brand panel ─────────────────────────────────────────────
function LeftBrand() {
  return (
    <div className="hidden lg:flex lg:w-5/12 xl:w-[42%] flex-col relative overflow-hidden" style={{ backgroundColor: '#1C2B4A' }}>
      <img
        src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=1200&fit=crop&auto=format"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-15"
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,rgba(28,43,74,0.97) 0%,rgba(28,43,74,0.8) 100%)' }} />
      <div className="relative z-10 flex flex-col h-full p-12">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-auto">
          <LogoMark size={48} color="#C9A96E" />
          <div>
            <p className="font-serif text-xl font-bold tracking-widest leading-none" style={{ color: '#C9A96E' }}>PARVA REALTY</p>
            <p className="text-[10px] tracking-[0.25em] uppercase mt-1 font-light" style={{ color: 'rgba(201,169,110,0.55)' }}>CRM Portal</p>
          </div>
        </div>

        {/* Tagline */}
        <div className="mb-10">
          <h2 className="font-serif text-4xl font-semibold leading-tight mb-4" style={{ color: '#FAF8F5' }}>
            Built for every<br />level of your org
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(250,248,245,0.5)' }}>
            Leads, approvals and team operations flow through a clear hierarchy — from your CRM team to leadership.
          </p>
        </div>

        {/* Flow pills */}
        <div className="space-y-2 mb-10">
          {[
            ['CRM Executive', 'Sales Manager'],
            ['Sales Manager', 'Super Admin'],
          ].map(([from, to], i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: 'rgba(201,169,110,0.9)' }}>{from}</span>
              <span className="text-muted-foreground text-sm">→</span>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'rgba(250,248,245,0.08)', color: 'rgba(250,248,245,0.6)' }}>{to}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { n: 'Dubai & India', l: 'Two Offices' },
            { n: '6', l: 'Team Members' },
            { n: '3', l: 'Properties Listed' },
            { n: '100%', l: 'Client Focus' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,169,110,0.12)' }}>
              <p className="font-serif text-xl font-semibold" style={{ color: '#C9A96E' }}>{s.n}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(250,248,245,0.4)' }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
