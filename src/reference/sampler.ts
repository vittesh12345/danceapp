import type { JointName } from '../pose/types'
import type { Vec } from '../pose/geometry'
import { computeFeatures, type FeatureVector } from '../analysis/features'
import { buildPose } from './builder'
import type { Keyframe, LimbSpec, PoseSpec, ReferenceMove } from './types'

/**
 * Samples a reference move at any (fractional, wrapping) count position by
 * interpolating between keyframes with an ease that "hits" each keyframe —
 * approximating how dancers accent beats rather than drifting linearly.
 */

/** Smoothstep ease-in-out. */
const ease = (u: number) => u * u * (3 - 2 * u)

const lerp = (a: number, b: number, u: number) => a + (b - a) * u

function lerpLimb(a: LimbSpec, b: LimbSpec, u: number): LimbSpec {
  return { upper: lerp(a.upper, b.upper, u), lower: lerp(a.lower, b.lower, u) }
}

function lerpSpec(a: PoseSpec, b: PoseSpec, u: number): PoseSpec {
  return {
    leftArm: lerpLimb(a.leftArm, b.leftArm, u),
    rightArm: lerpLimb(a.rightArm, b.rightArm, u),
    leftLeg: lerpLimb(a.leftLeg, b.leftLeg, u),
    rightLeg: lerpLimb(a.rightLeg, b.rightLeg, u),
    torsoLean: lerp(a.torsoLean ?? 0, b.torsoLean ?? 0, u),
    shoulderTilt: lerp(a.shoulderTilt ?? 0, b.shoulderTilt ?? 0, u),
  }
}

/** Wrap a count into [0, counts). */
export function wrapCount(c: number, counts: number): number {
  return ((c % counts) + counts) % counts
}

/** Interpolated PoseSpec at count position c (wraps around the loop). */
export function sampleSpec(move: ReferenceMove, c: number): PoseSpec {
  const kfs = move.keyframes
  const cc = wrapCount(c, move.counts)
  // Keyframes are sorted by count. Find the segment containing cc.
  let prev: Keyframe = kfs[kfs.length - 1]
  let next: Keyframe = kfs[0]
  let prevC = prev.c - move.counts // wrapped behind
  let nextC = next.c
  for (let i = 0; i < kfs.length; i++) {
    if (kfs[i].c <= cc) {
      prev = kfs[i]
      prevC = kfs[i].c
      next = kfs[(i + 1) % kfs.length]
      nextC = i + 1 < kfs.length ? next.c : next.c + move.counts
    }
  }
  const span = nextC - prevC
  const u = span <= 1e-6 ? 0 : ease((cc - prevC) / span)
  return lerpSpec(prev.pose, next.pose, u)
}

/** Full reference pose (pose space) at count c. */
export function samplePose(move: ReferenceMove, c: number): Record<JointName, Vec> {
  return buildPose(sampleSpec(move, c))
}

/** Reference feature vector at count c — measured with the shared code path. */
export function sampleFeatures(move: ReferenceMove, c: number): FeatureVector {
  return computeFeatures(samplePose(move, c))
}

/** Beats per second for a move. */
export const beatsPerSecond = (move: ReferenceMove) => move.bpm / 60

/** Convert session time (s) to count position. */
export const timeToCount = (move: ReferenceMove, t: number) => t * beatsPerSecond(move)

/** Duration of one full loop in seconds. */
export const loopSeconds = (move: ReferenceMove) => move.counts / beatsPerSecond(move)
