interface LogoMarkProps { size?: number; color?: string }

export default function LogoMark({ size = 42, color = '#C9A96E' }: LogoMarkProps) {
  // Faithful recreation of the Parva Realty logo:
  // Large P stem on the left, large R arc on the right overlapping it,
  // smaller inner P stem + R nested inside at lower position.
  const s = size
  return (
    <svg width={s} height={s} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* ── OUTER P ── */}
      {/* P vertical stem — full height */}
      <rect x="10" y="8" width="13" height="100" rx="2" fill={color} />
      {/* P bowl — large top semicircle */}
      <path
        d="M23 8 Q72 8 72 38 Q72 68 23 68"
        stroke={color} strokeWidth="13" fill="none"
        strokeLinecap="round" strokeLinejoin="round"
      />

      {/* ── INNER R (sits offset inside / behind the P bowl) ── */}
      {/* R inner stem */}
      <rect x="38" y="44" width="10" height="64" rx="2" fill={color} />
      {/* R inner bowl — smaller semicircle starting mid-height */}
      <path
        d="M48 44 Q82 44 82 62 Q82 80 48 80"
        stroke={color} strokeWidth="10" fill="none"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* R diagonal leg */}
      <path
        d="M62 75 L95 108"
        stroke={color} strokeWidth="11" strokeLinecap="round"
      />
    </svg>
  )
}
