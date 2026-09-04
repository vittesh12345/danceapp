import { useMemo, useState } from 'react'
import { MOVES } from '../reference/moves'
import { loadSessions } from '../state/progressStore'
import { ProgressLine } from './charts'

interface Props {
  onBack: () => void
}

export function ProgressScreen({ onBack }: Props) {
  const sessions = useMemo(() => loadSessions().sort((a, b) => a.date.localeCompare(b.date)), [])
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.moveId === filter)
  const points = filtered.map((s) => ({
    label: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: s.overall,
  }))

  const totalSec = sessions.reduce((a, s) => a + s.durationSec, 0)
  const totalMin = totalSec >= 60 ? String(Math.round(totalSec / 60)) : totalSec > 0 ? '<1' : '0'
  const bests = MOVES.map((m) => {
    const ms = sessions.filter((s) => s.moveId === m.id)
    return { move: m, best: ms.length ? Math.max(...ms.map((s) => s.overall)) : null, count: ms.length }
  })

  const avgOf = (key: 'technique' | 'timing' | 'consistency') =>
    filtered.length ? Math.round(filtered.reduce((a, s) => a + s[key], 0) / filtered.length) : 0

  return (
    <div className="screen progress fade-up">
      <button className="btn ghost back" onClick={onBack}>
        ← Back
      </button>
      <h2>Your progress</h2>

      {sessions.length === 0 ? (
        <div className="card empty-state">
          <p className="big">No sessions yet 💃</p>
          <p className="muted">Dance your first move and your scores will show up here.</p>
        </div>
      ) : (
        <>
          <div className="stat-strip static">
            <span>
              <strong>{sessions.length}</strong> sessions
            </span>
            <span>
              <strong>{totalMin}</strong> min danced
            </span>
            <span>
              <strong>{avgOf('technique')}</strong> avg technique
            </span>
            <span>
              <strong>{avgOf('timing')}</strong> avg timing
            </span>
            <span>
              <strong>{avgOf('consistency')}</strong> avg consistency
            </span>
          </div>

          <div className="card">
            <div className="row spread">
              <h3>Overall score over time</h3>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="select">
                <option value="all">All moves</option>
                {MOVES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <ProgressLine points={points} />
          </div>

          <div className="card">
            <h3>Personal bests</h3>
            <div className="pb-grid">
              {bests.map(({ move, best, count }) => (
                <div key={move.id} className="pb-item">
                  <span className="move-emoji">{move.emoji}</span>
                  <div>
                    <strong>{move.name}</strong>
                    <span className="muted small">
                      {count} session{count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <span className="pb-score">{best ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
