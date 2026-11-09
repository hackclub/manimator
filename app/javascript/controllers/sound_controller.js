import { Controller } from "@hotwired/stimulus"
import { audio } from "audio"
import { sfx } from "sfx"

// A soft piano bed under the page (see audio.js), plus one-shots: particles scattering, poking π, and the sparkle
// when you press Start animating. On by default unless the visitor turned it off (remembered per browser). Nothing
// plays until their first click, tap or keypress, since browsers only allow audio after a gesture. The music carries
// on from one page to the next instead of starting over.
//
// As a player (data-sound-player-value, the onboarding's corner player) the toggle is a play/pause button: it shows
// whether music is actually playing, and pressing it before anything has played starts the music.
export default class extends Controller {
  static targets = ["toggle"]
  static values = { bed: String, scatter: String, poke: String, player: Boolean }

  connect() {
    audio.join()
    this.lastScatter = 0
    this.wake = e => {
      if (this.playerValue && this.hasToggleTarget && this.toggleTarget.contains(e.target)) return
      this.unwake()
      this.start()
    }
    this.unwake = () => ["pointerdown", "keydown"].forEach(ev => window.removeEventListener(ev, this.wake, true))
    if (audio.on) {
      ;["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, this.wake, true))
      // Already unlocked (the music came with you from the last page), or arriving by a click, which browsers count
      // as the gesture: the music comes in with the page.
      if (audio.ctx || navigator.userActivation?.hasBeenActive) this.wake({ target: document.body })
    }
    this.render = this.render.bind(this)
    window.addEventListener("audio:change", this.render)
    this.render()
  }

  disconnect() {
    this.unwake()
    window.removeEventListener("audio:change", this.render)
    audio.leave()
  }

  start() {
    if (!audio.unlock()) return
    audio.startBed(this.bedValue)
    audio.load(this.scatterValue).then(b => { this.scatterBuf = b }, () => {})
    audio.load(this.pokeValue).then(b => { this.pokeBuf = b }, () => {})
  }

  toggle() {
    this.unwake()
    if (this.playerValue && audio.on && !audio.playing) return this.start()
    audio.setOn(!audio.on)
    if (audio.on) this.start()
  }

  // Start animating: a sparkle right away, and the music (if it isn't on yet) starts loading for the next page.
  launch() {
    if (!audio.unlock()) return
    sfx.launch()
    this.start()
  }

  render() {
    if (!this.hasToggleTarget) return
    if (this.playerValue) {
      const playing = audio.playing
      if (this.element.dataset.playing !== String(playing)) this.dispatch("change", { detail: { playing } })
      this.element.dataset.playing = playing
      this.toggleTarget.setAttribute("aria-pressed", String(playing))
      this.toggleTarget.setAttribute("aria-label", playing ? "Pause music" : "Play music")
      return
    }
    this.toggleTarget.textContent = audio.on ? "sound on" : "sound off"
    this.toggleTarget.setAttribute("aria-pressed", String(audio.on))
    this.toggleTarget.setAttribute("aria-label", audio.on ? "Turn sound off" : "Turn sound on")
  }

  scatter() {
    const now = performance.now()
    if (now - this.lastScatter < 600) return
    this.lastScatter = now
    audio.play(this.scatterBuf, { gain: .45 })
  }

  // Hero π varies its pitch a little each poke; the footer π answers a fifth higher.
  poke({ detail: { variant } = {} } = {}) {
    const rate = variant === "end" ? 1.5 : 2 ** ((Math.random() * 4 - 2) / 12)
    audio.play(this.pokeBuf, { gain: .55, rate })
  }
}
