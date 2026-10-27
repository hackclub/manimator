import Knob, { C, clamp, drawn, el, fmt, set } from "controllers/knob"

const CX = 70, CY = 90, R = 40, X0 = 130, W = 160, TAU = 2 * Math.PI

// Unwrap an angle step into (−π, π] so dragging across 0 keeps going.
const turn = d => d - TAU * Math.round(d / TAU)

// Drag the point around the circle; its height traces out the wave to the right.
export default class extends Knob {
  build() {
    this.theta = 5.2
    el(this.layer, "circle", { cx: CX, cy: CY, r: R, fill: "none", stroke: C.blue, "stroke-width": 3, "data-d": "s", ...drawn })
    this.radius = el(this.layer, "line", { x1: CX, y1: CY, stroke: C.ink, "stroke-width": 2.5, "data-d": "s", ...drawn })
    this.height = el(this.layer, "line", { stroke: C.yellow, "stroke-width": 1.5, "stroke-dasharray": "4 4", "data-d": "o" })
    this.wave = el(this.layer, "path", { fill: "none", stroke: C.yellow, "stroke-width": 3, "stroke-linejoin": "round", "data-d": "s", ...drawn })
    this.knob("Angle around the circle")
  }

  drag(p) {
    const a = Math.atan2(CY - p.y, p.x - CX)
    this.theta = clamp(this.theta + turn(a - (this.last ?? this.theta)), 0, TAU)
    this.last = a
  }

  release() {
    super.release()
    this.last = null
  }

  nudge(dx, dy) { this.theta = clamp(this.theta + (dx || dy) * Math.PI / 12, 0, TAU) }

  render() {
    const t = this.theta, px = CX + R * Math.cos(t), py = CY - R * Math.sin(t), hx = X0 + t / TAU * W
    let d = `M${X0},${CY}`
    for (let s = .04; s < t; s += .04) d += `L${(X0 + s / TAU * W).toFixed(1)},${(CY - R * Math.sin(s)).toFixed(1)}`
    this.wave.setAttribute("d", `${d}L${hx.toFixed(1)},${py.toFixed(1)}`)
    set(this.radius, { x2: px, y2: py })
    set(this.height, { x1: px, y1: py, x2: hx, y2: py })
    this.place(px, py)
    const deg = Math.round(t * 180 / Math.PI)
    this.aria(deg, 0, 360, `${deg} degrees, height ${fmt(Math.sin(t))}`)
  }
}
