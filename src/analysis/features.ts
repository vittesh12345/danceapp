import type { JointName } from '../pose/types'
import type { Vec } from '../pose/geometry'
import { interiorAngle, mid, sub, toDeg } from '../pose/geometry'

/**
 * Movement features — the measurement vocabulary of the coach.
 *
 * Every pose (the user's, sampled 30–60×/s from the camera, and the
 * reference move's, sampled from its keyframes) is reduced to this same
 * feature vector by `computeFeatures`. Comparison, scoring and feedback all
 * operate on feature differences, so the reference and the user are always
 * measured with identical code.
 *
 * Angle conventions:
 * - Limb "line" angles are signed, measured from straight-down, positive =
 *   away from the body's midline (outward), negative = across the body.
 *   Arms are measured relative to the torso axis (they follow a lean);
 *   legs are measured against gravity (screen vertical).
 * - Elbow/knee are interior joint angles: 180° = straight, smaller = bent.
 * - stanceWidth / hipSway are lengths in torso units (1.0 = torso length).
 */

export const FEATURE_KEYS = [
  'leftArmLine',
  'rightArmLine',
  'leftForearm',
  'rightForearm',
  'leftElbow',
  'rightElbow',
  'leftThigh',
  'rightThigh',
  'leftKnee',
  'rightKnee',
  'torsoLean',
  'shoulderTilt',
  'stanceWidth',
  'hipSway',
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]
export type FeatureVector = Record<FeatureKey, number>

export interface FeatureMeta {
  label: string
  /** Error at which a correction starts to be worth mentioning. */
  tolerance: number
  /** Relative importance in the technique score. */
  weight: number
  /** Joints to highlight when this feature is off. */
  joints: JointName[]
  /** Body area used to aggregate the post-session report. */
  area: 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'torso' | 'stance'
  unit: 'deg' | 'len'
}

export const FEATURE_META: Record<FeatureKey, FeatureMeta> = {
  leftArmLine: { label: 'Left arm height', tolerance: 13, weight: 1.0, joints: ['leftElbow', 'leftShoulder'], area: 'leftArm', unit: 'deg' },
  rightArmLine: { label: 'Right arm height', tolerance: 13, weight: 1.0, joints: ['rightElbow', 'rightShoulder'], area: 'rightArm', unit: 'deg' },
  leftForearm: { label: 'Left forearm angle', tolerance: 20, weight: 0.5, joints: ['leftWrist'], area: 'leftArm', unit: 'deg' },
  rightForearm: { label: 'Right forearm angle', tolerance: 20, weight: 0.5, joints: ['rightWrist'], area: 'rightArm', unit: 'deg' },
  leftElbow: { label: 'Left elbow bend', tolerance: 16, weight: 0.7, joints: ['leftElbow'], area: 'leftArm', unit: 'deg' },
  rightElbow: { label: 'Right elbow bend', tolerance: 16, weight: 0.7, joints: ['rightElbow'], area: 'rightArm', unit: 'deg' },
  leftThigh: { label: 'Left leg position', tolerance: 11, weight: 1.0, joints: ['leftKnee'], area: 'leftLeg', unit: 'deg' },
  rightThigh: { label: 'Right leg position', tolerance: 11, weight: 1.0, joints: ['rightKnee'], area: 'rightLeg', unit: 'deg' },
  leftKnee: { label: 'Left knee bend', tolerance: 13, weight: 0.7, joints: ['leftKnee'], area: 'leftLeg', unit: 'deg' },
  rightKnee: { label: 'Right knee bend', tolerance: 13, weight: 0.7, joints: ['rightKnee'], area: 'rightLeg', unit: 'deg' },
  torsoLean: { label: 'Torso lean', tolerance: 8, weight: 0.8, joints: ['leftShoulder', 'rightShoulder'], area: 'torso', unit: 'deg' },
  shoulderTilt: { label: 'Shoulder level', tolerance: 8, weight: 0.5, joints: ['leftShoulder', 'rightShoulder'], area: 'torso', unit: 'deg' },
  stanceWidth: { label: 'Stance width', tolerance: 0.24, weight: 0.7, joints: ['leftAnkle', 'rightAnkle'], area: 'stance', unit: 'len' },
  hipSway: { label: 'Weight shift', tolerance: 0.17, weight: 0.6, joints: ['leftHip', 'rightHip'], area: 'stance', unit: 'len' },
}

