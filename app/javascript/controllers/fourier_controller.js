import Card, { C, SERIF, el, ramp, set } from "controllers/card"

const CX = 78, CY = 90, AMP = 30, X0 = 190, W = 118, MAX = 8, TAU = 2 * Math.PI
const HUES = [C.blue, C.teal, C.purple, C.green, C.red, C.blue, C.teal, C.purple]

// The k-th circle spins at the k-th odd frequency, sized to build a square wave.
const radius = j => 4 * AMP / (Math.PI * (2 * j + 1))
const height = (t, n) => { let y = 0; for (let j = 0; j < n; j++) y += radius(j) * Math.sin((2 * j + 1) * t); return y }

// Circles riding on circles. Scrolling turns them and adds more, and the traced wave sharpens into a square wave.
export default class extends Card {
  build() {
    this.circles = []
    this.arms = []
    this.chain = el(this.layer, "g")
    this.height = el(this.layer, "line", { stroke: C.yellow, "stroke-width": 1.5, "stroke-dasharray": "4 4" })
    el(this.layer, "path", { d: `M${X0},${CY}V${CY - AMP}H${X0 + W / 2}V${CY + AMP}H${X0 + W}V${CY}`, fill: "none", stroke: C.faint, "stroke-width": 1.5, "stroke-dasharray": "2 4" })
    this.wave = el(this.layer, "path", { fill: "none", stroke: C.yellow, "stroke-width": 3, "stroke-linejoin": "round" })
    this.count = el(this.layer, "text", { x: 300, y: 32, "text-anchor": "end", "font-family": SERIF, "font-style": "italic", "font-size": 16, fill: C.ink })
  }

  draw(p) {
    const n = Math.round(1 + (MAX - 1) * ramp(p, .1, .9))
    if (n !== this.n) this.resize(n)
    this.spinChain(.9 + p * TAU * 3)
  }

  // Add or drop circles, and redraw the wave they trace.
  resize(n) {
    this.n = n
    while (this.circles.length > n) { this.circles.pop().remove(); this.arms.pop().remove() }
    while (this.circles.length < n) {
      const j = this.circles.length
      this.circles.push(el(this.chain, "circle", { r: radius(j), fill: "none", stroke: HUES[j], "stroke-width": j ? 2 : 2.5 }))
      this.arms.push(el(this.chain, "line", { stroke: C.ink, "stroke-width": j ? 1.5 : 2 }))
    }
    let d = `M${X0},${CY}`
    for (let i = 1; i <= 240; i++) {
      const t = i / 240 * TAU
      d += `L${(X0 + t / TAU * W).toFixed(1)},${(CY - height(t, n)).toFixed(1)}`
    }
    this.wave.setAttribute("d", d)
    this.count.textContent = n === 1 ? "1 circle" : `${n} circles`
  }

  // Each circle rides on the end of the arm before it; the last arm's tip draws the wave.
  spinChain(t) {
    let x = CX, y = CY
    this.circles.forEach((c, j) => {
      const k = 2 * j + 1, nx = x + radius(j) * Math.cos(k * t), ny = y - radius(j) * Math.sin(k * t)
      set(c, { cx: x, cy: y })
      set(this.arms[j], { x1: x, y1: y, x2: nx, y2: ny })
      x = nx
      y = ny
    })
    set(this.height, { x1: x, y1: y, x2: X0 + t / TAU * W, y2: y })
  }
}
