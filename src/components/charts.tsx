import { scoreColor } from './ScoreRing'

/** Small hand-rolled SVG charts — no chart library needed. */

export function Sparkline({ data, height = 120 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null
  const w = 100
  const h = 100
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - Math.max(0, Math.min(100, v))}`)
  const area = `0,${h} ${pts.join(' ')} ${w},${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height }} className="sparkline">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(139,92,246,0.45)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkfill)" />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#a78bfa"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function CountBars({ scores, worst }: { scores: number[]; worst: [number, number] }) {
  const inWorst = (i: number) => {
    const c = i + 1
    const [a, b] = worst
    return a <= b ? c >= a && c <= b : c >= a || c <= b
  }
  return (
    <div className="count-bars">
      {scores.map((s, i) => (
        <div key={i} className="count-bar-col">
          <div className="count-bar-track">
            <div
              className="count-bar-fill"
              style={{ height: `${Math.max(4, s)}%`, background: scoreColor(s), opacity: inWorst(i) ? 1 : 0.75 }}
            />
          </div>
          <span className={`count-bar-label ${inWorst(i) ? 'worst' : ''}`}>{i + 1}</span>
        </div>
      ))}
    </div>
  )
}

export function AccuracyBars({ items }: { items: { label: string; accuracy: number }[] }) {
  return (
    <div className="acc-bars">
      {items.map((it) => (
        <div key={it.label} className="acc-bar-row">
          <span className="acc-bar-label">{it.label}</span>
          <div className="acc-bar-track">
            <div
              className="acc-bar-fill"
              style={{ width: `${Math.max(3, it.accuracy)}%`, background: scoreColor(it.accuracy) }}
            />
          </div>
          <span className="acc-bar-value">{it.accuracy}%</span>
        </div>
      ))}
    </div>
  )
}

export function ProgressLine({ points, height = 160 }: { points: { label: string; value: number }[]; height?: number }) {
  if (points.length === 0) return <p className="muted">No sessions yet.</p>
  const w = 100
  const h = 100
  const xs = points.length === 1 ? [w / 2] : points.map((_, i) => (i / (points.length - 1)) * w)
  const pts = points.map((p, i) => ({ x: xs[i], y: h - Math.max(0, Math.min(100, p.value)) }))
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }} className="progress-line">
          {[25, 50, 75].map((g) => (
            <line key={g} x1="0" x2={w} y1={h - g} y2={h - g} stroke="rgba(255,255,255,0.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {pts.length > 1 && (
            <polyline
              points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* Dots as HTML so they stay round despite the stretched viewBox. */}
        {pts.map((p, i) => (
          <span
            key={i}
            title={`${points[i].label}: ${points[i].value}`}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: scoreColor(points[i].value),
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 8px rgba(139,92,246,0.6)',
            }}
          />
        ))}
      </div>
      <div className="progress-line-labels">
        <span>{points[0].label}</span>
        {points.length > 1 && <span>{points[points.length - 1].label}</span>}
      </div>
    </div>
  )
}
