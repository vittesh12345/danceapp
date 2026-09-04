import { useState } from 'react'
import type { ReferenceMove } from '../reference/types'
import { personalBest } from '../state/progressStore'
import { Avatar } from './Avatar'

interface Props {
  move: ReferenceMove
  onPractice: (mode: 'camera' | 'demo') => void
  onBack: () => void
}

const SPEEDS = [0.5, 0.75, 1]

/** Set at build time for hosted previews that can't access a camera. */
const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === '1'

export function LearnScreen({ move, onPractice, onBack }: Props) {
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [count, setCount] = useState(0)
  const best = personalBest(move.id)

  return (
    <div className="screen learn fade-up">
      <button className="btn ghost back" onClick={onBack}>
        ← All moves
      </button>

      <div className="learn-layout">
        <div className="learn-stage card">
          <Avatar move={move} speed={speed} playing={playing} onCount={setCount} className="learn-avatar" />
          <div className="learn-pips">
            {Array.from({ length: move.counts }, (_, i) => (
              <span key={i} className={`pip ${Math.floor(count) === i ? 'active' : ''}`}>
                {i + 1}
              </span>
            ))}
          </div>
          <div className="learn-controls">
            <button className="btn icon" onClick={() => setPlaying(!playing)}>
              {playing ? '⏸' : '▶'}
            </button>
            {SPEEDS.map((s) => (
              <button key={s} className={`btn small ${speed === s ? 'on' : ''}`} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
        </div>

        <div className="learn-info">
          <div className="move-card-title big">
            <span className="move-emoji">{move.emoji}</span>
            <h2>{move.name}</h2>
          </div>
          <div className="move-card-meta">
            <span className={`chip level-${move.level.toLowerCase()}`}>{move.level}</span>
            <span className="chip">{move.style}</span>
            <span className="chip">{move.bpm} BPM</span>
            <span className="chip">{move.counts} counts</span>
            {best !== null && <span className="chip best">PB {best}</span>}
          </div>
          <p className="learn-desc">{move.description}</p>

          <h3>Coach's key points</h3>
          <ul className="key-points">
            {move.keyPoints.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>

          <div className="learn-cta">
            {DEMO_ONLY ? (
              <>
                <button className="btn primary big" onClick={() => onPractice('demo')}>
                  ✨ Start practice — demo dancer
                </button>
                <p className="privacy-note">
                  This preview runs a simulated dancer through the full coaching pipeline. The full
                  site adds live camera tracking.
                </p>
              </>
            ) : (
              <>
                <button className="btn primary big" onClick={() => onPractice('camera')}>
                  📷 Dance it — camera on
                </button>
                <button className="btn" onClick={() => onPractice('demo')}>
                  ✨ No camera? Watch demo mode
                </button>
                <p className="privacy-note">Pose tracking runs entirely on this device. Video never leaves your browser.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
