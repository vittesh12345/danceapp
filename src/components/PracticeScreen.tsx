import { useCallback, useEffect, useRef, useState } from 'react'
import { CoachSession, type LiveState, type SessionReport } from '../analysis/session'
import { Metronome } from '../audio/metronome'
import { CoachVoice } from '../audio/voice'
import { MediaPipePoseSource } from '../pose/mediapipeSource'
import { SimulatedPoseSource } from '../pose/simulatedSource'
import type { PoseSource } from '../pose/types'
import { loopSeconds } from '../reference/sampler'
import type { ReferenceMove } from '../reference/types'
import { drawArrow, drawDancer, type PxJoints } from './draw'
import { ScoreRing } from './ScoreRing'
import type { JointName } from '../pose/types'

/**
 * The practice experience: camera (or demo dancer) + skeletal overlay +
 * ghost target + arrows + live coaching HUD.
 */

const COUNTDOWN_S = 3
const ARROW_JOINTS: JointName[] = [
  'leftWrist', 'rightWrist', 'leftElbow', 'rightElbow', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle',
]

type Phase = 'loading' | 'countdown' | 'dancing' | 'error'

interface HudState {
  score: number
  countInt: number
  loop: number
  feedback: LiveState['feedback']
  offsetSec: number
  tracking: boolean
  /** True once the dancer has been detected at least once. */
  started: boolean
  progress: number
}

interface Props {
  move: ReferenceMove
  mode: 'camera' | 'demo'
  onFinish: (report: SessionReport | null) => void
  onExit: () => void
}

