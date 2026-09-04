import type { ReferenceMove } from '../reference/types'
import { buildPose } from '../reference/builder'
import { sampleSpec, timeToCount } from '../reference/sampler'
import type { LimbSpec, PoseSpec } from '../reference/types'
import { JOINTS, type JointMap, type PoseFrame, type PoseSource } from './types'

/**
 * Demo mode: a simulated dancer that follows the reference choreography with
 * realistic human imperfection — reaction lag, per-limb biases (arms a bit
 * low, knees not bent enough…), wandering noise, and occasional short
 * "mistake" windows.
 *
 * It emits ordinary PoseFrames, so the ENTIRE analysis pipeline downstream
 * (normalization → features → comparison → feedback → report) runs exactly
 * as it does with real camera input. Only the pixels are synthetic; nothing
 * about the coaching is special-cased for demo mode.
 */

const DEMO_ASPECT = 16 / 9

/** Deterministic-ish smooth noise: sum of incommensurate sines. */
function wander(t: number, seed: number, amp: number, speed = 1): number {
  return (
    amp *
    0.6 *
    (Math.sin(t * 0.9 * speed + seed * 1.7) +
      0.6 * Math.sin(t * 2.3 * speed + seed * 3.1) +
      0.35 * Math.sin(t * 4.1 * speed + seed * 5.3))
  )
}

interface Profile {
  lagBase: number
  lagWobble: number
  armLowBias: number
  elbowStraightBias: number
  kneeStraightBias: number
  noiseDeg: number
  seed: number
}

function randomProfile(): Profile {
  const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
  return {
    lagBase: r(0.12, 0.3),
    lagWobble: r(0.03, 0.09),
    armLowBias: r(6, 16),
    elbowStraightBias: r(4, 14),
    kneeStraightBias: r(3, 10),
    noiseDeg: r(3, 6),
    seed: Math.random() * 100,
  }
}

export class SimulatedPoseSource implements PoseSource {
  readonly kind = 'demo' as const
  private profile = randomProfile()
  private stopped = false

  constructor(private move: ReferenceMove) {}

  async start(): Promise<void> {
    // Nothing to load — keep a tick so the countdown feels the same.
    await new Promise((res) => setTimeout(res, 250))
  }

  getPose(t: number): PoseFrame | null {
    if (this.stopped) return null
    const p = this.profile
    // The dancer "improves" slightly over the session, like a real practice.
    const improve = 1 - 0.35 * Math.min(1, t / 50)
    const lag = p.lagBase * improve + p.lagWobble * Math.sin(t * 0.55 + p.seed)

    const count = timeToCount(this.move, Math.max(0, t - lag))
    const spec = sampleSpec(this.move, count)

    // A short, larger mistake window every ~9 seconds (one limb goes off).
    const mistakePhase = (t + p.seed * 3) % 9
    const inMistake = mistakePhase < 1.6
    const mistakeAmt = inMistake ? Math.sin((mistakePhase / 1.6) * Math.PI) * 22 : 0
    const mistakeLimb = Math.floor((t + p.seed * 3) / 9) % 4

    const s = p.seed
    const n = p.noiseDeg * improve
    const perturbLimb = (l: LimbSpec, k: number, upperBias: number, lowerBias: number): LimbSpec => ({
      upper: l.upper + upperBias + wander(t, s + k, n),
      lower: l.lower + lowerBias + wander(t, s + k + 10, n * 1.3),
    })

    const armBias = -p.armLowBias * improve
    const perturbed: PoseSpec = {
      leftArm: perturbLimb(spec.leftArm, 1, armBias + (mistakeLimb === 0 ? -mistakeAmt : 0), armBias - p.elbowStraightBias * 0.5),
      rightArm: perturbLimb(spec.rightArm, 2, armBias + (mistakeLimb === 1 ? -mistakeAmt : 0), armBias - p.elbowStraightBias * 0.5),
      leftLeg: perturbLimb(spec.leftLeg, 3, wander(t, s + 30, 3) + (mistakeLimb === 2 ? -mistakeAmt * 0.5 : 0), p.kneeStraightBias * 0.4),
      rightLeg: perturbLimb(spec.rightLeg, 4, wander(t, s + 40, 3) + (mistakeLimb === 3 ? -mistakeAmt * 0.5 : 0), p.kneeStraightBias * 0.4),
      torsoLean: (spec.torsoLean ?? 0) * 0.8 + wander(t, s + 50, 2.5),
      shoulderTilt: (spec.shoulderTilt ?? 0) * 0.8 + wander(t, s + 60, 2),
    }

    const pose = buildPose(perturbed)

    // Place the dancer in a virtual 16:9 frame (video-space coords).
    const scale = 0.155 // torso length as a fraction of frame height
    const cx = 0.5 + wander(t, s + 70, 0.012, 0.4)
    const cy = 0.56 + wander(t, s + 80, 0.008, 0.5)
    const joints = {} as JointMap
    for (const j of JOINTS) {
      joints[j] = {
        x: cx + (pose[j].x * scale) / DEMO_ASPECT,
        y: cy + pose[j].y * scale,
        visibility: 1,
      }
    }
    return { t, joints, aspect: DEMO_ASPECT }
  }

  stop(): void {
    this.stopped = true
  }
}
