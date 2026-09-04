/**
 * Spoken coaching via the browser's SpeechSynthesis — throttled so the coach
 * doesn't talk over themselves.
 */
export class CoachVoice {
  private lastSpokenAt = 0
  private lastText = ''
  enabled = false

  speak(text: string) {
    if (!this.enabled || typeof speechSynthesis === 'undefined') return
    const now = performance.now() / 1000
    if (text === this.lastText || now - this.lastSpokenAt < 3.5) return
    this.lastSpokenAt = now
    this.lastText = text
    try {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1.06
      u.pitch = 1.02
      u.volume = 0.9
      speechSynthesis.speak(u)
    } catch {
      // Speech unavailable — silent coach.
    }
  }

  stop() {
    try {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    } catch {
      // ignore
    }
  }
}
