import type { JointName } from '../pose/types'
import { FEATURE_KEYS, FEATURE_META, type FeatureKey, type FeatureVector } from './features'

/**
 * The coaching voice: turns feature errors into a small number of specific,
 * actionable corrections — never more than one headline and one secondary
 * cue at a time, with hysteresis so messages don't flicker, and positive
 * reinforcement when the dancer is on it.
 */

export interface FeedbackItem {
  id: string
  kind: 'fix' | 'timing' | 'good'
  text: string
  /** e.g. "18° too low" — the precise discrepancy. */
  detail?: string
  joints: JointName[]
  severity: number
}

const deg = (v: number) => `${Math.round(Math.abs(v))}°`
const cm = (v: number) => `≈${Math.max(2, Math.round(Math.abs(v) * 50 / 2) * 2)} cm`

interface Ctx {
  err: number
  ref: FeatureVector
}

type MsgBuilder = (c: Ctx) => { text: string; detail: string }

function armLine(side: 'left' | 'right'): MsgBuilder {
  return ({ err }) =>
    err < 0
      ? { text: `Lift your ${side} arm higher`, detail: `${deg(err)} too low` }
      : { text: `Lower your ${side} arm a touch`, detail: `${deg(err)} too high` }
}

function forearm(side: 'left' | 'right'): MsgBuilder {
  return ({ err }) =>
    err < 0
      ? { text: `Angle your ${side} forearm up more`, detail: `${deg(err)} low` }
      : { text: `Drop your ${side} forearm a little`, detail: `${deg(err)} high` }
}

function elbow(side: 'left' | 'right'): MsgBuilder {
  return ({ err }) =>
    err > 0
      ? { text: `Bend your ${side} elbow more`, detail: `${deg(err)} too straight` }
      : { text: `Straighten your ${side} arm a bit`, detail: `${deg(err)} over-bent` }
}

function thigh(side: 'left' | 'right'): MsgBuilder {
  return ({ err, ref }) => {
    const lifted = ref[side === 'left' ? 'leftKnee' : 'rightKnee'] < 145
    if (lifted) {
      return err < 0
        ? { text: `Lift your ${side} knee higher`, detail: `${deg(err)} short of the lift` }
        : { text: `Ease the ${side} knee lift down`, detail: `${deg(err)} past target` }
    }
    return err < 0
      ? { text: `Step your ${side} foot out wider`, detail: `${deg(err)} too far in` }
      : { text: `Bring your ${side} foot in closer`, detail: `${deg(err)} too far out` }
  }
}

function knee(side: 'left' | 'right'): MsgBuilder {
  return ({ err }) =>
    err > 0
      ? { text: `Bend your ${side} knee more — stay low`, detail: `${deg(err)} too straight` }
      : { text: `Rise up slightly — less ${side} knee bend`, detail: `${deg(err)} too deep` }
}

const BUILDERS: Record<FeatureKey, MsgBuilder> = {
  leftArmLine: armLine('left'),
  rightArmLine: armLine('right'),
  leftForearm: forearm('left'),
  rightForearm: forearm('right'),
  leftElbow: elbow('left'),
  rightElbow: elbow('right'),
  leftThigh: thigh('left'),
  rightThigh: thigh('right'),
  leftKnee: knee('left'),
  rightKnee: knee('right'),
  torsoLean: ({ err, ref }) => {
    if (Math.abs(ref.torsoLean) < 3) {
      return { text: 'Straighten up — torso vertical', detail: `leaning ${deg(err)} ${err > 0 ? 'right' : 'left'}` }
    }
    return err < 0
      ? { text: 'Lean your torso more to the right', detail: `${deg(err)} short` }
      : { text: 'Lean your torso more to the left', detail: `${deg(err)} short` }
  },
  shoulderTilt: ({ err, ref }) => {
    if (Math.abs(ref.shoulderTilt) < 4) {
      return { text: 'Keep your shoulders level', detail: `${deg(err)} off level` }
    }
    return err < 0
      ? { text: 'Lift your right shoulder into the tilt', detail: `${deg(err)} short` }
      : { text: 'Lift your left shoulder into the tilt', detail: `${deg(err)} short` }
  },
  stanceWidth: ({ err }) =>
    err < 0
      ? { text: 'Widen your stance', detail: `feet ${cm(err)} too close` }
      : { text: 'Bring your feet closer together', detail: `${cm(err)} too wide` },
  hipSway: ({ err }) =>
    err < 0
      ? { text: 'Shift your weight to the right', detail: `hips ${cm(err)} off` }
      : { text: 'Shift your weight to the left', detail: `hips ${cm(err)} off` },
}

