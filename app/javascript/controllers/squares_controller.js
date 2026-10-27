import Knob, { C, SERIF, clamp, drawn, el } from "controllers/knob"

const U = 19, X = 64, Y = 24, MAX = 7
const HUES = [C.yellow, C.blue, C.green, C.red, C.purple, C.teal, C.yellow]

// 1 + 3 + 5 + … = n². Drag the corner and the next odd number wraps around as an L.
export default class extends Knob {
  build() {
    this.n = 4
    this.ls = []
    this.group = el(this.layer, "g")
    this.sum = el(this.layer, "text", { x: 210, y: 84, "font-family": SERIF, "font-style": "italic", "font-size": 14, fill: C.faint, "data-d": "o" })
    this.label = el(this.layer, "text", { x: 210, y: 116, "font-family": SERIF, "font-style": "italic", "font-size": 28, fill: C.ink, "data-d": "o" })
    this.knob("Odd numbers in the square")
  }

  drag(p) { this.n = clamp(Math.round((p.x - X + p.y - Y) / 2 / U), 1, MAX) }

  nudge(dx, dy) { this.n = clamp(this.n + (dx || dy), 1, MAX) }

  render() {
    const n = this.n
    while (this.ls.length > n) this.ls.pop().remove()
    while (this.ls.length < n) this.ls.push(this.ell(this.ls.length + 1))

    const odds = Array.from({ length: n }, (_, i) => 2 * i + 1)
    this.sum.textContent = n > 4 ? `1 + 3 + … + ${2 * n - 1}` : odds.join(" + ")
    this.label.textContent = `= ${n}²`
    this.place(X + n * U, Y + n * U)
    this.aria(n, 1, MAX, `${odds.join(" + ")} = ${n * n}, which is ${n} squared`)
  }

  // The k-th L: 2k − 1 unit cells around the (k − 1) square, with faint cell lines.
  ell(k) {
    const a = X + (k - 1) * U, b = Y + (k - 1) * U, e = X + k * U, f = Y + k * U, hue = HUES[k - 1]
    const g = el(this.group, "g")
    let cells = ""
    for (let j = 1; j < k; j++) cells += `M${a},${Y + j * U}H${e}M${X + j * U},${b}V${f}`
    if (cells) el(g, "path", { d: cells, stroke: hue, "stroke-opacity": .4, "stroke-width": 1, fill: "none", "data-d": "o" })
    const outline = el(g, "path", { d: `M${a},${Y}H${e}V${f}H${X}V${b}H${a}Z`, fill: hue, "fill-opacity": .3, stroke: hue, "stroke-width": 2.5, "data-d": "sf", ...drawn })
    this.pop(outline)
    return g
  }
}
