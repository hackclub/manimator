import Card, { C, SERIF, clamp, el, ramp } from "controllers/card"

const U = 19, X = 64, Y = 24, MAX = 7
const HUES = [C.yellow, C.blue, C.green, C.red, C.purple, C.teal, C.yellow]

// 1 + 3 + 5 + … = n². Scrolling wraps one more L around the square, and the next odd number joins the sum.
export default class extends Card {
  build() {
    this.ls = Array.from({ length: MAX }, (_, i) => this.ell(i + 1))
    this.sum = el(this.layer, "text", { x: 210, y: 84, "font-family": SERIF, "font-style": "italic", "font-size": 14, fill: C.faint })
    this.label = el(this.layer, "text", { x: 210, y: 116, "font-family": SERIF, "font-style": "italic", "font-size": 28, fill: C.ink })
  }

  draw(p) {
    // Each L fades in as the count reaches it, so the square grows smoothly rather than in jumps.
    const grown = 1 + (MAX - 1) * ramp(p, .1, .9), n = Math.round(grown)
    this.ls.forEach((g, k) => g.setAttribute("opacity", clamp(grown - k).toFixed(2)))
    const odds = Array.from({ length: n }, (_, i) => 2 * i + 1)
    this.sum.textContent = n > 4 ? `1 + 3 + … + ${2 * n - 1}` : odds.join(" + ")
    this.label.textContent = `= ${n}²`
  }

  // The k-th L: 2k − 1 unit cells around the (k − 1) square, with faint cell lines.
  ell(k) {
    const a = X + (k - 1) * U, b = Y + (k - 1) * U, e = X + k * U, f = Y + k * U, hue = HUES[k - 1]
    const g = el(this.layer, "g")
    let cells = ""
    for (let j = 1; j < k; j++) cells += `M${a},${Y + j * U}H${e}M${X + j * U},${b}V${f}`
    if (cells) el(g, "path", { d: cells, stroke: hue, "stroke-opacity": .4, "stroke-width": 1, fill: "none" })
    el(g, "path", { d: `M${a},${Y}H${e}V${f}H${X}V${b}H${a}Z`, fill: hue, "fill-opacity": .3, stroke: hue, "stroke-width": 2.5 })
    return g
  }
}
