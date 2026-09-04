import type { FeatureKey } from '../analysis/features'

/**
 * Reference moves are authored as joint-angle keyframes on musical counts.
 * A tiny forward-kinematics model (see builder.ts) turns each keyframe into
 * a full-body pose in the same normalized space user poses are mapped into,
 * so reference and user are directly comparable.
 *
 * This is deliberately the SAME format a future "record a reference from an
 * instructor video" pipeline would produce: run pose estimation on the
 * instructor footage, convert to features per beat, keyframe them. Nothing
 * downstream (comparison, feedback, rendering) would change.
 */

export interface LimbSpec {
  /** Upper segment direction in degrees: 0 = straight down, + = outward. */
  upper: number
  /** Lower segment direction, same convention (absolute, not relative). */
  lower: number
}

export interface PoseSpec {
  leftArm: LimbSpec
  rightArm: LimbSpec
  leftLeg: LimbSpec
  rightLeg: LimbSpec
  /** Torso lean in degrees, + = toward the user's right. */
  torsoLean?: number
  /** Shoulder line tilt in degrees, + = right shoulder higher. */
  shoulderTilt?: number
}

export interface Keyframe {
  /** Beat position within the loop, 0-based (0 = count "1"). May be fractional. */
  c: number
  pose: PoseSpec
}

export interface ReferenceMove {
  id: string
  name: string
  style: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  bpm: number
  /** Counts per loop (usually 8). */
  counts: number
  /** Loops in a standard practice session. */
  defaultLoops: number
  emoji: string
  description: string
  /** Short coaching cues shown on the Learn screen. */
  keyPoints: string[]
  /** Per-feature importance multipliers for this move. */
  focus?: Partial<Record<FeatureKey, number>>
  keyframes: Keyframe[]
}
