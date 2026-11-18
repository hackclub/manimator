import Card, { C, SERIF, el, fmt, ramp, set } from "controllers/card"

const CX = 82, CY = 96, R = 56, PI = Math.PI
const type = { "font-family": SERIF, "font-style": "italic", "text-anchor": "middle" }

// e^(iθ) walks the unit circle as you scroll, and by the time the card is mid-window it has turned by π and landed on −1.
export default class extends Card {
  build() {
    el(this.layer, "circle", { cx: CX, cy: CY, r: R, fill: "none", stroke: C.blue, "stroke-width": 2.5 })
    this.arc = el(this.layer, "path", { fill: "none", stroke: C.yellow, "stroke-width": 3.5, "stroke-linecap": "round" })
    this.radius = el(this.layer, "line", { x1: CX, y1: CY, stroke: C.ink, "stroke-width": 2 })
    this.dot = el(this.layer, "circle", { r: 4.5, fill: C.yellow })

    this.formula = el(this.layer, "text", { ...type, x: 230, y: 88, "font-size": 27, fill: C.ink })
    el(this.formula, "tspan", {}, "e")
    this.power = el(this.formula, "tspan", { dy: -13, "font-size": 17 })
    this.rest = el(this.formula, "tspan", { dy: 13 })
    this.value = el(this.layer, "text", { ...type, x: 230, y: 120, "font-size": 18, fill: C.ink })
    this.angle = el(this.layer, "text", { ...type, x: 230, y: 146, "font-size": 15, fill: C.faint })
  }

  draw(p) {
    const t = PI * ramp(p, .15, .65), x = CX + R * Math.cos(t), y = CY - R * Math.sin(t), home = t === PI
    this.arc.setAttribute("d", `M${CX + R},${CY}A${R},${R} 0 0 0 ${x.toFixed(2)},${y.toFixed(2)}`)
    set(this.radius, { x2: x, y2: y })
    set(this.dot, { cx: x, cy: y })
    this.power.textContent = home ? "iπ" : "iθ"
    this.rest.textContent = home ? " + 1 = 0" : ""
    this.value.textContent = home ? "" : `= ${fmt(Math.cos(t))} + ${fmt(Math.sin(t))}i`
    this.angle.textContent = home ? "θ = π" : `θ = ${fmt(t / PI)}π`
  }
}
