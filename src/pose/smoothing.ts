import type { JointMap, PoseFrame } from './types'
import { JOINTS } from './types'

/**
 * One Euro filter (Casiez et al. 2012) — adaptive low-pass smoothing that
 * removes landmark jitter at rest while staying responsive during fast moves.
 */
class OneEuro {
  private xPrev: number | null = null
  private dxPrev = 0
  private tPrev: number | null = null

  constructor(
    private minCutoff = 1.2,
    private beta = 0.4,
    private dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }

  filter(x: number, t: number): number {
    if (this.xPrev === null || this.tPrev === null || t <= this.tPrev) {
      this.xPrev = x
      this.tPrev = t
      return x
    }
    const dt = t - this.tPrev
    const dx = (x - this.xPrev) / dt
    const aD = OneEuro.alpha(this.dCutoff, dt)
    this.dxPrev = aD * dx + (1 - aD) * this.dxPrev
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dxPrev)
    const a = OneEuro.alpha(cutoff, dt)
    this.xPrev = a * x + (1 - a) * this.xPrev
    this.tPrev = t
    return this.xPrev
  }
}

/** Smooths every joint coordinate of a pose stream with One Euro filters. */
export class PoseSmoother {
  private filters = new Map<string, OneEuro>()

  private f(key: string) {
    let f = this.filters.get(key)
    if (!f) {
      f = new OneEuro()
      this.filters.set(key, f)
    }
    return f
  }

  smooth(frame: PoseFrame): PoseFrame {
    const joints = {} as JointMap
    for (const n of JOINTS) {
      const p = frame.joints[n]
      joints[n] = {
        x: this.f(`${n}.x`).filter(p.x, frame.t),
        y: this.f(`${n}.y`).filter(p.y, frame.t),
        visibility: p.visibility,
      }
    }
    return { ...frame, joints }
  }

  reset() {
    this.filters.clear()
  }
}
