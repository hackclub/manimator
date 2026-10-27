import Knob, { C, SERIF, clamp, drawn, el, fmt, set } from "controllers/knob"

const CX = 82, CY = 96, R = 56, PI = Math.PI
const type = { "font-family": SERIF, "font-style": "italic", "text-anchor": "middle" }

// e^(iθ) walks the unit circle. Drag θ from 0 to π and it lands on −1.
export default class extends Knob {
  build() {
    this.theta = .35 * PI
    el(this.layer, "circle", { cx: CX, cy: CY, r: R, fill: "none", stroke: C.blue, "stroke-width": 2.5, "data-d": "s", ...drawn })
    this.arc = el(this.layer, "path", { fill: "none", stroke: C.yellow, "stroke-width": 3.5, "stroke-linecap": "round", "data-d": "s", ...drawn })
    this.radius = el(this.layer, "line", { x1: CX, y1: CY, stroke: C.ink, "stroke-width": 2, "data-d": "s", ...drawn })

    this.formula = el(this.layer, "text", { ...type, x: 230, y: 88, "font-size": 27, fill: C.ink, stroke: C.ink, "stroke-width": .8, style: "stroke-dasharray:600", "data-d": "t" })
    el(this.formula, "tspan", {}, "e")
    this.power = el(this.formula, "tspan", { dy: -13, "font-size": 17 })
    this.rest = el(this.formula, "tspan", { dy: 13 })
    this.value = el(this.layer, "text", { ...type, x: 230, y: 120, "font-size": 18, fill: C.ink, "data-d": "o" })
    this.angle = el(this.layer, "text", { ...type, x: 230, y: 146, "font-size": 15, fill: C.faint, "data-d": "o" })
    this.knob("Angle θ, from 0 to π")
  }

  // Only the top half matters; below the axis, snap to whichever end is closer.
  drag(p) {
    const a = Math.atan2(CY - p.y, p.x - CX)
    this.aim(a >= 0 ? a : a > -PI / 2 ? 0 : PI)
  }

  nudge(dx, dy) { this.aim(this.theta + (dx || dy) * PI / 20) }

  // Close to π counts as π, so the landing is easy to hit.
  aim(t) { this.theta = t > .97 * PI ? PI : clamp(t, 0, PI) }

  render() {
    const t = this.theta, x = CX + R * Math.cos(t), y = CY - R * Math.sin(t), home = t === PI
    this.arc.setAttribute("d", `M${CX + R},${CY}A${R},${R} 0 0 0 ${x.toFixed(2)},${y.toFixed(2)}`)
    set(this.radius, { x2: x, y2: y })
    this.place(x, y)

    this.power.textContent = home ? "iπ" : "iθ"
    this.rest.textContent = home ? " + 1 = 0" : ""
    this.value.textContent = home ? "" : `= ${fmt(Math.cos(t))} + ${fmt(Math.sin(t))}i`
    this.angle.textContent = home ? "θ = π" : `θ = ${fmt(t / PI)}π`
    this.aria(fmt(t / PI), 0, 1, home ? "theta is pi: e to the i pi plus 1 equals 0" : `theta is ${fmt(t / PI)} pi, e to the i theta is ${this.value.textContent.slice(2)}`)
  }
}