export function PracticeScreen({ move, mode, onFinish, onExit }: Props) {
  const [activeMode, setActiveMode] = useState(mode)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string>('')
  const [countdown, setCountdown] = useState(COUNTDOWN_S)
  const [hud, setHud] = useState<HudState>({
    score: 0, countInt: 0, loop: 0, feedback: [], offsetSec: 0, tracking: false, started: false, progress: 0,
  })
  const [showGhost, setShowGhost] = useState(true)
  const [metroOn, setMetroOn] = useState(true)
  const [voiceOn, setVoiceOn] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceRef = useRef<PoseSource | null>(null)
  const sessionRef = useRef<CoachSession | null>(null)
  const metronomeRef = useRef<Metronome | null>(null)
  const voiceRef = useRef(new CoachVoice())
  const liveRef = useRef<LiveState | null>(null)
  const finishedRef = useRef(false)
  const optsRef = useRef({ showGhost, metroOn, voiceOn })
  optsRef.current = { showGhost, metroOn, voiceOn }

  const totalSec = loopSeconds(move) * move.defaultLoops

  const finishSession = useCallback(
    (elapsed: number) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const report = sessionRef.current?.finish(Math.min(elapsed, totalSec)) ?? null
      onFinish(report)
    },
    [onFinish, totalSec],
  )

  useEffect(() => {
    finishedRef.current = false
    let cancelled = false
    let raf = 0
    const source: PoseSource =
      activeMode === 'camera' ? new MediaPipePoseSource() : new SimulatedPoseSource(move)
    sourceRef.current = source
    const session = new CoachSession(move, activeMode)
    sessionRef.current = session
    const metronome = new Metronome(move.bpm, move.counts)
    metronomeRef.current = metronome
    const voice = voiceRef.current

    setPhase('loading')
    setError('')

    source
      .start()
      .then(() => {
        if (cancelled) {
          source.stop()
          return
        }
        if (source.videoElement && containerRef.current) {
          const v = source.videoElement
          v.className = 'practice-video'
          containerRef.current.prepend(v)
        }
        setPhase('countdown')

        const clock0 = performance.now()
        let metronomeStarted = false
        let lastHudAt = 0
        let lastTrackedAt = 0
        let lastSpokenHeadline = ''

        const frame = (nowMs: number) => {
          raf = requestAnimationFrame(frame)
          const clockT = (nowMs - clock0) / 1000
          const sessionT = clockT - COUNTDOWN_S

          if (sessionT < 0) {
            setCountdown(Math.ceil(-sessionT))
          } else if (!metronomeStarted) {
            metronomeStarted = true
            metronome.enabled = optsRef.current.metroOn
            metronome.start()
            setPhase('dancing')
          }

          metronome.enabled = optsRef.current.metroOn
          voice.enabled = optsRef.current.voiceOn

          const poseFrame = source.getPose(clockT)
          let live: LiveState | null = null
          if (sessionT >= 0) {
            live = session.update(sessionT, poseFrame)
            liveRef.current = live
            if (live.tracking) lastTrackedAt = sessionT
          }

          draw(sessionT, poseFrame, live, lastTrackedAt)

          if (sessionT >= totalSec) {
            finishSession(sessionT)
            return
          }

          // Throttled HUD state + voice.
          if (clockT - lastHudAt > 0.12) {
            lastHudAt = clockT
            if (live) {
              const headline = live.feedback[0]
              if (headline && headline.kind !== 'good' && headline.text !== lastSpokenHeadline) {
                lastSpokenHeadline = headline.text
                voice.speak(headline.text)
              }
              setHud({
                score: live.score,
                countInt: Math.floor(live.count),
                loop: live.loop,
                feedback: live.feedback,
                offsetSec: live.offsetSec,
                tracking: live.tracking || sessionT - lastTrackedAt < 1,
                started: session.everTracked,
                progress: Math.min(1, sessionT / totalSec),
              })
            }
          }
        }
        raf = requestAnimationFrame(frame)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setError(
          /denied|permission|notallowed/i.test(msg)
            ? 'Camera access was denied. Enable camera permission for this site, or try demo mode.'
            : `Could not start: ${msg}`,
        )
        setPhase('error')
      })

    const draw = (
      sessionT: number,
      poseFrame: ReturnType<PoseSource['getPose']>,
      live: LiveState | null,
      lastTrackedAt: number,
    ) => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr)
        canvas.height = Math.round(ch * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cw, ch)

      // "Cover" mapping from normalized frame coords to canvas px.
      const aspect = poseFrame?.aspect ?? 16 / 9
      const scale = Math.max(cw / aspect, ch)
      const dispW = aspect * scale
      const dispH = scale
      const offX = (cw - dispW) / 2
      const offY = (ch - dispH) / 2
      const toPx = (xn: number, yn: number) => ({ x: offX + xn * dispW, y: offY + yn * dispH })

      if (activeMode === 'demo') {
        // Stage backdrop for the demo dancer.
        const g = ctx.createRadialGradient(cw / 2, ch * 0.45, 0, cw / 2, ch * 0.45, Math.max(cw, ch) * 0.75)
        g.addColorStop(0, '#1b1533')
        g.addColorStop(1, '#0b0b12')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, cw, ch)
      }

      const user = live?.user ?? null

      // Ghost target, anchored to the user's body (or frame center).
      const anchorOrigin = user ? user.originVideo : { x: 0.5 * aspect, y: 0.56 }
      const anchorTorso = user ? user.torsoVideo : 0.155
      const ghostPx: PxJoints | null = live
        ? (() => {
            const out = {} as PxJoints
            for (const [k, p] of Object.entries(live.refPose)) {
              const xu = anchorOrigin.x + p.x * anchorTorso
              const yu = anchorOrigin.y + p.y * anchorTorso
              out[k as JointName] = toPx(xu / aspect, yu)
            }
            return out
          })()
        : null

      if (ghostPx && optsRef.current.showGhost) {
        drawDancer(ctx, ghostPx, {
          bone: '#a78bfa',
          joint: '#c4b5fd',
          lineWidth: 6,
          alpha: 0.5,
          glow: 'rgba(139,92,246,0.6)',
          glowBlur: 12,
        })
      }

      // User skeleton.
      if (poseFrame && sessionT > -COUNTDOWN_S) {
        const px = {} as PxJoints
        for (const [k, p] of Object.entries(poseFrame.joints)) {
          px[k as JointName] = toPx(p.x, p.y)
        }
        drawDancer(ctx, px, {
          bone: activeMode === 'demo' ? '#e2e8f0' : '#f8fafc',
          joint: '#ffffff',
          lineWidth: activeMode === 'demo' ? 7 : 6,
          glow: 'rgba(255,255,255,0.35)',
          glowBlur: 8,
          jointErr: live?.jointErr,
          errColor: '#fb7185',
          headFill: activeMode === 'demo' ? 'rgba(226,232,240,0.2)' : undefined,
        })

        // Correction arrows toward the ghost.
        if (ghostPx && live?.tracking) {
          for (const j of ARROW_JOINTS) {
            const e = live.jointErr[j] ?? 0
            if (e > 0.35) {
              drawArrow(ctx, px[j], ghostPx[j], e > 0.65 ? '#fb7185' : '#fbbf24')
            }
          }
        }
      }

      // Lost-tracking hint.
      if (live && sessionT > 2 && sessionT - lastTrackedAt > 1) {
        ctx.save()
        ctx.fillStyle = 'rgba(11,11,18,0.55)'
        ctx.fillRect(0, 0, cw, ch)
        ctx.restore()
      }
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      source.stop()
      metronome.stop()
      voice.stop()
      if (source.videoElement) source.videoElement.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, move])

  const headline = hud.feedback[0]
  const secondary = hud.feedback[1]

  if (phase === 'error') {
    return (
      <div className="practice-screen practice-error">
        <div className="card error-card">
          <h2>📷 Camera unavailable</h2>
          <p>{error}</p>
          <div className="row gap">
            <button className="btn primary" onClick={() => setActiveMode('camera')}>
              Retry camera
            </button>
            <button className="btn" onClick={() => setActiveMode('demo')}>
              Watch demo mode instead
            </button>
            <button className="btn ghost" onClick={onExit}>
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="practice-screen">
      <div className="practice-stage" ref={containerRef}>
        <canvas ref={canvasRef} className="practice-canvas" />

        <div className="practice-progress">
          <div className="practice-progress-fill" style={{ width: `${hud.progress * 100}%` }} />
        </div>

        <div className="practice-topbar">
          <button className="btn icon" onClick={onExit} title="Exit">
            ✕
          </button>
          <div className="practice-title">
            <strong>{move.name}</strong>
            <span>
              Loop {Math.min(hud.loop + 1, move.defaultLoops)}/{move.defaultLoops} · {move.bpm} BPM
              {activeMode === 'demo' && ' · demo dancer'}
            </span>
          </div>
          <div className="practice-toggles">
            <button className={`btn icon ${showGhost ? 'on' : ''}`} onClick={() => setShowGhost(!showGhost)} title="Ghost overlay">
              👻
            </button>
            <button className={`btn icon ${metroOn ? 'on' : ''}`} onClick={() => setMetroOn(!metroOn)} title="Metronome">
              🔔
            </button>
            <button className={`btn icon ${voiceOn ? 'on' : ''}`} onClick={() => setVoiceOn(!voiceOn)} title="Voice coach">
              🔊
            </button>
          </div>
        </div>

        {phase === 'dancing' && (
          <div className="count-pips">
            {Array.from({ length: move.counts }, (_, i) => (
              <span key={i} className={`pip ${i === hud.countInt ? 'active' : ''}`}>
                {i + 1}
              </span>
            ))}
          </div>
        )}

        {phase === 'loading' && (
          <div className="practice-overlay">
            <div className="spinner" />
            <p>{activeMode === 'camera' ? 'Starting camera & loading pose model…' : 'Warming up the demo dancer…'}</p>
          </div>
        )}

        {phase === 'countdown' && (
          <div className="practice-overlay">
            <div className="countdown-number" key={countdown}>
              {countdown}
            </div>
            <p>{activeMode === 'camera' ? 'Step back so your whole body is in frame' : 'Demo dancer starting…'}</p>
          </div>
        )}

        {phase === 'dancing' && !hud.tracking && (
          <div className="practice-overlay soft">
            <p className="big">🕴 Step into frame</p>
            <p>Make sure your whole body is visible</p>
          </div>
        )}

        {phase === 'dancing' && (
          <div className="practice-hud">
            <div className="hud-left">{hud.started && <ScoreRing value={hud.score} size={92} label="LIVE" />}</div>
            <div className="hud-center">
              {headline && (
                <div className={`feedback-card ${headline.kind}`} key={headline.id}>
                  <span className="feedback-icon">
                    {headline.kind === 'good' ? '✨' : headline.kind === 'timing' ? '⏱️' : '🎯'}
                  </span>
                  <div>
                    <div className="feedback-text">{headline.text}</div>
                    {headline.detail && <div className="feedback-detail">{headline.detail}</div>}
                  </div>
                </div>
              )}
              {secondary && (
                <div className="feedback-secondary">
                  {secondary.text}
                  {secondary.detail ? ` · ${secondary.detail}` : ''}
                </div>
              )}
            </div>
            <div className="hud-right">
              <div className={`timing-chip ${Math.abs(hud.offsetSec) < 0.16 ? 'good' : 'off'}`}>
                {Math.abs(hud.offsetSec) < 0.16
                  ? '● On beat'
                  : `${Math.abs(hud.offsetSec).toFixed(1)}s ${hud.offsetSec > 0 ? 'late' : 'early'}`}
              </div>
              <button className="btn stop" onClick={() => finishSession(hud.progress * totalSec)}>
                ■ Finish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