export const AREA_LABELS: Record<FeatureMeta['area'], string> = {
  leftArm: 'Left arm',
  rightArm: 'Right arm',
  leftLeg: 'Left leg',
  rightLeg: 'Right leg',
  torso: 'Torso & shoulders',
  stance: 'Stance & weight',
}

/** Signed angle (deg) from direction `from` to vector `v` (y-down space). */
function signedAngle(from: Vec, v: Vec): number {
  const cross = from.x * v.y - from.y * v.x
  const dot = from.x * v.x + from.y * v.y
  return toDeg(Math.atan2(cross, dot))
}

function norm(v: Vec): Vec {
  const d = Math.hypot(v.x, v.y) || 1
  return { x: v.x / d, y: v.y / d }
}

/**
 * Reduce a pose (joints in pose space) to the feature vector.
 * This is THE shared measurement function — used for camera poses,
 * simulated poses and reference poses alike.
 */
export function computeFeatures(j: Record<JointName, Vec>): FeatureVector {
  const midShoulder = mid(j.leftShoulder, j.rightShoulder)
  const midHip = mid(j.leftHip, j.rightHip)
  const torsoDown = norm(sub(midHip, midShoulder))
  const worldDown: Vec = { x: 0, y: 1 }

  // Signed limb angle: positive = outward from the midline for that side.
  const limb = (root: Vec, end: Vec, ref: Vec, side: 'left' | 'right') => {
    const raw = signedAngle(ref, sub(end, root))
    return side === 'left' ? raw : -raw
  }

  const shoulderVec = sub(j.rightShoulder, j.leftShoulder)
  const torsoUp = sub(midShoulder, midHip)
  const ankleMid = mid(j.leftAnkle, j.rightAnkle)

  return {
    leftArmLine: limb(j.leftShoulder, j.leftElbow, torsoDown, 'left'),
    rightArmLine: limb(j.rightShoulder, j.rightElbow, torsoDown, 'right'),
    leftForearm: limb(j.leftElbow, j.leftWrist, torsoDown, 'left'),
    rightForearm: limb(j.rightElbow, j.rightWrist, torsoDown, 'right'),
    leftElbow: interiorAngle(j.leftShoulder, j.leftElbow, j.leftWrist),
    rightElbow: interiorAngle(j.rightShoulder, j.rightElbow, j.rightWrist),
    leftThigh: limb(j.leftHip, j.leftKnee, worldDown, 'left'),
    rightThigh: limb(j.rightHip, j.rightKnee, worldDown, 'right'),
    leftKnee: interiorAngle(j.leftHip, j.leftKnee, j.leftAnkle),
    rightKnee: interiorAngle(j.rightHip, j.rightKnee, j.rightAnkle),
    torsoLean: signedAngle({ x: 0, y: -1 }, torsoUp),
    shoulderTilt: -toDeg(Math.atan2(shoulderVec.y, shoulderVec.x)),
    stanceWidth: Math.abs(j.rightAnkle.x - j.leftAnkle.x),
    hipSway: midHip.x - ankleMid.x,
  }
}

/** Per-feature signed error (user − reference). */
export function featureErrors(user: FeatureVector, ref: FeatureVector): FeatureVector {
  const out = {} as FeatureVector
  for (const k of FEATURE_KEYS) out[k] = user[k] - ref[k]
  return out
}

/**
 * Weighted mean of |error|/tolerance across features — 0 is perfect, 1 means
 * "on average every feature sits right at its tolerance". Optional per-move
 * focus multipliers let a move emphasise what matters for it.
 */
export function weightedError(
  errs: FeatureVector,
  focus?: Partial<Record<FeatureKey, number>>,
): number {
  let sum = 0
  let wSum = 0
  for (const k of FEATURE_KEYS) {
    const m = FEATURE_META[k]
    const w = m.weight * (focus?.[k] ?? 1)
    sum += w * Math.min(Math.abs(errs[k]) / m.tolerance, 3)
    wSum += w
  }
  return wSum > 0 ? sum / wSum : 0
}

/** Map a weighted error to a 0–100 frame score. */
export function frameScore(we: number): number {
  // we = 0 → 100; we = 1 (everything at tolerance) → ~61; we = 2 → ~18.
  const s = 100 * Math.exp(-0.35 * we * we - 0.15 * we)
  return Math.max(4, Math.min(100, s))
}
