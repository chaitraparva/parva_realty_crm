/**
 * IncomingCall.tsx
 *
 * Incoming call notification overlay.
 * Shows caller name, call type, and Accept / Decline buttons.
 * Does NOT auto-join the call — the user must explicitly click Accept.
 */

import { useEffect, useRef } from 'react'
import { Phone, PhoneOff, Video } from 'lucide-react'
import type { CallSignalPayload } from '../../services/livekitCallService'

interface IncomingCallProps {
  signal: CallSignalPayload
  onAccept: () => void
  onDecline: () => void
}

function initials(name: string) {
  return (name || '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function IncomingCall({ signal, onAccept, onDecline }: IncomingCallProps) {
  const ringtoneRef = useRef<HTMLAudioElement | null>(null)

  // Play a subtle in-browser pulse beep (no audio file dependency needed)
  useEffect(() => {
    let ctx: AudioContext | null = null
    let stopped = false

    const playBeep = () => {
      if (stopped) return
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(440, ctx.currentTime)
        osc.frequency.setValueAtTime(550, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.4)
      } catch { /* AudioContext unavailable */ }
    }

    playBeep()
    const interval = setInterval(playBeep, 1800)

    return () => {
      stopped = true
      clearInterval(interval)
      ctx?.close().catch(() => {})
    }
  }, [])

  const callerInitials = initials(signal.callerName)
  const isVideo = signal.callType === 'video'
  const isGroup = signal.isGroup

  return (
    <div
      className="fixed bottom-6 right-6 z-[80] flex items-start gap-4 p-5 rounded-2xl shadow-2xl max-w-sm w-full"
      style={{
        backgroundColor: '#10131E',
        border: '1px solid rgba(201,169,110,0.3)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      }}
      role="dialog"
      aria-label="Incoming call"
    >
      {/* Caller avatar */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ring-2 ring-offset-2"
        style={{
          backgroundColor: 'rgba(201,169,110,0.2)',
          color: '#C9A96E',
        }}
      >
        {callerInitials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: '#FAF8F5' }}>
          {signal.callerName}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(250,248,245,0.55)' }}>
          Incoming {isVideo ? 'video' : 'voice'} call{isGroup ? ` · ${signal.groupName || 'Group'}` : ''}
        </p>

        <div className="flex items-center gap-2 mt-3">
          {/* Decline */}
          <button
            id="incoming-call-decline"
            onClick={onDecline}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ backgroundColor: 'rgba(220,38,38,0.15)', color: '#F87171' }}
          >
            <PhoneOff size={13} /> Decline
          </button>

          {/* Accept */}
          <button
            id="incoming-call-accept"
            onClick={onAccept}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ backgroundColor: '#16A34A', color: '#fff' }}
          >
            {isVideo ? <Video size={13} /> : <Phone size={13} />}
            Accept
          </button>
        </div>
      </div>

      {/* Animated ring indicator */}
      <span
        className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping"
        style={{ backgroundColor: '#16A34A' }}
      />
      <span
        className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
        style={{ backgroundColor: '#16A34A' }}
      />

      {/* Hidden audio ref placeholder */}
      <audio ref={ringtoneRef} />
    </div>
  )
}
