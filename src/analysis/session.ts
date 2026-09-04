import type { JointName, PoseFrame } from '../pose/types'
import { JOINTS } from '../pose/types'
import type { Vec } from '../pose/geometry'
import { normalizePose, type NormalizedPose } from '../pose/geometry'
import type { ReferenceMove } from '../reference/types'
import { beatsPerSecond, sampleFeatures, samplePose, timeToCount, wrapCount } from '../reference/sampler'
import {
  AREA_LABELS,
  FEATURE_KEYS,
  FEATURE_META,
  computeFeatures,
  featureErrors,
  frameScore,
  weightedError,
  type FeatureKey,
  type FeatureVector,
} from './features'
import { FeedbackEngine, type FeedbackItem } from './feedback'
import { TimingEstimator } from './timing'

/**
 * CoachSession wires the whole analysis pipeline together for one practice:
 * pose frames in → live coaching state out, and a full report at the end.
 * It is UI-free and source-agnostic (camera or simulated frames).
 */

export interface LiveState {
  tracking: boolean
  /** Smoothed 0–100 live score. */
  score: number
  /** Current count within the loop, 0-based fractional. */
  count: number
  loop: number
  feedback: FeedbackItem[]
  /** Reference pose for "now" (pose space) — the ghost overlay target. */
  refPose: Record<JointName, Vec>
  /** User pose, normalized, with anchors for drawing. Null when not tracking. */
  user: NormalizedPose | null
  /** 0..1 per joint — how far off-position each joint currently is. */
  jointErr: Partial<Record<JointName, number>>
  /** Timing offset in seconds (+ = late). */
  offsetSec: number
}

export interface AreaStat {
  area: string
  label: string
  accuracy: number
}

export interface SessionReport {
  id: string
  moveId: string
  moveName: string
  date: string
  mode: 'camera' | 'demo'
  durationSec: number
  loops: number
  overall: number
  technique: number
  timing: number
  consistency: number
  areaStats: AreaStat[]
  strengths: string[]
  weaknesses: string[]
  /** Mean score per count of the loop (index 0 = count "1"). */
  countScores: number[]
  /** 1-based inclusive count range that needs the most work. */
  worstCounts: [number, number]
  meanOffsetSec: number
  timingLabel: string
  scoreTimeline: number[]
  tips: string[]
}

const EMA_HALFLIFE_S = 0.45
const TIMING_PERIOD_S = 1.5

export class CoachSession {
  private timing = new TimingEstimator()
  private feedbackEngine = new FeedbackEngine()
  private emaErrs: FeatureVector | null = null
  private emaScore = 70
  private lastT = 0
  private lastTimingAt = 0
  private startedTracking = false

  // Accumulators for the report.
  private featAbsSum = {} as Record<FeatureKey, number>
  private featN = 0
  private frameScores: number[] = []
  private countScoreSum: number[]
  private countScoreN: number[]
  private offsets: number[] = []
  private timeline: { t: number; score: number }[] = []
  private trackedSec = 0

  constructor(
    private move: ReferenceMove,
    private mode: 'camera' | 'demo',
  ) {
    for (const k of FEATURE_KEYS) this.featAbsSum[k] = 0
    this.countScoreSum = new Array(move.counts).fill(0)
    this.countScoreN = new Array(move.counts).fill(0)
  }

  update(t: number, frame: PoseFrame | null): LiveState {
    const dt = Math.max(0.001, Math.min(0.2, t - this.lastT))
    this.lastT = t
    const countNow = timeToCount(this.move, t)
    const refPoseNow = samplePose(this.move, countNow)
    const loop = Math.floor(countNow / this.move.counts)

    const user = frame ? normalizePose(frame) : null
    if (!user) {
      return {
        tracking: false,
        score: this.emaScore,
        count: wrapCount(countNow, this.move.counts),
        loop,
        feedback: [],
        refPose: refPoseNow,
        user: null,
        jointErr: {},
        offsetSec: this.timing.offset,
      }
    }

    this.startedTracking = true
    this.trackedSec += dt
    const userFeat = computeFeatures(user.joints)
    this.timing.add(t, userFeat)
    if (t - this.lastTimingAt >= TIMING_PERIOD_S) {
      this.lastTimingAt = t
      this.timing.estimate(this.move)
    }
    const offset = this.timing.offset

    // Technique is scored at the timing-compensated phase so lateness isn't
    // double-counted as bad form.
    const techCount = timeToCount(this.move, t - offset)
    const refFeat = sampleFeatures(this.move, techCount)
    const errs = featureErrors(userFeat, refFeat)

    // Exponential smoothing of errors (dt-aware).
    const alpha = 1 - Math.pow(0.5, dt / EMA_HALFLIFE_S)
    if (!this.emaErrs) {
      this.emaErrs = { ...errs }
    } else {
      for (const k of FEATURE_KEYS) this.emaErrs[k] += (errs[k] - this.emaErrs[k]) * alpha
    }

    const we = weightedError(this.emaErrs, this.move.focus)
    const score = frameScore(we)
    this.emaScore += (score - this.emaScore) * alpha

    // Accumulate stats (errors clipped so brief blow-ups don't dominate).
    for (const k of FEATURE_KEYS) {
      this.featAbsSum[k] += Math.min(Math.abs(errs[k]), 3.5 * FEATURE_META[k].tolerance) * dt
    }
    this.featN += dt
    this.frameScores.push(score)
    const bucket = Math.floor(wrapCount(techCount, this.move.counts))
    this.countScoreSum[bucket] += score
    this.countScoreN[bucket] += 1
    this.offsets.push(offset)
    if (!this.timeline.length || t - this.timeline[this.timeline.length - 1].t > 0.25) {
      this.timeline.push({ t, score: this.emaScore })
    }

    const feedback = this.feedbackEngine.update(t, this.emaErrs, refFeat, we, offset, this.move.focus)

    // Per-joint positional deviation vs the "now" target → overlay highlights.
    const jointErr: Partial<Record<JointName, number>> = {}
    for (const j of JOINTS) {
      const d = Math.hypot(user.joints[j].x - refPoseNow[j].x, user.joints[j].y - refPoseNow[j].y)
      const v = (d - 0.22) / 0.5
      if (v > 0.05) jointErr[j] = Math.min(1, v)
    }

    return {
      tracking: true,
      score: this.emaScore,
      count: wrapCount(countNow, this.move.counts),
      loop,
      feedback,
      refPose: refPoseNow,
      user,
      jointErr,
      offsetSec: offset,
    }
  }

