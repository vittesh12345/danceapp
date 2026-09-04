/** Circular score gauge with color that tracks quality. */

interface Props {
  value: number
  size?: number
  label?: string
  animate?: boolean
}

export function scoreColor(v: number): string {
  if (v >= 85) return '#34d399'
  if (v >= 70) return '#a3e635'
  if (v >= 55) return '#fbbf24'
  return '#fb7185'
}

export function ScoreRing({ value, size = 96, label }: Props) {
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  const color = scoreColor(v)
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(c * v) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.35s ease, stroke 0.35s ease' }}
        />
      </svg>
      <div className="score-ring-text">
        <span className="score-ring-value" style={{ color }}>
          {Math.round(v)}
        </span>
        {label && <span className="score-ring-label">{label}</span>}
      </div>
    </div>
  )
}
