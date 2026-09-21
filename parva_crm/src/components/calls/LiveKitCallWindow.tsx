/**
 * LiveKitCallWindow.tsx
 *
 * Full-screen call window powered by the LiveKit client SDK.
 *
 * Security:
 *  - Never stores or uses a room name directly. Connects by calling
 *    fetchLiveKitToken(conversationId) which verifies membership server-side.
 *
 * Features:
 *  - Audio/video track publishing
 *  - Remote participant audio/video rendering
 *  - Screen sharing via getDisplayMedia() → separate LiveKit track source
 *  - Mute/unmute microphone
 *  - Camera on/off (video calls only)
 *  - Screen share start/stop (video calls only)
 *  - End call
 *  - Participant list overlay
 *  - Connection phase display (connecting → connected)
 *  - Call duration timer
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
  LocalAudioTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  createLocalTracks,
  VideoPresets,
} from 'livekit-client'
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Loader2,
  Users,
  X,
} from 'lucide-react'
import { fetchLiveKitToken } from '../../services/livekitCallService'

// ── Types ──────────────────────────────────────────────────────────────────

interface Participant {
  name: string
  initials: string
}

export interface LiveKitCallWindowProps {
  /** Supabase conversation UUID — passed to backend for authorization */
  conversationId: string
  /** voice or video */
  callType: 'voice' | 'video'
  /** Display name of the contact (direct call) */
  contactName: string
  contactInitials: string
  /** Optional group call props */
  groupName?: string
  participants?: Participant[]
  /** Called when the local user ends the call */
  onEnd: (durationSec: number) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatSecs(s: number) {
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function inits(name: string) {
  return (name || '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

// ── Component ──────────────────────────────────────────────────────────────

export default function LiveKitCallWindow({
  conversationId,
  callType,
  contactName,
  contactInitials,
  groupName,
  participants,
  onEnd,
}: LiveKitCallWindowProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [errorMsg, setErrorMsg] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(callType === 'video')
  const [screenSharing, setScreenSharing] = useState(false)
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([])
  const [showParticipants, setShowParticipants] = useState(false)

  // ── Refs ───────────────────────────────────────────────────────────────
  const roomRef = useRef<Room | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null)
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null)
  const screenTrackRef = useRef<LocalVideoTrack | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  // ── Timer ──────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // ── Track attachment ───────────────────────────────────────────────────
  // Uses a structural type so both RemoteTrack (subscribed) and
  // Track (from pub.track, which TypeScript types as base Track) work.
  const attachRemoteTrack = useCallback((
    participant: RemoteParticipant,
    track: { kind: Track.Kind; attach: (el: HTMLVideoElement | HTMLAudioElement) => HTMLMediaElement }
  ) => {
    if (track.kind === Track.Kind.Video) {
      const el = remoteVideoRefs.current.get(participant.identity)
      if (el) track.attach(el)
    }
    if (track.kind === Track.Kind.Audio) {
      const el = remoteAudioRefs.current.get(participant.identity)
      if (el) track.attach(el)
    }
  }, [])

  // ── Detach track ───────────────────────────────────────────────────────
  const detachRemoteTrack = useCallback((
    _participant: RemoteParticipant,
    track: { kind: Track.Kind; detach: () => HTMLMediaElement[] }
  ) => {
    track.detach()
  }, [])

  // ── Connect to LiveKit ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    })
    roomRef.current = room

    // ── Participant events ────────────────────────────────────────────
    const onParticipantConnected = (p: RemoteParticipant) => {
      setRemoteParticipants((prev) => [...prev.filter((x) => x.identity !== p.identity), p])
      p.getTrackPublications().forEach((pub) => {
        if (pub.track) attachRemoteTrack(p, pub.track)
      })
    }

    const onParticipantDisconnected = (p: RemoteParticipant) => {
      setRemoteParticipants((prev) => prev.filter((x) => x.identity !== p.identity))
    }

    const onTrackSubscribed = (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
      attachRemoteTrack(p, track)
    }

    const onTrackUnsubscribed = (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
      detachRemoteTrack(p, track)
    }

    const onDisconnected = () => {
      if (!cancelled) {
        stopTimer()
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000)
        onEnd(duration)
      }
    }

    room
      .on(RoomEvent.ParticipantConnected, onParticipantConnected)
      .on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      .on(RoomEvent.TrackSubscribed, onTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.Connected, () => {
        if (!cancelled) {
          setPhase('connected')
          startTimer()
        }
      })

    const connect = async () => {
      try {
        // Token fetch validates membership server-side
        const { token, serverUrl } = await fetchLiveKitToken(conversationId)
        if (cancelled) return

        // Create local tracks
        const tracks = await createLocalTracks({
          audio: true,
          video: callType === 'video'
            ? { resolution: VideoPresets.h360.resolution }
            : false,
        })

        if (cancelled) {
          tracks.forEach((t) => t.stop())
          return
        }

        // Store track refs and attach local video preview
        for (const track of tracks) {
          if (track.kind === Track.Kind.Video) {
            localVideoTrackRef.current = track as LocalVideoTrack
            if (localVideoRef.current) {
              (track as LocalVideoTrack).attach(localVideoRef.current)
            }
          }
          if (track.kind === Track.Kind.Audio) {
            localAudioTrackRef.current = track as LocalAudioTrack
          }
        }

        // Connect to room
        await room.connect(serverUrl, token)
        if (cancelled) return

        // Publish audio (always)
        if (localAudioTrackRef.current) {
          await room.localParticipant.publishTrack(localAudioTrackRef.current)
        }
        // Publish video (video calls only)
        if (localVideoTrackRef.current) {
          await room.localParticipant.publishTrack(localVideoTrackRef.current)
        }

        // Snapshot of already-present remote participants
        if (!cancelled) {
          setRemoteParticipants(Array.from(room.remoteParticipants.values()))
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Could not connect to call'
          console.error('[LiveKit] Connection error:', msg)
          setErrorMsg(msg)
          setPhase('error')
        }
      }
    }

    void connect()

    return () => {
      cancelled = true
      stopTimer()
      // Unpublish / stop screen share track cleanly
      if (screenTrackRef.current) {
        const r = roomRef.current
        if (r) {
          r.localParticipant.unpublishTrack(screenTrackRef.current).catch(() => {})
        }
        screenTrackRef.current.stop()
        screenTrackRef.current = null
      }
      // Stop local camera/mic
      localVideoTrackRef.current?.stop()
      localAudioTrackRef.current?.stop()
      // Disconnect from room
      room.disconnect()
      roomRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, callType])

  // Attach tracks for newly-connected remote participants
  useEffect(() => {
    for (const p of remoteParticipants) {
      p.getTrackPublications().forEach((pub) => {
        if (pub.track) attachRemoteTrack(p, pub.track)
      })
    }
  }, [remoteParticipants, attachRemoteTrack])

  // ── Controls ───────────────────────────────────────────────────────────

  const toggleMute = async () => {
    const room = roomRef.current
    if (!room || phase !== 'connected') return
    try {
      // setMicrophoneEnabled manages publishing/unpublishing the audio track
      await room.localParticipant.setMicrophoneEnabled(muted)
      setMuted((m) => !m)
    } catch (e) {
      console.warn('[LiveKit] Mute toggle failed:', e)
    }
  }

  const toggleCamera = async () => {
    const room = roomRef.current
    if (!room || callType !== 'video' || phase !== 'connected') return
    try {
      await room.localParticipant.setCameraEnabled(!cameraOn)
      setCameraOn((c) => !c)
    } catch (e) {
      console.warn('[LiveKit] Camera toggle failed:', e)
    }
  }

  // ── Screen sharing ─────────────────────────────────────────────────────

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current
    const track = screenTrackRef.current
    if (!track) return

    // Unpublish from LiveKit room so remote participants stop seeing it
    if (room) {
      try {
        await room.localParticipant.unpublishTrack(track, true)
      } catch (e) {
        console.warn('[LiveKit] Screen share unpublish failed:', e)
      }
    }

    // Detach from local preview element
    if (screenVideoRef.current) {
      track.detach(screenVideoRef.current)
    }

    // Stop the underlying MediaStreamTrack
    track.stop()
    screenTrackRef.current = null
    setScreenSharing(false)
  }, [])

  const startScreenShare = async () => {
    const room = roomRef.current
    if (!room || callType !== 'video' || phase !== 'connected') return

    try {
      // Request screen capture from the browser
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      })

      const mediaTrack = stream.getVideoTracks()[0]
      if (!mediaTrack) return

      // Wrap in a LiveKit LocalVideoTrack with source=ScreenShare
      const screenTrack = new LocalVideoTrack(mediaTrack, undefined, false)
      screenTrackRef.current = screenTrack

      // Attach to local preview <video> so the sharer can see what they're sharing
      if (screenVideoRef.current) {
        screenTrack.attach(screenVideoRef.current)
      }

      // Publish to room — other participants will subscribe automatically
      await room.localParticipant.publishTrack(screenTrack, {
        source: Track.Source.ScreenShare,
        name: 'screen',
      })

      setScreenSharing(true)

      // Handle the browser's built-in "Stop sharing" button
      mediaTrack.addEventListener('ended', () => {
        void stopScreenShare()
      })
    } catch (e) {
      // User cancelled the picker or permission was denied — not an error
      console.warn('[LiveKit] Screen share start failed:', e)
    }
  }

  const handleEnd = async () => {
    stopTimer()
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000)
    await stopScreenShare()
    roomRef.current?.disconnect()
    onEnd(duration)
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const isGroup = !!groupName
  const allParticipantCount = 1 + remoteParticipants.length // local + remote

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center"
      style={{ backgroundColor: 'rgba(11,14,23,0.98)' }}
    >
      {/* ── Error state ── */}
      {phase === 'error' && (
        <div className="flex flex-col items-center gap-4 max-w-xs text-center px-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(220,38,38,0.15)' }}>
            <PhoneOff size={28} style={{ color: '#DC2626' }} />
          </div>
          <p className="text-base font-semibold" style={{ color: '#FAF8F5' }}>Call Failed</p>
          <p className="text-sm" style={{ color: 'rgba(250,248,245,0.6)' }}>{errorMsg}</p>
          <button
            onClick={() => onEnd(0)}
            className="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#DC2626', color: '#fff' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Active call ── */}
      {phase !== 'error' && (
        <div className="w-full h-full flex flex-col">
          {/* ── Top bar ── */}
          <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#FAF8F5' }}>
                {isGroup ? groupName : contactName}
              </p>
              <p className="text-xs" style={{ color: 'rgba(250,248,245,0.55)' }}>
                {phase === 'connecting'
                  ? 'Connecting…'
                  : `${formatSecs(seconds)} · ${allParticipantCount} participant${allParticipantCount !== 1 ? 's' : ''}`}
              </p>
            </div>

            {phase === 'connecting' && (
              <Loader2 size={18} className="animate-spin" style={{ color: '#C9A96E' }} />
            )}

            <button
              onClick={() => setShowParticipants((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: showParticipants ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.08)', color: '#FAF8F5' }}
              title="Participants"
            >
              <Users size={13} /> {allParticipantCount}
            </button>
          </div>

          {/* ── Main area ── */}
          <div className="flex-1 flex overflow-hidden">
            {/* ── Video / avatar area ── */}
            <div className="flex-1 relative flex flex-col items-center justify-center" style={{ backgroundColor: '#0B0E17' }}>
              {callType === 'video' ? (
                <>
                  {/* Screen share takes over the main view when active */}
                  {screenSharing ? (
                    <div className="w-full h-full relative">
                      <video
                        ref={screenVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-contain"
                        style={{ backgroundColor: '#000' }}
                      />
                      <div
                        className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'rgba(37,99,235,0.9)', color: '#fff' }}
                      >
                        <ScreenShare size={12} /> You're sharing your screen
                      </div>
                    </div>
                  ) : remoteParticipants.length > 0 ? (
                    /* Remote participants grid */
                    <div className={`w-full h-full grid gap-1 ${remoteParticipants.length === 1 ? 'grid-cols-1' : remoteParticipants.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {remoteParticipants.map((p) => (
                        <div key={p.identity} className="relative flex items-center justify-center" style={{ backgroundColor: '#161B29' }}>
                          <video
                            ref={(el) => { if (el) remoteVideoRefs.current.set(p.identity, el) }}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          {/* Name tag */}
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#FAF8F5' }}>
                            {p.name || p.identity.slice(0, 8)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Waiting for others */
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-semibold" style={{ backgroundColor: 'rgba(201,169,110,0.18)', color: '#C9A96E' }}>
                        {isGroup ? <Users size={36} style={{ color: '#C9A96E' }} /> : contactInitials}
                      </div>
                      <p className="text-sm font-semibold" style={{ color: '#FAF8F5' }}>
                        {isGroup ? groupName : contactName}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(250,248,245,0.5)' }}>
                        Waiting for others to join…
                      </p>
                    </div>
                  )}

                  {/* Local camera PIP (bottom-right) */}
                  <div
                    className="absolute bottom-3 right-3 w-32 h-24 rounded-xl overflow-hidden border"
                    style={{ borderColor: 'rgba(250,248,245,0.15)', backgroundColor: '#10131E', zIndex: 10 }}
                  >
                    {cameraOn ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                        <VideoOff size={16} style={{ color: 'rgba(250,248,245,0.4)' }} />
                        <p className="text-[10px]" style={{ color: 'rgba(250,248,245,0.4)' }}>Camera off</p>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-0 right-0 text-center">
                      <span className="text-[10px]" style={{ color: 'rgba(250,248,245,0.7)' }}>You</span>
                    </div>
                  </div>
                </>
              ) : (
                /* Voice call — avatar display */
                <div className="flex flex-col items-center gap-5">
                  {isGroup && participants ? (
                    <div className="flex items-center justify-center -space-x-4">
                      {participants.slice(0, 5).map((p) => (
                        <div key={p.name} className="w-16 h-16 rounded-full flex items-center justify-center text-base font-semibold border-2" style={{ backgroundColor: 'rgba(201,169,110,0.2)', color: '#C9A96E', borderColor: '#0B0E17' }}>
                          {p.initials}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-semibold" style={{ backgroundColor: 'rgba(201,169,110,0.18)', color: '#C9A96E' }}>
                      {contactInitials}
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-lg font-semibold" style={{ color: '#FAF8F5' }}>{isGroup ? groupName : contactName}</p>
                    <p className="text-sm mt-1" style={{ color: 'rgba(250,248,245,0.55)' }}>
                      {phase === 'connecting' ? 'Connecting…' : formatSecs(seconds)}
                    </p>
                  </div>
                  {/* Remote audio status badges */}
                  {remoteParticipants.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {remoteParticipants.map((p) => (
                        <div key={p.identity} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          {p.name || 'Participant'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Participants sidebar ── */}
            {showParticipants && (
              <div className="w-64 flex flex-col border-l" style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(250,248,245,0.5)' }}>
                    Participants ({allParticipantCount})
                  </p>
                  <button onClick={() => setShowParticipants(false)} style={{ color: 'rgba(250,248,245,0.4)' }}>
                    <X size={14} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {/* Local participant */}
                  <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg" style={{ backgroundColor: 'rgba(201,169,110,0.08)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: 'rgba(201,169,110,0.2)', color: '#C9A96E' }}>
                      {isGroup ? inits('You') : contactInitials ? inits(contactName) : 'Y'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: '#FAF8F5' }}>You</p>
                      <p className="text-[10px]" style={{ color: 'rgba(250,248,245,0.4)' }}>{muted ? '🔇 Muted' : '🎙 Speaking'}</p>
                    </div>
                  </div>
                  {/* Remote participants */}
                  {remoteParticipants.map((p) => (
                    <div key={p.identity} className="flex items-center gap-2.5 px-2 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: 'rgba(28,43,74,0.3)', color: '#FAF8F5' }}>
                        {inits(p.name || '?')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: '#FAF8F5' }}>{p.name || 'Participant'}</p>
                        <p className="text-[10px]" style={{ color: 'rgba(250,248,245,0.4)' }}>Connected</p>
                      </div>
                    </div>
                  ))}
                  {remoteParticipants.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: 'rgba(250,248,245,0.35)' }}>
                      Waiting for others…
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Remote audio elements (invisible — needed for audio playback) */}
          {remoteParticipants.map((p) => (
            <audio
              key={p.identity}
              ref={(el) => { if (el) remoteAudioRefs.current.set(p.identity, el) }}
              autoPlay
            />
          ))}

          {/* ── Controls bar ── */}
          <div
            className="flex items-center justify-center gap-3 px-6 py-5"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {/* Mute */}
            <button
              id="lk-mute-btn"
              onClick={toggleMute}
              disabled={phase !== 'connected'}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ backgroundColor: muted ? '#C9A96E' : 'rgba(250,248,245,0.12)', color: muted ? '#1C2B4A' : '#FAF8F5' }}
              title={muted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Camera (video calls only) */}
            {callType === 'video' && (
              <button
                id="lk-camera-btn"
                onClick={toggleCamera}
                disabled={phase !== 'connected'}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                style={{ backgroundColor: !cameraOn ? '#C9A96E' : 'rgba(250,248,245,0.12)', color: !cameraOn ? '#1C2B4A' : '#FAF8F5' }}
                title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
            )}

            {/* Screen share (video calls only) */}
            {callType === 'video' && (
              <button
                id="lk-screenshare-btn"
                onClick={() => (screenSharing ? stopScreenShare() : startScreenShare())}
                disabled={phase !== 'connected'}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                style={{ backgroundColor: screenSharing ? '#2563EB' : 'rgba(250,248,245,0.12)', color: '#FAF8F5' }}
                title={screenSharing ? 'Stop sharing screen' : 'Share your screen'}
              >
                {screenSharing ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
              </button>
            )}

            {/* End call */}
            <button
              id="lk-end-call-btn"
              onClick={handleEnd}
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: '#DC2626', color: '#fff' }}
              title="End call"
            >
              <PhoneOff size={22} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
