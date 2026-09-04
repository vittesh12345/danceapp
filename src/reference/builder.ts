import type { JointName } from '../pose/types'
import type { Vec } from '../pose/geometry'
import type { PoseSpec } from './types'

/**
 * Forward kinematics: turn a joint-angle PoseSpec into a full pose in pose
 * space (origin mid-hip, y down, 1 unit = torso length). Body proportions
 * approximate an adult in torso units.
 */

const HALF_HIP = 0.22
const HALF_SHOULDER = 0.36
const UPPER_ARM = 0.58
const FOREARM = 0.52
const THIGH = 0.86
const SHIN = 0.82
const NECK = 0.34

const rad = (d: number) => (d * Math.PI) / 180

/** Rotate v by deg (positive tips an "up" vector toward +x in y-down space). */
function rot(v: Vec, deg: number): Vec {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
}

/** Direction for a limb angle: 0 = down, positive = outward for that side. */
function limbDir(deg: number, side: 'left' | 'right'): Vec {
  const s = Math.sin(rad(deg))
  const c = Math.cos(rad(deg))
  return side === 'left' ? { x: -s, y: c } : { x: s, y: c }
}

const add = (a: Vec, b: Vec, k = 1): Vec => ({ x: a.x + b.x * k, y: a.y + b.y * k })

export function buildPose(spec: PoseSpec): Record<JointName, Vec> {
  const lean = spec.torsoLean ?? 0
  const tilt = spec.shoulderTilt ?? 0

  const midHip: Vec = { x: 0, y: 0 }
  const leftHip: Vec = { x: -HALF_HIP, y: 0 }
  const rightHip: Vec = { x: HALF_HIP, y: 0 }

  const torsoUp = rot({ x: 0, y: -1 }, lean)
  const midShoulder = add(midHip, torsoUp)
  const shoulderDir = rot(rot({ x: 1, y: 0 }, lean), -tilt)
  const leftShoulder = add(midShoulder, shoulderDir, -HALF_SHOULDER)
  const rightShoulder = add(midShoulder, shoulderDir, HALF_SHOULDER)
  const nose = add(midShoulder, torsoUp, NECK)

  // Arms are authored relative to the torso, so they follow a lean.
  const armDir = (deg: number, side: 'left' | 'right') => rot(limbDir(deg, side), lean)
  const leftElbow = add(leftShoulder, armDir(spec.leftArm.upper, 'left'), UPPER_ARM)
  const leftWrist = add(leftElbow, armDir(spec.leftArm.lower, 'left'), FOREARM)
  const rightElbow = add(rightShoulder, armDir(spec.rightArm.upper, 'right'), UPPER_ARM)
  const rightWrist = add(rightElbow, armDir(spec.rightArm.lower, 'right'), FOREARM)

  // Legs are authored against gravity (the dancer stays grounded in a lean).
  const leftKnee = add(leftHip, limbDir(spec.leftLeg.upper, 'left'), THIGH)
  const leftAnkle = add(leftKnee, limbDir(spec.leftLeg.lower, 'left'), SHIN)
  const rightKnee = add(rightHip, limbDir(spec.rightLeg.upper, 'right'), THIGH)
  const rightAnkle = add(rightKnee, limbDir(spec.rightLeg.lower, 'right'), SHIN)

  return {
    nose,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
  }
}
