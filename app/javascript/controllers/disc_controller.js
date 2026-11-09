import { Controller } from "@hotwired/stimulus"

// The corner player's CD (onboarding/pledge.html.erb). Its rim is a circle, which is the 1:1 Lissajous figure
// (x = sin(t + π/2), y = sin t). While music plays it morphs, point by point as manim's Transform does, through the
// figures of musical intervals, with a light running along the curve; on pause it folds back into the circle.
// sound_controller says when playback starts and stops (sound:change).

const N = 240          // points on every curve, so any two can morph into each other
const R = 34           // radius in the 96×96 viewBox
const MORPH = 1100     // ms per morph
const HOLD = 3600      // ms on each interval before the next
const DISC = { a: 1, b: 1, d: Math.PI / 2, color: "var(--blue)", caption: "felt piano · 1:1 is a circle" }
const INTERVALS = [
  { a: 3, b: 2, color: "var(--yellow)", caption: "3:2 is a perfect fifth" },
  { a: 4, b: 3, color: "var(--green)", caption: "4:3 is a perfect fourth" },
  { a: 5, b: 4, color: "var(--red)", caption: "5:4 is a major third" },
  { a: 2, b: 1, color: "var(--blue)", caption: "2:1 is an octave" }
].map(interval => ({ d: Math.PI / 4, ...interval }))

const curve = ({ a, b, d }) => Array.from({ length: N }, (_, i) => {
  const t = (i / N) * Math.PI * 2
  return [48 + R * Math.sin(a * t + d), 48 - R * Math.sin(b * t)]
})
const ease = k => k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
const path = (points, close) => "M" + points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L") + (close ? "Z" : "")

export default class extends Controller {
  static targets = ["curve", "comet", "caption"]

  connect() {
    this.still = matchMedia("(prefers-reduced-motion: reduce)").matches
    this.disc = curve(DISC)
    this.shapes = INTERVALS.map(curve)
    this.shown = this.disc
    this.playing = false
    this.show(DISC)
    this.draw()
    // The music may have started before this controller connected (it starts with the page after a click).
    if (this.element.dataset.playing === "true") this.change({ detail: { playing: true } })
  }

  disconnect() { cancelAnimationFrame(this.raf) }

  change({ detail: { playing } }) {
    if (playing === this.playing) return
    this.playing = playing
    this.morphTo(playing ? 0 : -1)
    if (!this.raf) this.raf = requestAnimationFrame(this.tick)
  }

  morphTo(index) {
    this.index = index
    this.from = this.shown
    this.to = index < 0 ? this.disc : this.shapes[index]
    this.started = performance.now()
    this.show(index < 0 ? DISC : INTERVALS[index])
  }

  show({ color, caption }) {
    this.curveTarget.style.stroke = color
    this.captionTarget.textContent = caption
  }

  tick = now => {
    if (this.playing && now - this.started > MORPH + HOLD) this.morphTo((this.index + 1) % INTERVALS.length)
    const k = this.still ? 1 : Math.min(1, (now - this.started) / MORPH), e = ease(k)
    this.shown = this.from.map(([x, y], i) => [x + (this.to[i][0] - x) * e, y + (this.to[i][1] - y) * e])
    this.head = ((this.head || 0) + 1.6) % N
    this.draw()
    this.raf = (this.playing || k < 1) ? requestAnimationFrame(this.tick) : null
  }

  draw() {
    this.curveTarget.setAttribute("d", path(this.shown, true))
    const comet = this.playing && !this.still
      ? Array.from({ length: 14 }, (_, j) => this.shown[(Math.floor(this.head) + j) % N]) : null
    this.cometTarget.setAttribute("d", comet ? path(comet) : "")
  }
}
