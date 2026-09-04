/**
 * WebAudio metronome: short filtered clicks on every beat, accented on
 * count 1, scheduled ahead of time against the session clock for tight sync.
 */
export class Metronome {
  private ctx: AudioContext | null = null
  private timer: number | null = null
  private nextBeat = 0
  private sessionStartAudioTime = 0
  enabled = true

  constructor(
    private bpm: number,
    private countsPerLoop: number,
  ) {}

  /** Call at the moment session time 0 happens. */
  start() {
    try {
      this.ctx = new AudioContext()
    } catch {
      return
    }
    this.sessionStartAudioTime = this.ctx.currentTime
    this.nextBeat = 0
    this.timer = window.setInterval(() => this.schedule(), 100)
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx) return
    const secPerBeat = 60 / this.bpm
    const horizon = ctx.currentTime + 0.3
    while (this.sessionStartAudioTime + this.nextBeat * secPerBeat < horizon) {
      const when = this.sessionStartAudioTime + this.nextBeat * secPerBeat
      if (this.enabled && when > ctx.currentTime - 0.02) {
        this.click(when, this.nextBeat % this.countsPerLoop === 0)
      }
      this.nextBeat++
    }
  }

  private click(when: number, accent: boolean) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = accent ? 1320 : 880
    gain.gain.setValueAtTime(accent ? 0.24 : 0.14, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.07)
    osc.connect(gain).connect(ctx.destination)
    osc.start(when)
    osc.stop(when + 0.09)
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.ctx?.close().catch(() => {})
    this.ctx = null
  }
}
