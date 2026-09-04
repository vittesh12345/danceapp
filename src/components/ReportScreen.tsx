import type { SessionReport } from '../analysis/session'
import { previousForMove } from '../state/progressStore'
import { AccuracyBars, CountBars, Sparkline } from './charts'
import { ScoreRing } from './ScoreRing'

interface Props {
  report: SessionReport
  onAgain: () => void
  onHome: () => void
  onProgress: () => void
}

export function ReportScreen({ report, onAgain, onHome, onProgress }: Props) {
  const prev = previousForMove(report.moveId, report.id)
  const delta = prev ? report.overall - prev.overall : null

  return (
    <div className="screen report fade-up">
      <header className="report-header">
        <div>
          <h2>Session report</h2>
          <p className="muted">
            {report.moveName} · {Math.round(report.durationSec)}s · {report.mode === 'demo' ? 'demo dancer' : 'camera'}
          </p>
        </div>
        <div className="row gap">
          <button className="btn" onClick={onProgress}>
            📈 Progress
          </button>
          <button className="btn primary" onClick={onAgain}>
            ↻ Dance it again
          </button>
        </div>
      </header>

      <div className="report-grid">
        <div className="card report-score">
          <ScoreRing value={report.overall} size={150} label="OVERALL" />
          {delta !== null && (
            <p className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} vs last session
            </p>
          )}
          <div className="subscores">
            <div>
              <span className="subscore-value">{report.technique}</span>
              <span className="subscore-label">Technique</span>
            </div>
            <div>
              <span className="subscore-value">{report.timing}</span>
              <span className="subscore-label">Timing</span>
            </div>
            <div>
              <span className="subscore-value">{report.consistency}</span>
              <span className="subscore-label">Consistency</span>
            </div>
          </div>
          <p className="timing-label">⏱ {report.timingLabel}</p>
        </div>

        <div className="card">
          <h3>💪 Strongest</h3>
          <ul className="plain-list">
            {report.strengths.map((s) => (
              <li key={s} className="strength">
                {s}
              </li>
            ))}
          </ul>
          <h3>🔧 Needs work</h3>
          <ul className="plain-list">
            {report.weaknesses.map((s) => (
              <li key={s} className="weakness">
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>Body accuracy</h3>
          <AccuracyBars items={report.areaStats} />
        </div>

        <div className="card">
          <h3>Score by count</h3>
          <p className="muted small">
            Counts {report.worstCounts[0]}–{report.worstCounts[1]} need the most attention.
          </p>
          <CountBars scores={report.countScores} worst={report.worstCounts} />
        </div>

        <div className="card wide">
          <h3>Score over the session</h3>
          <Sparkline data={report.scoreTimeline} />
        </div>

        <div className="card wide coach-plan">
          <h3>🎓 Coach's practice plan</h3>
          <ol>
            {report.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="row center">
        <button className="btn ghost" onClick={onHome}>
          ← Back to all moves
        </button>
      </div>
    </div>
  )
}
