import type { JointName, PoseFrame } from './types'
import { JOINTS } from './types'

export interface Vec {
  x: number
  y: number
}

export const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y)

export const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Interior angle at joint b (in degrees, 0..180) formed by segments b→a and b→c. */
export function interiorAngle(a: Vec, b: Vec, c: Vec): number {
  const v1 = sub(a, b)
  const v2 = sub(c, b)
  const d1 = Math.hypot(v1.x, v1.y)
  const d2 = Math.hypot(v2.x, v2.y)
  if (d1 < 1e-6 || d2 < 1e-6) return 180
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (d1 * d2)))
  return toDeg(Math.acos(cos))
}

/**
 * Body-normalized pose: joints in pose space (origin mid-hip, y down,
 * 1 unit = torso length), plus the anchor data needed to map back to pixels.
 */
export interface NormalizedPose {
  joints: Record<JointName, Vec>
  visibility: Record<JointName, number>
  /** Mid-hip in aspect-corrected video units. */
  originVideo: Vec
  /** Torso length in aspect-corrected video units (pose-space scale). */
  torsoVideo: number
}

/**
 * Convert a raw frame (mirrored video space) into pose space.
 * Returns null when the torso isn't reliably visible — comparisons would be
 * meaningless without a stable body frame of reference.
 */
export function normalizePose(frame: PoseFrame): NormalizedPose | null {
  const j = frame.joints
  const core: JointName[] = ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip']
  if (core.some((n) => j[n].visibility < 0.35)) return null

  // Aspect-correct x so distances/angles are isotropic.
  const a = frame.aspect
  const P = (n: JointName): Vec => ({ x: j[n].x * a, y: j[n].y })

  const midHip = mid(P('leftHip'), P('rightHip'))
  const midShoulder = mid(P('leftShoulder'), P('rightShoulder'))
  const torso = dist(midHip, midShoulder)
  if (torso < 0.02) return null

  const joints = {} as Record<JointName, Vec>
  const visibility = {} as Record<JointName, number>
  for (const n of JOINTS) {
    const p = P(n)
    joints[n] = { x: (p.x - midHip.x) / torso, y: (p.y - midHip.y) / torso }
    visibility[n] = j[n].visibility
  }
  return { joints, visibility, originVideo: midHip, torsoVideo: torso }
}
