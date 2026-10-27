import Knob, { C, SERIF, clamp, drawn, el, set } from "controllers/knob"

// f(t) = t² on [0, 2], whose true area is 8/3.
const X = t => 50 + 120 * t, Y = f => 150 - 27 * f
const AREA = 8 / 3, MIN = 2, MAX = 100, T0 = 70, T1 = 290, TY = 168
const type = { "font-family": SERIF, "font-style": "italic", "font-size": 16 }

// Left Riemann sums. Drag the slider to add rectangles and watch the sum close in on the area.
export default class extends Knob {
  build() {
    this.n = 7
    this.rects = []
    this.group = el(this.layer, "g")
    let d = `M${X(0)},${Y(0)}`
    for (let t = .05; t <= 2.001; t += .05) d += `L${X(t).toFixed(1)},${Y(t * t).toFixed(1)}`
    el(this.layer, "path", { d, fill: "none", stroke: C.yellow, "stroke-width": 3, "data-d": "s", ...drawn })

    this.count = el(this.layer, "text", { ...type, x: 62, y: 36, fill: C.ink, "data-d": "o" })
    this.sum = el(this.layer, "text", { ...type, x: 62, y: 58, fill: C.blue, "data-d": "o" })
    el(this.layer, "text", { ...type, x: 62, y: 80, fill: C.yellow, "data-d": "o" }, `∫ = ${AREA.toFixed(3)}`)

    el(this.layer, "line", { x1: T0, y1: TY, x2: T1, y2: TY, stroke: C.line, "stroke-width": 3, "stroke-linecap": "round" })
    this.fill = el(this.layer, "line", { x1: T0, y1: TY, y2: TY, stroke: C.blue, "stroke-width": 3, "stroke-linecap": "round" })
    this.knob("Number of rectangles")
  }

  // Squared so the small counts, where the change is easiest to see, get more room.
  // It starts at 2 because a single left rectangle has no height at all.
  drag(p) { this.n = Math.round(MIN + (MAX - MIN) * clamp((p.x - T0) / (T1 - T0), 0, 1) ** 2) }

  nudge(dx, dy) { this.n = clamp(this.n + (dx || dy), MIN, MAX) }

  render() {
    const n = this.n, dt = 2 / n, w = X(dt) - X(0)
    while (this.rects.length > n) this.rects.pop().remove()
    while (this.rects.length < n) this.rects.push(el(this.group, "rect", { fill: C.blue, "fill-opacity": .28, stroke: C.blue, "data-d": "o" }))

    let sum = 0
    this.rects.forEach((r, i) => {
      const f = (i * dt) ** 2
      sum += f * dt
      set(r, { x: X(i * dt), y: Y(f), width: w, height: Y(0) - Y(f), "stroke-width": Math.min(1.5, w / 5) })
    })

    this.count.textContent = `n = ${n}`
    this.sum.textContent = `Σ = ${sum.toFixed(3)}`
    const x = T0 + (T1 - T0) * Math.sqrt((n - MIN) / (MAX - MIN))
    this.fill.setAttribute("x2", x)
    this.place(x, TY)
    this.aria(n, MIN, MAX, `${n} rectangles, sum ${sum.toFixed(3)}, true area ${AREA.toFixed(3)}`)
  }
}
