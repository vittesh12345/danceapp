import { useEffect, useRef } from 'react'
import type { ReferenceMove } from '../reference/types'
import { samplePose, timeToCount, wrapCount } from '../reference/sampler'
import { drawDancer, poseToPx } from './draw'

/**
 * Animated reference dancer, rendered from the move's keyframe data on a
 * canvas. Used large on the Learn screen and small on move cards.
 */

interface Props {
  move: ReferenceMove
  /** Playback speed multiplier (1 = actual tempo). */
  speed?: number
  playing?: boolean
  /** Called each frame with the current count (Learn screen count pips). */
  onCount?: (count: number) => void
  className?: string
  detail?: 'full' | 'mini'
}

export function Avatar({ move, speed = 1, playing = true, onCount, className, detail = 'full' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({ t: 0, last: 0, speed, playing })
  stateRef.current.speed = speed
  stateRef.current.playing = playing
  const onCountRef = useRef(onCount)
  onCountRef.current = onCount

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0

    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame)
      const st = stateRef.current
      const now = nowMs / 1000
      const dt = st.last ? Math.min(0.1, now - st.last) : 0
      st.last = now
      if (st.playing) st.t += dt * st.speed

      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.round(rect.width * dpr)
      const h = Math.round(rect.height * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.clearRect(0, 0, w, h)

      const count = timeToCount(move, st.t)
      onCountRef.current?.(wrapCount(count, move.counts))
      const pose = samplePose(move, count)

      // Fit: pose space spans roughly y ∈ [-1.85, 1.8], x ∈ [-1.75, 1.75].
      const torsoPx = h / 3.9
      const origin = { x: w / 2, y: h * 0.485 }
      const px = poseToPx(pose, origin, torsoPx)

      const mini = detail === 'mini'
      if (!mini) {
        // Stage floor
        const floorY = origin.y + 1.72 * torsoPx
        const grad = ctx.createRadialGradient(w / 2, floorY, 0, w / 2, floorY, w * 0.4)
        grad.addColorStop(0, 'rgba(139,92,246,0.22)')
        grad.addColorStop(1, 'rgba(139,92,246,0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.ellipse(w / 2, floorY, w * 0.34, torsoPx * 0.22, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      drawDancer(ctx, px, {
        bone: '#c4b5fd',
        joint: '#ffffff',
        lineWidth: Math.max(3, torsoPx * (mini ? 0.1 : 0.085)),
        glow: mini ? undefined : 'rgba(139,92,246,0.8)',
        glowBlur: 16,
        headFill: 'rgba(196,181,253,0.25)',
      })

      // Beat flash on the head of each count
      if (!mini) {
        const phase = wrapCount(count, 1)
        if (phase < 0.18) {
          ctx.save()
          ctx.globalAlpha = (1 - phase / 0.18) * 0.5
          ctx.strokeStyle = '#a78bfa'
          ctx.lineWidth = 3
          const r = torsoPx * (0.4 + phase * 2.2)
          const mh = px.nose
          ctx.beginPath()
          ctx.arc(mh.x, mh.y, r, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [move, detail])

  return <canvas ref={canvasRef} className={className} />
}
