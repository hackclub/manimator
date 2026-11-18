import Card, { C, el, ramp, set } from "controllers/card"

const CX = 70, CY = 90, R = 40, X0 = 130, W = 160, TAU = 2 * Math.PI

// A point goes once around a circle as you scroll, and its height traces out the wave to the right.
export default class extends Card {
  build() {
    el(this.layer, "circle", { cx: CX, cy: CY, r: R, fill: "none", stroke: C.blue, "stroke-width": 3 })
    this.radius = el(this.layer, "line", { x1: CX, y1: CY, stroke: C.ink, "stroke-width": 2.5 })
    this.height = el(this.layer, "line", { stroke: C.yellow, "stroke-width": 1.5, "stroke-dasharray": "4 4" })
    this.wave = el(this.layer, "path", { fill: "none", stroke: C.yellow, "stroke-width": 3, "stroke-linejoin": "round" })
    this.dot = el(this.layer, "circle", { r: 4.5, fill: C.yellow })
  }

  draw(p) {
    const t = TAU * ramp(p, .1, .9), px = CX + R * Math.cos(t), py = CY - R * Math.sin(t), hx = X0 + t / TAU * W
    let d = `M${X0},${CY}`
    for (let s = .04; s < t; s += .04) d += `L${(X0 + s / TAU * W).toFixed(1)},${(CY - R * Math.sin(s)).toFixed(1)}`
    this.wave.setAttribute("d", `${d}L${hx.toFixed(1)},${py.toFixed(1)}`)
    set(this.radius, { x2: px, y2: py })
    set(this.height, { x1: px, y1: py, x2: hx, y2: py })
    set(this.dot, { cx: px, cy: py })
  }
}
