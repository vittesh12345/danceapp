import type { JointName } from '../pose/types'
import { BONES } from '../pose/types'
import type { Vec } from '../pose/geometry'

/**
 * Canvas skeleton rendering shared by the reference avatar, the live camera
 * overlay and the demo dancer.
 */

export type PxJoints = Record<JointName, Vec>

export interface DancerStyle {
  bone: string
  joint: string
  lineWidth: number
  glow?: string
  glowBlur?: number
  alpha?: number
  /** 0..1 error per joint → tinted toward errColor. */
  jointErr?: Partial<Record<JointName, number>>
  errColor?: string
  headFill?: string
}

/** Blend two css-hex colors (#rrggbb). */
export function mixColor(a: string, b: string, u: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * u))
  return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function drawDancer(ctx: CanvasRenderingContext2D, j: PxJoints, style: DancerStyle) {
  const torsoPx = Math.hypot(
    (j.leftShoulder.x + j.rightShoulder.x) / 2 - (j.leftHip.x + j.rightHip.x) / 2,
    (j.leftShoulder.y + j.rightShoulder.y) / 2 - (j.leftHip.y + j.rightHip.y) / 2,
  )
  ctx.save()
  ctx.globalAlpha = style.alpha ?? 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (style.glow) {
    ctx.shadowColor = style.glow
    ctx.shadowBlur = style.glowBlur ?? 14
  }

  const errFor = (a: JointName, b: JointName) =>
    Math.max(style.jointErr?.[a] ?? 0, style.jointErr?.[b] ?? 0)

  // Bones
  for (const [a, b] of BONES) {
    const e = errFor(a, b)
    ctx.strokeStyle = e > 0 && style.errColor ? mixColor(style.bone, style.errColor, Math.min(1, e)) : style.bone
    ctx.lineWidth = style.lineWidth
    ctx.beginPath()
    ctx.moveTo(j[a].x, j[a].y)
    ctx.lineTo(j[b].x, j[b].y)
    ctx.stroke()
  }

  // Neck + head
  const midShoulder = { x: (j.leftShoulder.x + j.rightShoulder.x) / 2, y: (j.leftShoulder.y + j.rightShoulder.y) / 2 }
  const headR = torsoPx * 0.21
  const head = {
    x: j.nose.x + (j.nose.x - midShoulder.x) * 0.18,
    y: j.nose.y + (j.nose.y - midShoulder.y) * 0.18,
  }
  ctx.strokeStyle = style.bone
  ctx.lineWidth = style.lineWidth
  ctx.beginPath()
  ctx.moveTo(midShoulder.x, midShoulder.y)
  ctx.lineTo(head.x + (midShoulder.x - head.x) * 0.4, head.y + (midShoulder.y - head.y) * 0.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(head.x, head.y, headR, 0, Math.PI * 2)
  if (style.headFill) {
    ctx.fillStyle = style.headFill
    ctx.fill()
  }
  ctx.stroke()

  // Joints
  const drawn: JointName[] = [
    'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist',
    'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle',
  ]
  for (const n of drawn) {
    const e = style.jointErr?.[n] ?? 0
    const r = style.lineWidth * (0.85 + e * 0.55)
    ctx.fillStyle = e > 0 && style.errColor ? mixColor(style.joint, style.errColor, Math.min(1, e)) : style.joint
    ctx.beginPath()
    ctx.arc(j[n].x, j[n].y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Correction arrow from a user joint toward its target position. */
export function drawArrow(ctx: CanvasRenderingContext2D, from: Vec, to: Vec, color: string) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len < 14) return
  const ux = dx / len
  const uy = dy / len
  // Start a bit off the joint, stop a bit short of the target.
  const sx = from.x + ux * 10
  const sy = from.y + uy * 10
  const ex = to.x - ux * 6
  const ey = to.y - uy * 6
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 5
  ctx.setLineDash([7, 6])
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  ctx.setLineDash([])
  const ah = 9
  ctx.beginPath()
  ctx.moveTo(ex + ux * ah, ey + uy * ah)
  ctx.lineTo(ex - uy * ah * 0.6, ey + ux * ah * 0.6)
  ctx.lineTo(ex + uy * ah * 0.6, ey - ux * ah * 0.6)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * Map pose-space joints to pixels.
 * @param origin px position of the pose-space origin (mid-hip)
 * @param torsoPx pixels per pose-space unit
 */
export function poseToPx(joints: Record<JointName, Vec>, origin: Vec, torsoPx: number): PxJoints {
  const out = {} as PxJoints
  for (const k of Object.keys(joints) as JointName[]) {
    out[k] = { x: origin.x + joints[k].x * torsoPx, y: origin.y + joints[k].y * torsoPx }
  }
  return out
}
