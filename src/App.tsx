import { useCallback, useState } from 'react'
import type { SessionReport } from './analysis/session'
import { HomeScreen } from './components/HomeScreen'
import { LearnScreen } from './components/LearnScreen'
import { PracticeScreen } from './components/PracticeScreen'
import { ProgressScreen } from './components/ProgressScreen'
import { ReportScreen } from './components/ReportScreen'
import { getMove } from './reference/moves'
import type { ReferenceMove } from './reference/types'
import { saveSession } from './state/progressStore'

type View =
  | { name: 'home' }
  | { name: 'learn'; moveId: string }
  | { name: 'practice'; moveId: string; mode: 'camera' | 'demo' }
  | { name: 'report'; report: SessionReport }
  | { name: 'progress' }

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [notice, setNotice] = useState<string>('')

  const handleFinish = useCallback((moveId: string) => {
    return (report: SessionReport | null) => {
      if (report) {
        saveSession(report)
        setNotice('')
        setView({ name: 'report', report })
      } else {
        setNotice('That was too short to score — dance at least a couple of loops in frame.')
        setView({ name: 'learn', moveId })
      }
    }
  }, [])

  const pick = (m: ReferenceMove) => {
    setNotice('')
    setView({ name: 'learn', moveId: m.id })
  }

  const inPractice = view.name === 'practice'

  return (
    <div className={`app ${inPractice ? 'app-practice' : ''}`}>
      {!inPractice && (
        <header className="app-header">
          <button className="logo" onClick={() => setView({ name: 'home' })}>
            <span className="logo-mark">◉</span> Tempo
          </button>
          <nav>
            <button
              className={`nav-link ${view.name === 'home' || view.name === 'learn' ? 'active' : ''}`}
              onClick={() => setView({ name: 'home' })}
            >
              Moves
            </button>
            <button
              className={`nav-link ${view.name === 'progress' ? 'active' : ''}`}
              onClick={() => setView({ name: 'progress' })}
            >
              Progress
            </button>
          </nav>
        </header>
      )}

      {notice && view.name === 'learn' && (
        <div className="notice" onClick={() => setNotice('')}>
          {notice}
        </div>
      )}

      {view.name === 'home' && <HomeScreen onPick={pick} onProgress={() => setView({ name: 'progress' })} />}

      {view.name === 'learn' && (
        <LearnScreen
          move={getMove(view.moveId)}
          onBack={() => setView({ name: 'home' })}
          onPractice={(mode) => setView({ name: 'practice', moveId: view.moveId, mode })}
        />
      )}

      {view.name === 'practice' && (
        <PracticeScreen
          move={getMove(view.moveId)}
          mode={view.mode}
          onFinish={handleFinish(view.moveId)}
          onExit={() => setView({ name: 'learn', moveId: view.moveId })}
        />
      )}

      {view.name === 'report' && (
        <ReportScreen
          report={view.report}
          onAgain={() => setView({ name: 'practice', moveId: view.report.moveId, mode: view.report.mode })}
          onHome={() => setView({ name: 'home' })}
          onProgress={() => setView({ name: 'progress' })}
        />
      )}

      {view.name === 'progress' && <ProgressScreen onBack={() => setView({ name: 'home' })} />}
    </div>
  )
}
