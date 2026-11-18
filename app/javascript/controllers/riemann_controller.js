import Card, { C, SERIF, el, ramp, set } from "controllers/card"

// f(t) = t² on [0, 2], whose true area is 8/3.
const X = t => 50 + 120 * t, Y = f => 150 - 27 * f
const AREA = 8 / 3, MIN = 2, MAX = 100
const type = { "font-family": SERIF, "font-style": "italic", "font-size": 16 }

// Left Riemann sums. Scrolling adds rectangles, and the sum closes in on the area under the curve.
export default class extends Card {
  build() {
    this.rects = []
    this.group = el(this.layer, "g")
    let d = `M${X(0)},${Y(0)}`
    for (let t = .05; t <= 2.001; t += .05) d += `L${X(t).toFixed(1)},${Y(t * t).toFixed(1)}`
    el(this.layer, "path", { d, fill: "none", stroke: C.yellow, "stroke-width": 3 })

    this.count = el(this.layer, "text", { ...type, x: 62, y: 36, fill: C.ink })
    this.sum = el(this.layer, "text", { ...type, x: 62, y: 58, fill: C.blue })
    el(this.layer, "text", { ...type, x: 62, y: 80, fill: C.yellow }, `∫ = ${AREA.toFixed(3)}`)
  }

  draw(p) {
    // Squared so the small counts, where the change is easiest to see, get more of the scroll.
    const u = ramp(p, .1, .85), n = Math.round(MIN + (MAX - MIN) * u * u)
    if (n === this.n) return
    this.n = n

    const dt = 2 / n, w = X(dt) - X(0)
    while (this.rects.length > n) this.rects.pop().remove()
    while (this.rects.length < n) this.rects.push(el(this.group, "rect", { fill: C.blue, "fill-opacity": .28, stroke: C.blue }))

    let sum = 0
    this.rects.forEach((r, i) => {
      const f = (i * dt) ** 2
      sum += f * dt
      set(r, { x: X(i * dt), y: Y(f), width: w, height: Y(0) - Y(f), "stroke-width": Math.min(1.5, w / 5) })
    })
    this.count.textContent = `n = ${n}`
    this.sum.textContent = `Σ = ${sum.toFixed(3)}`
  }
}
