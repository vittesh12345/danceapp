import type { ReferenceMove } from '../reference/types'
import { sampleFeatures, timeToCount } from '../reference/sampler'
import { FEATURE_META, type FeatureKey, type FeatureVector } from './features'

/**
 * Timing estimation: how far ahead/behind the beat is the dancer?
 *
 * We keep a short rolling window of the user's feature vectors and search for
 * the clock offset that best aligns them with the reference choreography
 * (cross-correlation over a ±0.8 s range). A positive offset means the user
 * is LATE. The offset is used two ways:
 *  - reported as timing feedback ("you're ~0.3 s behind the beat")
 *  - subtracted before technique scoring, so being late doesn't also read
 *    as "wrong arm angle" — technique and timing are separated.
 */

/** Features that move a lot in choreography — the alignment signal. */
const SALIENT: FeatureKey[] = [
  'leftArmLine',
  'rightArmLine',
  'leftForearm',
  'rightForearm',
  'leftThigh',
  'rightThigh',
]

interface Sample {
  t: number
  feat: FeatureVector
}

export interface TimingEstimate {
  /** Seconds; positive = user is behind the beat. */
  offset: number
  /** True when the aligned error is meaningfully lower than unaligned. */
  confident: boolean
}

const WINDOW_S = 4
const MAX_OFFSET = 0.8
const STEP = 0.05

export class TimingEstimator {
  private buf: Sample[] = []
  private emaOffset = 0
  private hasEstimate = false

  add(t: number, feat: FeatureVector) {
    this.buf.push({ t, feat })
    const cutoff = t - WINDOW_S
    while (this.buf.length && this.buf[0].t < cutoff) this.buf.shift()
  }

  /** Current smoothed offset (0 until the first confident estimate). */
  get offset(): number {
    return this.emaOffset
  }

  private alignmentError(move: ReferenceMove, offset: number): number {
    let sum = 0
    let n = 0
    // Subsample the buffer — precision beyond ~15 samples/window buys nothing.
    const stride = Math.max(1, Math.floor(this.buf.length / 24))
    for (let i = 0; i < this.buf.length; i += stride) {
      const s = this.buf[i]
      const ref = sampleFeatures(move, timeToCount(move, s.t - offset))
      for (const k of SALIENT) {
        sum += Math.abs(s.feat[k] - ref[k]) / FEATURE_META[k].tolerance
        n++
      }
    }
    return n ? sum / n : Infinity
  }

  /** Re-estimate. Call every ~1–2 s, not per frame. */
  estimate(move: ReferenceMove): TimingEstimate {
    if (!this.buf.length || this.buf[this.buf.length - 1].t - this.buf[0].t < 2.2) {
      return { offset: this.emaOffset, confident: false }
    }
    let bestOffset = 0
    let bestErr = Infinity
    for (let off = -MAX_OFFSET; off <= MAX_OFFSET + 1e-9; off += STEP) {
      const err = this.alignmentError(move, off)
      if (err < bestErr) {
        bestErr = err
        bestOffset = off
      }
    }
    const err0 = this.alignmentError(move, 0)
    // Only trust an offset if aligning genuinely helps; otherwise decay to 0.
    const confident = bestErr < err0 * 0.88 && err0 - bestErr > 0.06
    const target = confident ? bestOffset : 0
    this.emaOffset = this.hasEstimate ? this.emaOffset * 0.6 + target * 0.4 : target
    this.hasEstimate = true
    return { offset: this.emaOffset, confident }
  }

  reset() {
    this.buf = []
    this.emaOffset = 0
    this.hasEstimate = false
  }
}
