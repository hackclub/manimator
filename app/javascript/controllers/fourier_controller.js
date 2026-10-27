import Knob, { C, SERIF, calm, clamp, drawn, el, set } from "controllers/knob"

const CX = 78, CY = 90, AMP = 30, X0 = 190, W = 118, MAX = 8, TAU = 2 * Math.PI
const T0 = 200, T1 = 300, TY = 166
const HUES = [C.blue, C.teal, C.purple, C.green, C.red, C.blue, C.teal, C.purple]

// The k-th circle spins at the k-th odd frequency, sized to build a square wave.
const radius = j => 4 * AMP / (Math.PI * (2 * j + 1))
const height = (t, n) => { let y = 0; for (let j = 0; j < n; j++) y += radius(j) * Math.sin((2 * j + 1) * t); return y }

// Circles riding on circles. Drag the slider to add one; the traced wave gets closer to the square wave.
export default class extends Knob {
  build() {
    this.n = 3
    this.t = .9
    this.circles = []
    this.arms = []
    this.chain = el(this.layer, "g")
    this.height = el(this.layer, "line", { stroke: C.yellow, "stroke-width": 1.5, "stroke-dasharray": "4 4", "data-d": "o" })
    el(this.layer, "path", { d: `M${X0},${CY}V${CY - AMP}H${X0 + W / 2}V${CY + AMP}H${X0 + W}V${CY}`, fill: "none", stroke: C.faint, "stroke-width": 1.5, "stroke-dasharray": "2 4", "data-d": "o" })
    this.wave = el(this.layer, "path", { fill: "none", stroke: C.yellow, "stroke-width": 3, "stroke-linejoin": "round", "data-d": "s", ...drawn })
    this.count = el(this.layer, "text", { x: 300, y: 32, "text-anchor": "end", "font-family": SERIF, "font-style": "italic", "font-size": 16, fill: C.ink, "data-d": "o" })

    el(this.layer, "line", { x1: T0, y1: TY, x2: T1, y2: TY, stroke: C.line, "stroke-width": 3, "stroke-linecap": "round" })
    this.fill = el(this.layer, "line", { x1: T0, y1: TY, y2: TY, stroke: C.blue, "stroke-width": 3, "stroke-linecap": "round" })
    this.knob("Number of circles")
    this.spin()
  }

  disconnect() {
    cancelAnimationFrame(this.raf)
    this.seen?.disconnect()
    super.disconnect()
  }

  // Turn the circles slowly while the card is on screen, unless motion is reduced.
  spin() {
    if (calm()) return
    this.seen = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting })
    this.seen.observe(this.element)
    let last = performance.now()
    const loop = now => {
      if (this.visible) { this.t = (this.t + (now - last) / 1000 * .7) % TAU; this.spinChain() }
      last = now
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  drag(p) { this.n = Math.round(1 + (MAX - 1) * clamp((p.x - T0) / (T1 - T0), 0, 1)) }

  nudge(dx, dy) { this.n = clamp(this.n + (dx || dy), 1, MAX) }

  render() {
    const n = this.n
    while (this.circles.length > n) { this.circles.pop().remove(); this.arms.pop().remove() }
    while (this.circles.length < n) {
      const j = this.circles.length
      this.circles.push(el(this.chain, "circle", { r: radius(j), fill: "none", stroke: HUES[j], "stroke-width": j ? 2 : 2.5, "data-d": "s", ...drawn }))
      this.arms.push(el(this.chain, "line", { stroke: C.ink, "stroke-width": j ? 1.5 : 2 }))
      this.pop(this.circles[j])
    }

    let d = `M${X0},${CY}`
    for (let i = 1; i <= 240; i++) {
      const t = i / 240 * TAU
      d += `L${(X0 + t / TAU * W).toFixed(1)},${(CY - height(t, n)).toFixed(1)}`
    }
    this.wave.setAttribute("d", d)
    this.count.textContent = n === 1 ? "1 circle" : `${n} circles`

    const x = T0 + (T1 - T0) * (n - 1) / (MAX - 1)
    this.fill.setAttribute("x2", x)
    this.place(x, TY)
    this.aria(n, 1, MAX, this.count.textContent)
    this.spinChain()
  }

  // Each circle rides on the end of the arm before it; the last arm's tip draws the wave.
  spinChain() {
    let x = CX, y = CY
    this.circles.forEach((c, j) => {
      const k = 2 * j + 1, nx = x + radius(j) * Math.cos(k * this.t), ny = y - radius(j) * Math.sin(k * this.t)
      set(c, { cx: x, cy: y })
      set(this.arms[j], { x1: x, y1: y, x2: nx, y2: ny })
      x = nx
      y = ny
    })
    set(this.height, { x1: x, y1: y, x2: X0 + this.t / TAU * W, y2: y })
  }
}
