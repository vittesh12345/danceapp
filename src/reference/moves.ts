import type { Keyframe, LimbSpec, PoseSpec, ReferenceMove } from './types'

/**
 * The built-in move library. Moves are authored as joint-angle keyframes on
 * musical counts — realistic demo data hand-tuned to read as actual dance
 * movement. Adding a move = adding one object here; everything else
 * (rendering, comparison, feedback, reports) picks it up automatically.
 */

const limb = (upper: number, lower: number): LimbSpec => ({ upper, lower })

/** Swap sides and flip signed torso params — for authoring mirrored beats. */
function mirror(p: PoseSpec): PoseSpec {
  return {
    leftArm: { ...p.rightArm },
    rightArm: { ...p.leftArm },
    leftLeg: { ...p.rightLeg },
    rightLeg: { ...p.leftLeg },
    torsoLean: -(p.torsoLean ?? 0),
    shoulderTilt: -(p.shoulderTilt ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Step Touch — the easiest on-ramp: step out, touch together, arms swing.
// ---------------------------------------------------------------------------

const stStepRight: PoseSpec = {
  leftArm: limb(-18, -30),
  rightArm: limb(30, 45),
  leftLeg: limb(16, 12),
  rightLeg: limb(2, 2),
  torsoLean: 4,
  shoulderTilt: -2,
}
const stTouch: PoseSpec = {
  leftArm: limb(10, 18),
  rightArm: limb(10, 18),
  leftLeg: limb(6, -4),
  rightLeg: limb(6, -4),
  torsoLean: 0,
  shoulderTilt: 0,
}
const stepTouch: ReferenceMove = {
  id: 'step-touch',
  name: 'Step Touch',
  style: 'Warm-up · Pop',
  level: 'Beginner',
  bpm: 100,
  counts: 8,
  defaultLoops: 8,
  emoji: '🕺',
  description:
    'The foundation of almost every choreography: step out to the side, touch your feet together, and let your arms swing with the motion. Great for locking in timing.',
  keyPoints: [
    'Step wide on the beat, touch together on the next',
    'Shift your weight fully over the stepping leg',
    'Let both arms swing toward the stepping side',
    'Keep knees soft — small bounce on every touch',
  ],
  focus: { hipSway: 1.4, stanceWidth: 1.3, leftArmLine: 1.1, rightArmLine: 1.1 },
  keyframes: [
    { c: 0, pose: stStepRight },
    { c: 1, pose: stTouch },
    { c: 2, pose: mirror(stStepRight) },
    { c: 3, pose: mirror(stTouch) },
    { c: 4, pose: stStepRight },
    { c: 5, pose: stTouch },
    { c: 6, pose: mirror(stStepRight) },
    { c: 7, pose: mirror(stTouch) },
  ],
}

// ---------------------------------------------------------------------------
// Groove Bounce — the hero move. Bounce groove with chest pumps, opening
// into a side lean + arm extension on counts 3–4 and 7–8.
// ---------------------------------------------------------------------------

const gbLegsDown = { leftLeg: limb(9, -8), rightLeg: limb(9, -8) }
const gbLegsUp = { leftLeg: limb(4, -2), rightLeg: limb(4, -2) }
const gbPumpUpArms = { leftArm: limb(12, 150), rightArm: limb(12, 150) }
const gbPumpDownArms = { leftArm: limb(15, 55), rightArm: limb(15, 55) }

const gbPumpDown: PoseSpec = { ...gbPumpDownArms, ...gbLegsDown, torsoLean: 0, shoulderTilt: 0 }
const gbPumpUp: PoseSpec = { ...gbPumpUpArms, ...gbLegsUp, torsoLean: 0, shoulderTilt: 0 }

const gbLeanR1: PoseSpec = {
  leftArm: limb(12, 140),
  rightArm: limb(70, 60),
  leftLeg: limb(14, 10),
  rightLeg: limb(4, -4),
  torsoLean: 10,
  shoulderTilt: -6,
}
const gbLeanR1Up: PoseSpec = { ...gbLeanR1, rightArm: limb(76, 70), leftLeg: limb(13, 11), rightLeg: limb(2, 0) }
const gbLeanR2: PoseSpec = { ...gbLeanR1, rightArm: limb(85, 85), torsoLean: 12, leftLeg: limb(15, 11), rightLeg: limb(5, -5) }
const gbLeanR2Up: PoseSpec = { ...gbLeanR2, rightArm: limb(80, 78), rightLeg: limb(2, 0), torsoLean: 8 }

const grooveBounce: ReferenceMove = {
  id: 'groove-bounce',
  name: 'Groove Bounce',
  style: 'Hip-Hop',
  level: 'Beginner',
  bpm: 96,
  counts: 8,
  defaultLoops: 8,
  emoji: '🎧',
  description:
    'The core hip-hop groove: a steady knee bounce with chest-level arm pumps, opening into a side lean with an arm extension on counts 3–4 and 7–8. Master this and every hip-hop class gets easier.',
  keyPoints: [
    'Bounce DOWN on every beat — the groove lives in your knees',
    'Pump fists up to your chest on the off-beats',
    'On counts 3–4, lean right and extend your right arm long',
    'On counts 7–8, mirror it to the left',
    'Stay low — coming up too tall kills the groove',
  ],
  focus: {
    leftKnee: 1.3,
    rightKnee: 1.3,
    leftElbow: 1.2,
    rightElbow: 1.2,
    leftArmLine: 1.2,
    rightArmLine: 1.2,
  },
  keyframes: [
    { c: 0, pose: gbPumpDown },
    { c: 0.5, pose: gbPumpUp },
    { c: 1, pose: gbPumpDown },
    { c: 1.5, pose: gbPumpUp },
    { c: 2, pose: gbLeanR1 },
    { c: 2.5, pose: gbLeanR1Up },
    { c: 3, pose: gbLeanR2 },
    { c: 3.5, pose: gbLeanR2Up },
    { c: 4, pose: gbPumpDown },
    { c: 4.5, pose: gbPumpUp },
    { c: 5, pose: gbPumpDown },
    { c: 5.5, pose: gbPumpUp },
    { c: 6, pose: mirror(gbLeanR1) },
    { c: 6.5, pose: mirror(gbLeanR1Up) },
    { c: 7, pose: mirror(gbLeanR2) },
    { c: 7.5, pose: mirror(gbLeanR2Up) },
  ],
}

// ---------------------------------------------------------------------------
// Disco Point — Saturday-night classic: point high across, then low, with
// the free hand on the hip and the hips popping opposite the point.
// ---------------------------------------------------------------------------

const dpHandOnHipLeft = { leftArm: limb(22, -55) }
const dpPointUpR: PoseSpec = {
  ...dpHandOnHipLeft,
  rightArm: limb(150, 160),
  leftLeg: limb(2, 2),
  rightLeg: limb(14, 10),
  torsoLean: -5,
  shoulderTilt: 8,
}
const dpPointDownR: PoseSpec = {
  ...dpHandOnHipLeft,
  rightArm: limb(-25, -40),
  leftLeg: limb(10, 8),
  rightLeg: limb(4, 2),
  torsoLean: 4,
  shoulderTilt: -4,
}
const discoPoint: ReferenceMove = {
  id: 'disco-point',
  name: 'Disco Point',
  style: 'Disco · Funk',
  level: 'Beginner',
  bpm: 112,
  counts: 8,
  defaultLoops: 8,
  emoji: '🪩',
  description:
    'The iconic point: up and across on the beat, down and across on the next, hand on hip, hips popping against the point. Style over subtlety — commit to every point.',
  keyPoints: [
    'Point HIGH — full arm extension past your shoulder line',
    'Keep the free hand planted on your hip',
    'Pop your hip away from the pointing arm',
    'Snap between points — arrive exactly on the beat',
    'Counts 5–8 switch to the left arm',
  ],
  focus: {
    leftArmLine: 1.5,
    rightArmLine: 1.5,
    leftForearm: 1.2,
    rightForearm: 1.2,
    hipSway: 1.2,
    shoulderTilt: 1.1,
  },
  keyframes: [
    { c: 0, pose: dpPointUpR },
    { c: 1, pose: dpPointDownR },
    { c: 2, pose: dpPointUpR },
    { c: 3, pose: dpPointDownR },
    { c: 4, pose: mirror(dpPointUpR) },
    { c: 5, pose: mirror(dpPointDownR) },
    { c: 6, pose: mirror(dpPointUpR) },
    { c: 7, pose: mirror(dpPointDownR) },
  ],
}

// ---------------------------------------------------------------------------
// Skater Knee Pop — intermediate: alternating side knee lifts with the
// opposite arm reaching straight up. Balance + coordination.
// ---------------------------------------------------------------------------

const kpLiftRight: PoseSpec = {
  leftArm: limb(155, 170),
  rightArm: limb(12, 20),
  leftLeg: limb(2, 0),
  rightLeg: limb(55, -20),
  torsoLean: -6,
  shoulderTilt: -8,
}
const kpLand: PoseSpec = {
  leftArm: limb(15, 30),
  rightArm: limb(15, 30),
  leftLeg: limb(8, -6),
  rightLeg: limb(8, -6),
  torsoLean: 0,
  shoulderTilt: 0,
}
const kneePop: ReferenceMove = {
  id: 'knee-pop',
  name: 'Skater Knee Pop',
  style: 'Street · Funk',
  level: 'Intermediate',
  bpm: 104,
  counts: 8,
  defaultLoops: 8,
  emoji: '⛸️',
  description:
    'Alternating side knee lifts with the opposite arm shooting straight up. Tests balance, coordination and hitting the top of the lift right on the beat.',
  keyPoints: [
    'Drive the knee UP and out to the side, past hip height',
    'Opposite arm reaches fully vertical at the top of the lift',
    'Land soft with both knees bent — no stomping',
    'Counterbalance with a slight lean away from the lift',
  ],
  focus: {
    leftThigh: 1.5,
    rightThigh: 1.5,
    leftKnee: 1.2,
    rightKnee: 1.2,
    leftArmLine: 1.2,
    rightArmLine: 1.2,
    torsoLean: 1.1,
  },
  keyframes: [
    { c: 0, pose: kpLiftRight },
    { c: 1, pose: kpLand },
    { c: 2, pose: mirror(kpLiftRight) },
    { c: 3, pose: kpLand },
    { c: 4, pose: kpLiftRight },
    { c: 5, pose: kpLand },
    { c: 6, pose: mirror(kpLiftRight) },
    { c: 7, pose: kpLand },
  ],
}

export const MOVES: ReferenceMove[] = [grooveBounce, stepTouch, discoPoint, kneePop]

export function getMove(id: string): ReferenceMove {
  const m = MOVES.find((mv) => mv.id === id)
  if (!m) throw new Error(`Unknown move: ${id}`)
  return m
}

export type { Keyframe }