const PRAISE = [
  'Nice! Keep it flowing',
  'Great shape — hold that energy',
  'Right in the pocket 🔥',
  'Clean! Stay with the beat',
  "That's it — looking sharp",
]

const HEADLINE_HOLD_S = 2.6
const RESOLVE_COOLDOWN_S = 5
const PRAISE_GAP_S = 5
const PRAISE_HOLD_S = 2.2

export class FeedbackEngine {
  private headline: FeedbackItem | null = null
  private headlineAt = 0
  private cooldownUntil = new Map<string, number>()
  private lastPraiseAt = -PRAISE_GAP_S
  private praiseIdx = 0

  /**
   * @param errs   smoothed feature errors (user − reference)
   * @param ref    reference feature vector (for phrasing direction)
   * @param we     overall weighted error (0 good)
   * @param timingOffset seconds, + = late
   * @param focus  per-move feature emphasis
   */
  update(
    t: number,
    errs: FeatureVector,
    ref: FeatureVector,
    we: number,
    timingOffset: number,
    focus?: Partial<Record<FeatureKey, number>>,
  ): FeedbackItem[] {
    // Raw severity for every possible correction (no threshold) — used both
    // to pick new messages and to decide when a shown one is "resolved".
    const items = new Map<string, FeedbackItem>()
    for (const k of FEATURE_KEYS) {
      const meta = FEATURE_META[k]
      const sev = (Math.abs(errs[k]) / meta.tolerance) * (focus?.[k] ?? 1) * meta.weight
      const { text, detail } = BUILDERS[k]({ err: errs[k], ref })
      items.set(k, { id: k, kind: 'fix', text, detail, joints: meta.joints, severity: sev })
    }
    if (Math.abs(timingOffset) >= 0.12) {
      const late = timingOffset > 0
      items.set('timing', {
        id: 'timing',
        kind: 'timing',
        text: late ? 'You’re behind the beat — anticipate the next move' : 'You’re ahead of the beat — let the music catch up',
        detail: `≈${Math.abs(timingOffset).toFixed(1)} s ${late ? 'late' : 'early'}`,
        joints: [],
        severity: (Math.abs(timingOffset) / 0.16) * 0.9,
      })
    }

    // New messages must clear the full threshold.
    const candidates = [...items.values()].filter((c) => c.severity >= 0.85).sort((a, b) => b.severity - a.severity)

    if (this.headline && this.headline.kind !== 'good') {
      const live = items.get(this.headline.id)
      const fresh = t - this.headlineAt < HEADLINE_HOLD_S
      // Hysteresis: a shown correction stays up while its error remains
      // meaningful (60% of threshold) or its minimum hold time runs.
      if (live && (fresh || live.severity >= 0.55)) {
        this.headline = { ...live, severity: Math.max(live.severity, 0.01) }
      } else {
        this.cooldownUntil.set(this.headline.id, t + RESOLVE_COOLDOWN_S)
        this.headline = null
      }
    } else if (this.headline?.kind === 'good' && t - this.headlineAt > PRAISE_HOLD_S) {
      this.headline = null
    }

    if (!this.headline) {
      const next = candidates.find((c) => (this.cooldownUntil.get(c.id) ?? 0) <= t)
      if (next) {
        this.headline = next
        this.headlineAt = t
      } else if (we < 0.55 && t - this.lastPraiseAt >= PRAISE_GAP_S) {
        this.headline = {
          id: `praise-${this.praiseIdx}`,
          kind: 'good',
          text: PRAISE[this.praiseIdx % PRAISE.length],
          joints: [],
          severity: 0,
        }
        this.headlineAt = t
        this.lastPraiseAt = t
        this.praiseIdx++
      }
    }

    const out: FeedbackItem[] = []
    if (this.headline) out.push(this.headline)
    const secondary = candidates.find((c) => c.id !== this.headline?.id && c.severity >= 1.1)
    if (secondary && this.headline && this.headline.kind !== 'good') out.push(secondary)
    return out
  }

  reset() {
    this.headline = null
    this.cooldownUntil.clear()
    this.lastPraiseAt = -PRAISE_GAP_S
  }
}
