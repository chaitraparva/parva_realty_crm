import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff } from 'lucide-react'

interface Participant {
  name: string
  initials: string
}

interface CallModalProps {
  open: boolean
  callType: 'voice' | 'video'
  contactName: string
  contactInitials: string
  groupName?: string
  participants?: Participant[]
  onEnd: (durationSec: number) => void
}

export default function CallModal({ open, callType, contactName, contactInitials, groupName, participants, onEnd }: CallModalProps) {
  const [phase, setPhase] = useState<'ringing' | 'connected'>('ringing')
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)
  const [cameraError, setCameraError] = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)
  const [screenShareError, setScreenShareError] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  const isGroup = !!groupName && !!participants && participants.length > 0

  useEffect(() => {
    if (!open) return
    setPhase('ringing')
    setSeconds(0)
    setMuted(false)
    setCameraOn(true)
    setCameraError(false)
    setScreenSharing(false)
    setScreenShareError(false)
    const ringTimeout = setTimeout(() => setPhase('connected'), 1600)
    return () => clearTimeout(ringTimeout)
  }, [open])

  // Self-view camera preview for video calls — a genuine local webcam feed
  // where the browser allows it, with a graceful placeholder if it doesn't.
  useEffect(() => {
    if (!open || callType !== 'video') return
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setCameraError(true))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open, callType])

  // Stop any active screen share when the call ends or the modal closes
  useEffect(() => {
    if (!open) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (phase === 'connected') {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    setScreenSharing(false)
  }

  const startScreenShare = async () => {
    setScreenShareError(false)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      screenStreamRef.current = stream
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream
      setScreenSharing(true)
      // Fires when the user clicks the browser's own "Stop sharing" control
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        screenStreamRef.current = null
        setScreenSharing(false)
      })
    } catch {
      // User cancelled the picker, or this environment doesn't allow screen capture
      setScreenShareError(true)
    }
  }

  const handleEnd = () => {
    stopScreenShare()
    onEnd(seconds)
  }

  if (!open) return null

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  const showSelfCamera = callType === 'video' && cameraOn && !cameraError

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-4" style={{ backgroundColor: 'rgba(16,19,30,0.96)' }}>
      {isGroup && (
        <div className="mb-3 text-center">
          <p className="text-sm font-semibold" style={{ color: '#FAF8F5' }}>{groupName}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(250,248,245,0.5)' }}>
            {phase === 'ringing' ? `Calling ${participants!.length} people…` : `${mm}:${ss} · ${participants!.length} on the call`}
          </p>
        </div>
      )}

      {callType === 'video' ? (
        <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden mb-2" style={{ backgroundColor: '#1A1F30' }}>
          {screenSharing ? (
            <div className="relative w-full h-full">
              <video ref={screenVideoRef} autoPlay muted playsInline className="w-full h-full object-contain bg-black" />
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(37,99,235,0.9)', color: '#fff' }}>
                <ScreenShare size={12} /> You're sharing your screen
              </div>
            </div>
          ) : isGroup ? (
            <div className={`grid h-full w-full gap-1 ${participants!.length <= 2 ? 'grid-cols-2' : participants!.length <= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-3'}`}>
              {participants!.map((p) => (
                <div key={p.name} className="flex flex-col items-center justify-center" style={{ backgroundColor: '#161B29' }}>
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-base font-semibold mb-1.5"
                    style={{ backgroundColor: 'rgba(201,169,110,0.2)', color: '#C9A96E' }}
                  >
                    {p.initials}
                  </div>
                  <p className="text-xs font-medium" style={{ color: '#FAF8F5' }}>{p.name.split(' ')[0]}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-semibold mb-4"
                  style={{ backgroundColor: 'rgba(201,169,110,0.2)', color: '#C9A96E' }}
                >
                  {contactInitials}
                </div>
                <p className="text-base font-semibold" style={{ color: '#FAF8F5' }}>{contactName}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(250,248,245,0.5)' }}>
                  {phase === 'ringing' ? 'Calling…' : `${mm}:${ss}`}
                </p>
              </div>
            </div>
          )}

          {/* Self-view PIP */}
          <div className="absolute bottom-3 right-3 w-28 h-20 rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(250,248,245,0.15)', backgroundColor: '#10131E' }}>
            {showSelfCamera ? (
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <VideoOff size={16} style={{ color: 'rgba(250,248,245,0.4)' }} />
              </div>
            )}
          </div>
        </div>
      ) : isGroup ? (
        <div className="flex items-center justify-center -space-x-3 mb-5">
          {participants!.slice(0, 5).map((p) => (
            <div
              key={p.name}
              className="w-16 h-16 rounded-full flex items-center justify-center text-base font-semibold border-2"
              style={{ backgroundColor: 'rgba(201,169,110,0.2)', color: '#C9A96E', borderColor: '#10131E' }}
            >
              {p.initials}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-semibold mb-5"
          style={{ backgroundColor: 'rgba(201,169,110,0.2)', color: '#C9A96E' }}
        >
          {contactInitials}
        </div>
      )}

      {callType === 'video' && screenShareError && (
        <p className="text-xs mb-2" style={{ color: '#F87171' }}>Couldn't start screen sharing — it may not be permitted in this environment.</p>
      )}

      {callType === 'voice' && !isGroup && (
        <>
          <p className="text-lg font-semibold" style={{ color: '#FAF8F5' }}>{contactName}</p>
          <p className="text-sm mt-1.5" style={{ color: 'rgba(250,248,245,0.6)' }}>
            {phase === 'ringing' ? 'Calling…' : `${mm}:${ss}`}
          </p>
        </>
      )}
      {callType === 'voice' && isGroup && (
        <p className="text-sm mt-1" style={{ color: 'rgba(250,248,245,0.6)' }}>
          {phase === 'ringing' ? 'Calling…' : `${mm}:${ss}`}
        </p>
      )}

      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={() => setMuted((m) => !m)}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: muted ? '#C9A96E' : 'rgba(250,248,245,0.12)', color: muted ? '#1C2B4A' : '#FAF8F5' }}
        >
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        {callType === 'video' && (
          <>
            <button
              onClick={() => setCameraOn((c) => !c)}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              style={{ backgroundColor: !cameraOn ? '#C9A96E' : 'rgba(250,248,245,0.12)', color: !cameraOn ? '#1C2B4A' : '#FAF8F5' }}
            >
              {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
            <button
              onClick={() => (screenSharing ? stopScreenShare() : startScreenShare())}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              style={{ backgroundColor: screenSharing ? '#2563EB' : 'rgba(250,248,245,0.12)', color: '#FAF8F5' }}
              title={screenSharing ? 'Stop sharing' : 'Share your screen'}
            >
              {screenSharing ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
            </button>
          </>
        )}
        <button
          onClick={handleEnd}
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#DC2626', color: '#fff' }}
        >
          <PhoneOff size={22} />
        </button>
      </div>
      {phase === 'ringing' && (
        <p className="flex items-center justify-center gap-1.5 text-xs mt-6" style={{ color: 'rgba(250,248,245,0.4)' }}>
          <Phone size={12} className="animate-pulse" /> Connecting over the app — no phone number needed
        </p>
      )}
    </div>
  )
}