  /** Seconds of successfully tracked dancing so far. */
  get trackedSeconds(): number {
    return this.trackedSec
  }

  get everTracked(): boolean {
    return this.startedTracking
  }

  finish(durationSec: number): SessionReport | null {
    if (this.trackedSec < 8 || this.featN <= 0) return null

    const technique = mean(this.frameScores)
    const sd = stddev(this.frameScores)
    const consistency = clamp(100 - sd * 1.9, 0, 100)
    const meanAbsOffset = mean(this.offsets.map(Math.abs))
    const offsetSd = stddev(this.offsets)
    const timing = clamp(100 - meanAbsOffset * 150 - offsetSd * 80, 0, 100)
    const overall = Math.round(0.55 * technique + 0.25 * timing + 0.2 * consistency)

    // Per-area accuracy from time-weighted mean errors.
    const areaAcc = new Map<string, { sum: number; w: number }>()
    for (const k of FEATURE_KEYS) {
      const meta = FEATURE_META[k]
      const meanErr = this.featAbsSum[k] / this.featN
      const acc = clamp(100 * (1 - meanErr / (3.2 * meta.tolerance)), 5, 100)
      const cur = areaAcc.get(meta.area) ?? { sum: 0, w: 0 }
      cur.sum += acc * meta.weight
      cur.w += meta.weight
      areaAcc.set(meta.area, cur)
    }
    const areaStats: AreaStat[] = [...areaAcc.entries()]
      .map(([area, { sum, w }]) => ({
        area,
        label: AREA_LABELS[area as keyof typeof AREA_LABELS],
        accuracy: Math.round(sum / w),
      }))
      .sort((a, b) => b.accuracy - a.accuracy)

    const strengths = areaStats.slice(0, 2).map((a) => a.label)
    const weaknesses = areaStats
      .slice(-2)
      .reverse()
      .map((a) => a.label)

    const countScores = this.countScoreSum.map((s, i) =>
      this.countScoreN[i] > 0 ? Math.round(s / this.countScoreN[i]) : 0,
    )
    // Worst window of two consecutive counts (wrapping).
    let worstStart = 0
    let worstVal = Infinity
    for (let i = 0; i < countScores.length; i++) {
      const v = countScores[i] + countScores[(i + 1) % countScores.length]
      if (v < worstVal) {
        worstVal = v
        worstStart = i
      }
    }
    const worstCounts: [number, number] = [worstStart + 1, ((worstStart + 1) % countScores.length) + 1]

    const timingLabel =
      timing >= 85
        ? 'Locked to the beat'
        : mean(this.offsets) > 0.12
          ? `Averaging ≈${meanAbsOffset.toFixed(1)} s behind the beat`
          : mean(this.offsets) < -0.12
            ? `Averaging ≈${meanAbsOffset.toFixed(1)} s ahead of the beat`
            : 'Timing drifts — inconsistent rather than late'

    const tips: string[] = []
    const worstArea = areaStats[areaStats.length - 1]
    if (worstArea) {
      tips.push(
        `Drill counts ${worstCounts[0]}–${worstCounts[1]} at half speed on the Learn screen, watching your ${worstArea.label.toLowerCase()}.`,
      )
    }
    if (timing < 70) {
      tips.push('Turn the metronome on and clap the rhythm through one loop before dancing it.')
    }
    if (technique < 60) {
      tips.push('Practice the move without music first — hit each key pose and hold it for a breath.')
    } else {
      tips.push('Try a full run with the ghost overlay off and see if your score holds.')
    }

    return {
      id: `s-${Date.now().toString(36)}`,
      moveId: this.move.id,
      moveName: this.move.name,
      date: new Date().toISOString(),
      mode: this.mode,
      durationSec: Math.round(durationSec),
      loops: Math.max(1, Math.round(durationSec / (this.move.counts / beatsPerSecond(this.move)))),
      overall,
      technique: Math.round(technique),
      timing: Math.round(timing),
      consistency: Math.round(consistency),
      areaStats,
      strengths,
      weaknesses,
      countScores,
      worstCounts,
      meanOffsetSec: Number(mean(this.offsets).toFixed(2)),
      timingLabel,
      scoreTimeline: downsample(
        this.timeline.map((p) => p.score),
        90,
      ),
      tips,
    }
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const stddev = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))))
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function downsample(xs: number[], n: number): number[] {
  if (xs.length <= n) return xs.map((x) => Math.round(x))
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * xs.length) / n)
    const b = Math.max(a + 1, Math.floor(((i + 1) * xs.length) / n))
    out.push(Math.round(mean(xs.slice(a, b))))
  }
  return out
}
