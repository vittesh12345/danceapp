/**
 * Core pose data model, shared by the real (MediaPipe) and simulated sources.
 *
 * Coordinate conventions used throughout the app:
 *
 * - "video space": x,y in [0..1] relative to the video frame, MIRRORED so the
 *   image matches what the user sees on screen (selfie view). x grows to the
 *   right of the screen; the user's LEFT hand therefore appears at low x.
 * - "pose space": isotropic, body-normalized space. Origin at the mid-hip,
 *   y grows DOWNWARD, and 1.0 unit = torso length (mid-hip to mid-shoulder).
 *   All movement comparison happens here so body size, camera distance and
 *   position in frame don't affect scoring.
 */

export const JOINTS = [
  'nose',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
] as const

export type JointName = (typeof JOINTS)[number]

export interface JointPoint {
  x: number
  y: number
  /** 0..1 — how confident the tracker is that this joint is visible. */
  visibility: number
}

export type JointMap = Record<JointName, JointPoint>

/** One tracked pose at one moment in time. */
export interface PoseFrame {
  /** Seconds on the session clock. */
  t: number
  /** Joints in mirrored video space (see file header). */
  joints: JointMap
  /** Width/height of the source frame, used for aspect correction. */
  aspect: number
}

/** Bone segments used for drawing skeletons. */
export const BONES: ReadonlyArray<readonly [JointName, JointName]> = [
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
]

/**
 * A source of pose frames. The UI only talks to this interface, so the
 * MediaPipe camera pipeline and the simulated demo dancer are interchangeable.
 */
export interface PoseSource {
  /** Resolves when the source is ready to produce frames. */
  start(): Promise<void>
  /**
   * Latest pose for session time `t` (seconds since practice start), or null
   * if no person is currently detected.
   */
  getPose(t: number): PoseFrame | null
  /** Release camera/model/timers. Safe to call more than once. */
  stop(): void
  /** 'camera' drives the real CV pipeline; 'demo' is the simulated dancer. */
  readonly kind: 'camera' | 'demo'
  /** For camera sources: the video element to render behind the overlay. */
  readonly videoElement?: HTMLVideoElement
}
