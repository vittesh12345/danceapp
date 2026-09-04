import type { SessionReport } from '../analysis/session'

/**
 * Session history, persisted locally (localStorage). Storage failures are
 * swallowed — the app must work in private windows too.
 */

const KEY = 'tempo.sessions.v1'

export interface StoredSession {
  id: string
  moveId: string
  moveName: string
  date: string
  mode: 'camera' | 'demo'
  durationSec: number
  overall: number
  technique: number
  timing: number
  consistency: number
}

export function loadSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSession(report: SessionReport): void {
  const entry: StoredSession = {
    id: report.id,
    moveId: report.moveId,
    moveName: report.moveName,
    date: report.date,
    mode: report.mode,
    durationSec: report.durationSec,
    overall: report.overall,
    technique: report.technique,
    timing: report.timing,
    consistency: report.consistency,
  }
  try {
    const all = loadSessions()
    all.push(entry)
    localStorage.setItem(KEY, JSON.stringify(all.slice(-200)))
  } catch {
    // Storage unavailable — progress just won't persist.
  }
}

/** Most recent previous session for a move (for "vs last time" deltas). */
export function previousForMove(moveId: string, excludeId?: string): StoredSession | null {
  const all = loadSessions()
    .filter((s) => s.moveId === moveId && s.id !== excludeId)
    .sort((a, b) => a.date.localeCompare(b.date))
  return all.length ? all[all.length - 1] : null
}

export function personalBest(moveId: string): number | null {
  const scores = loadSessions()
    .filter((s) => s.moveId === moveId)
    .map((s) => s.overall)
  return scores.length ? Math.max(...scores) : null
}
