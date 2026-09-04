import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { JointMap, JointName, PoseFrame, PoseSource } from './types'
import { PoseSmoother } from './smoothing'

/**
 * Real computer-vision pipeline: webcam → MediaPipe PoseLandmarker (BlazePose
 * GHUM), running fully on-device via WebAssembly/WebGL. Nothing leaves the
 * browser — frames are processed locally and discarded.
 *
 * The WASM runtime and the pose model are served from the app's own origin
 * (public/mediapipe, public/models) with a CDN fallback, so this works
 * offline once loaded.
 */

/** MediaPipe BlazePose landmark indices for the joints we track. */
const MP_INDEX: Record<JointName, number> = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
}

const LOCAL_WASM = '/mediapipe'
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const LOCAL_MODEL = '/models/pose_landmarker_lite.task'
const CDN_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'

async function createLandmarker(): Promise<PoseLandmarker> {
  const attempts: Array<[string, string]> = [
    [LOCAL_WASM, LOCAL_MODEL],
    [CDN_WASM, CDN_MODEL],
  ]
  let lastError: unknown
  for (const [wasm, model] of attempts) {
    try {
      const fileset = await FilesetResolver.forVisionTasks(wasm)
      return await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: model, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Could not load the pose model. Check your connection and retry.')
}

export class MediaPipePoseSource implements PoseSource {
  readonly kind = 'camera' as const
  readonly videoElement: HTMLVideoElement

  private landmarker: PoseLandmarker | null = null
  private stream: MediaStream | null = null
  private smoother = new PoseSmoother()
  private latest: PoseFrame | null = null
  private lastVideoTime = -1
  private stopped = false

  constructor() {
    this.videoElement = document.createElement('video')
    this.videoElement.playsInline = true
    this.videoElement.muted = true
  }

  async start(): Promise<void> {
    // Load the model and open the camera in parallel — both are slow-ish.
    const [landmarker, stream] = await Promise.all([
      createLandmarker(),
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }),
    ])
    if (this.stopped) {
      landmarker.close()
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    this.landmarker = landmarker
    this.stream = stream
    this.videoElement.srcObject = stream
    await this.videoElement.play()
  }

  getPose(t: number): PoseFrame | null {
    const video = this.videoElement
    const lm = this.landmarker
    if (!lm || video.readyState < 2 || video.videoWidth === 0) return null

    // Only run inference when the camera delivered a new frame.
    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime
      const result = lm.detectForVideo(video, performance.now())
      const person = result.landmarks[0]
      if (person) {
        const joints = {} as JointMap
        for (const name of Object.keys(MP_INDEX) as JointName[]) {
          const p = person[MP_INDEX[name]]
          joints[name] = {
            // Mirror horizontally so coordinates match the selfie view.
            x: 1 - p.x,
            y: p.y,
            visibility: p.visibility ?? 1,
          }
        }
        this.latest = this.smoother.smooth({
          t,
          joints,
          aspect: video.videoWidth / video.videoHeight,
        })
      } else {
        this.latest = null
      }
    }
    // A pose is only useful while fresh; drop it if tracking stalls.
    if (this.latest && t - this.latest.t > 0.5) return null
    return this.latest
  }

  stop(): void {
    this.stopped = true
    this.landmarker?.close()
    this.landmarker = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.videoElement.srcObject = null
    this.smoother.reset()
  }
}
