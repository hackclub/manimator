import Knob, { C, SERIF, clamp, drawn, el, set } from "controllers/knob"

const AX = 66, AY = 117, U = 11, MAX = 5
const type = { "font-family": SERIF, "font-style": "italic", "text-anchor": "middle" }
const poly = pts => `M${pts.map(p => p.join(",")).join("L")}Z`

// A right triangle with whole-number legs. Drag the top corner and the three
// squares resize, but the two small ones always add up to the big one.
export default class extends Knob {
  build() {
    this.a = 3
    this.b = 4
    const square = hue => el(this.layer, "path", { fill: hue, "fill-opacity": .3, stroke: hue, "stroke-width": 2.5, "stroke-linejoin": "round", "data-d": "sf", ...drawn })
    this.sa = square(C.yellow)
    this.sb = square(C.blue)
    this.sc = square(C.red)
    this.tri = el(this.layer, "path", { fill: "none", stroke: C.ink, "stroke-width": 3, "stroke-linejoin": "round", "data-d": "s", ...drawn })
    this.corner = el(this.layer, "path", { fill: "none", stroke: C.ink, "stroke-width": 1.5 })
    this.labels = ["a²", "b²", "c²"].map(t => el(this.layer, "text", { ...type, "font-size": 15, fill: C.ink, "data-d": "o" }, t))

    el(this.layer, "text", { ...type, x: 252, y: 82, "font-size": 18, fill: C.ink, "data-d": "o" }, "a² + b² = c²")
    const sum = el(this.layer, "text", { ...type, x: 252, y: 112, "font-size": 18, "data-d": "o" })
    ;[this.na, this.nb, this.nc] = [[C.yellow, ""], [C.blue, " + "], [C.red, " = "]].map(([hue, op]) => {
      el(sum, "tspan", { fill: C.ink }, op)
      return el(sum, "tspan", { fill: hue })
    })
    this.knob("Top corner of the right triangle")
  }

  drag(p) {
    this.a = clamp(Math.round((p.x - AX) / U), 1, MAX)
    this.b = clamp(Math.round((AY - p.y) / U), 1, MAX)
  }

  nudge(dx, dy) {
    this.a = clamp(this.a + dx, 1, MAX)
    this.b = clamp(this.b + dy, 1, MAX)
  }

  render() {
    const { a, b } = this, A = [AX, AY], Cc = [AX + a * U, AY], B = [AX + a * U, AY - b * U], off = [-b * U, -a * U]
    const shift = (p, [dx, dy]) => [p[0] + dx, p[1] + dy]
    this.sa.setAttribute("d", poly([A, Cc, shift(Cc, [0, a * U]), shift(A, [0, a * U])]))
    this.sb.setAttribute("d", poly([Cc, B, shift(B, [b * U, 0]), shift(Cc, [b * U, 0])]))
    this.sc.setAttribute("d", poly([A, B, shift(B, off), shift(A, off)]))
    this.tri.setAttribute("d", poly([A, Cc, B]))
    this.corner.setAttribute("d", `M${Cc[0] - 6},${AY}V${AY - 6}H${Cc[0]}`)

    // Labels sit in each square's middle, and hide when the square is too small for them.
    const mids = [[AX + a * U / 2, AY + a * U / 2], [Cc[0] + b * U / 2, AY - b * U / 2], [AX + (a - b) * U / 2, AY - (a + b) * U / 2]]
    const sides = [a, b, Math.hypot(a, b)]
    this.labels.forEach((t, i) => set(t, { x: mids[i][0], y: mids[i][1] + 5, display: sides[i] >= 2 ? "inline" : "none" }))

    this.na.textContent = a * a
    this.nb.textContent = b * b
    this.nc.textContent = a * a + b * b
    this.place(...B)
    this.aria(a * a + b * b, 2, 2 * MAX * MAX, `a is ${a}, b is ${b}: ${a * a} + ${b * b} = ${a * a + b * b}`)
  }
}
