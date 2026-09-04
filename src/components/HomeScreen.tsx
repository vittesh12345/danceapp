import { MOVES } from '../reference/moves'
import type { ReferenceMove } from '../reference/types'
import { loadSessions } from '../state/progressStore'
import { Avatar } from './Avatar'

interface Props {
  onPick: (move: ReferenceMove) => void
  onProgress: () => void
}

export function HomeScreen({ onPick, onProgress }: Props) {
  const sessions = loadSessions()
  const totalSec = sessions.reduce((a, s) => a + s.durationSec, 0)
  const totalMin = totalSec >= 60 ? String(Math.round(totalSec / 60)) : totalSec > 0 ? '<1' : '0'

  return (
    <div className="screen home fade-up">
      <section className="hero">
        <h1>
          Dance with an AI coach
          <span className="hero-accent"> watching every move.</span>
        </h1>
        <p className="hero-sub">
          Pick a move, turn on your camera, and get real-time corrections on your arms, legs, posture
          and timing — like a private instructor in your browser. All tracking runs on your device;
          no video ever leaves it.
        </p>
        {sessions.length > 0 && (
          <button className="stat-strip" onClick={onProgress}>
            <span>
              <strong>{sessions.length}</strong> sessions
            </span>
            <span>
              <strong>{totalMin}</strong> min danced
            </span>
            <span>
              <strong>{Math.max(...sessions.map((s) => s.overall))}</strong> best score
            </span>
            <span className="stat-link">View progress →</span>
          </button>
        )}
      </section>

      <section className="moves-grid">
        {MOVES.map((m) => (
          <button key={m.id} className="move-card" onClick={() => onPick(m)}>
            <div className="move-card-avatar">
              <Avatar move={m} detail="mini" speed={0.8} />
            </div>
            <div className="move-card-body">
              <div className="move-card-title">
                <span className="move-emoji">{m.emoji}</span>
                <strong>{m.name}</strong>
              </div>
              <div className="move-card-meta">
                <span className={`chip level-${m.level.toLowerCase()}`}>{m.level}</span>
                <span className="chip">{m.style}</span>
                <span className="chip">{m.bpm} BPM</span>
              </div>
            </div>
            <span className="move-card-cta">Learn →</span>
          </button>
        ))}
      </section>

      <section className="how-it-works">
        <div className="how-step">
          <span className="how-num">1</span>
          <strong>Learn the move</strong>
          <p>Watch the demonstration at any speed, count by count.</p>
        </div>
        <div className="how-step">
          <span className="how-num">2</span>
          <strong>Dance on camera</strong>
          <p>Your body is tracked live — follow the ghost overlay.</p>
        </div>
        <div className="how-step">
          <span className="how-num">3</span>
          <strong>Get coached</strong>
          <p>Specific fixes as you dance, and a full report after.</p>
        </div>
      </section>
    </div>
  )
}
