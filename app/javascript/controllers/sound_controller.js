import { Controller } from "@hotwired/stimulus"

const KEY = "manimator:sound"
const BED_LEVEL = .35
const FADE = 3   // seconds to fade the bed in or out
const XFADE = 4  // seconds of overlap where the bed loops back to its start

const store = {
  get() { try { return localStorage.getItem(KEY) } catch { return null } },
  set(v) { try { localStorage.setItem(KEY, v) } catch {} }
}

// A soft piano bed (generated with ElevenLabs, see script/generate_audio.rb) under the
// page, plus two one-shots: particles scattering and poking π. On by default unless the
// visitor turned it off (remembered per browser). Nothing loads or plays until their
// first click, tap, or keypress, since browsers only allow audio after a gesture.
//
// As a player (data-sound-player-value, the onboarding's corner player) the toggle is a play/pause button: it shows
// whether music is actually playing, and pressing it before anything has played starts the music.
export default class extends Controller {
  static targets = ["toggle"]
  static values = { bed: String, scatter: String, poke: String, player: Boolean }

  connect() {
    this.on = store.get() !== "off"
    this.lastScatter = 0
    if (this.on) {
      this.wake = e => {
        if (this.playerValue && this.hasToggleTarget && this.toggleTarget.contains(e.target)) return
        this.unwake()
        if (this.on) this.start()
      }
      this.unwake = () => ["pointerdown", "keydown"].forEach(ev => window.removeEventListener(ev, this.wake, true))
      ;["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, this.wake, true))
      // The player starts with the page when it can: arriving by a click (Start animating, through Turbo) already
      // counts as the gesture browsers want, so the music comes in with onboarding's intro.
      if (this.playerValue && navigator.userActivation?.hasBeenActive) this.wake({ target: document.body })
    }
    this.onVisibility = () => document.hidden ? this.ctx?.suspend() : this.on && this.ctx?.resume()
    document.addEventListener("visibilitychange", this.onVisibility)
    this.render()
  }

  disconnect() {
    this.unwake?.()
    document.removeEventListener("visibilitychange", this.onVisibility)
    this.stop()
  }

  toggle() {
    this.unwake?.()
    if (this.playerValue && this.on && !this.ctx) { this.start(); return this.render() }
    this.on = !this.on
    store.set(this.on ? "on" : "off")
    this.on ? this.start() : this.fadeOut()
    this.render()
  }

  render() {
    if (!this.hasToggleTarget) return
    if (this.playerValue) {
      const playing = this.on && !!this.ctx
      this.element.dataset.playing = playing
      this.toggleTarget.setAttribute("aria-pressed", String(playing))
      this.toggleTarget.setAttribute("aria-label", playing ? "Pause music" : "Play music")
      return
    }
    this.toggleTarget.textContent = this.on ? "sound on" : "sound off"
    this.toggleTarget.setAttribute("aria-pressed", String(this.on))
    this.toggleTarget.setAttribute("aria-label", this.on ? "Turn sound off" : "Turn sound on")
  }

  async start() {
    if (this.ctx) {
      clearTimeout(this.closeTimer)
      await this.ctx.resume()
      return this.fadeIn()
    }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = this.ctx = new AC()
    this.render()
    this.master = ctx.createGain()
    this.master.connect(ctx.destination)
    this.bedGain = ctx.createGain()
    this.bedGain.gain.value = 0
    this.bedGain.connect(this.master)

    const load = url => fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
    if (this.scatterValue) load(this.scatterValue).then(b => { this.scatterBuf = b }, () => {})
    if (this.pokeValue) load(this.pokeValue).then(b => { this.pokeBuf = b }, () => {})
    try { this.bedBuf = await load(this.bedValue) } catch { return }
    if (this.ctx !== ctx) return
    this.loopBed(ctx.currentTime + .05)
    this.fadeIn()
  }

  // Plays the bed from `t` and schedules the next copy to start XFADE seconds before
  // this one ends, crossfading the two so the loop point can't be heard.
  loopBed(t) {
    const ctx = this.ctx, buf = this.bedBuf
    if (!ctx || !buf) return
    const src = ctx.createBufferSource(), g = ctx.createGain(), len = buf.duration
    src.buffer = buf
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(1, t + XFADE)
    g.gain.setValueAtTime(1, t + len - XFADE)
    g.gain.linearRampToValueAtTime(0, t + len)
    src.connect(g).connect(this.bedGain)
    src.start(t)
    src.stop(t + len)
    const next = t + len - XFADE
    this.loopTimer = setTimeout(() => this.loopBed(next), (next - ctx.currentTime - 1) * 1000)
  }

  fadeIn() {
    const g = this.bedGain?.gain, now = this.ctx?.currentTime
    if (!g) return
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(BED_LEVEL, now + FADE)
  }

  fadeOut() {
    const g = this.bedGain?.gain, now = this.ctx?.currentTime
    if (!g) return
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(0, now + 1)
    this.closeTimer = setTimeout(() => { this.stop(); this.render() }, 1200)
  }

  stop() {
    clearTimeout(this.loopTimer)
    clearTimeout(this.closeTimer)
    this.ctx?.close?.()
    this.ctx = this.master = this.bedGain = this.bedBuf = this.scatterBuf = this.pokeBuf = null
  }

  play(buf, { gain = .5, rate = 1 } = {}) {
    if (!this.on || !this.ctx || !buf) return
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain()
    src.buffer = buf
    src.playbackRate.value = rate
    g.gain.value = gain
    src.connect(g).connect(this.master)
    src.start()
  }

  scatter() {
    const now = performance.now()
    if (now - this.lastScatter < 600) return
    this.lastScatter = now
    this.play(this.scatterBuf, { gain: .45 })
  }

  // Hero π varies its pitch a little each poke; the footer π answers a fifth higher.
  poke({ detail: { variant } = {} } = {}) {
    const rate = variant === "end" ? 1.5 : 2 ** ((Math.random() * 4 - 2) / 12)
    this.play(this.pokeBuf, { gain: .55, rate })
  }
}
