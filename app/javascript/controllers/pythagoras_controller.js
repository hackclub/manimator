import Card, { C, SERIF, el, ramp, set } from "controllers/card"

const AX = 66, AY = 117, U = 11, TAU = 2 * Math.PI
const type = { "font-family": SERIF, "font-style": "italic", "text-anchor": "middle" }
const poly = pts => `M${pts.map(p => p.join(",")).join("L")}Z`
const shift = (p, [dx, dy]) => [p[0] + dx, p[1] + dy]

// A right triangle that reshapes as you scroll, passing through 3-4-5 mid-window. The three squares
// resize with it, but the two small ones always add up to the big one.
export default class extends Card {
  build() {
    const square = hue => el(this.layer, "path", { fill: hue, "fill-opacity": .3, stroke: hue, "stroke-width": 2.5, "stroke-linejoin": "round" })
    this.sa = square(C.yellow)
    this.sb = square(C.blue)
    this.sc = square(C.red)
    this.tri = el(this.layer, "path", { fill: "none", stroke: C.ink, "stroke-width": 3, "stroke-linejoin": "round" })
    this.corner = el(this.layer, "path", { fill: "none", stroke: C.ink, "stroke-width": 1.5 })
    this.labels = ["a²", "b²", "c²"].map(t => el(this.layer, "text", { ...type, "font-size": 15, fill: C.ink }, t))

    el(this.layer, "text", { ...type, x: 252, y: 82, "font-size": 18, fill: C.ink }, "a² + b² = c²")
    const sum = el(this.layer, "text", { ...type, x: 252, y: 112, "font-size": 18 })
    ;[this.na, this.nb, this.nc] = [[C.yellow, ""], [C.blue, " + "], [C.red, " = "]].map(([hue, op]) => {
      el(sum, "tspan", { fill: C.ink }, op)
      return el(sum, "tspan", { fill: hue })
    })
  }

  draw(p) {
    const u = ramp(p, .1, .9) - .5, a = 3 + 1.5 * Math.sin(TAU * u), b = 3 + Math.cos(TAU * u)
    const P = [AX, AY], Q = [AX + a * U, AY], T = [AX + a * U, AY - b * U], off = [-b * U, -a * U]
    this.sa.setAttribute("d", poly([P, Q, shift(Q, [0, a * U]), shift(P, [0, a * U])]))
    this.sb.setAttribute("d", poly([Q, T, shift(T, [b * U, 0]), shift(Q, [b * U, 0])]))
    this.sc.setAttribute("d", poly([P, T, shift(T, off), shift(P, off)]))
    this.tri.setAttribute("d", poly([P, Q, T]))
    this.corner.setAttribute("d", `M${Q[0] - 6},${AY}V${AY - 6}H${Q[0]}`)

    // Labels sit in each square's middle, and hide when the square is too small for them.
    const mids = [[AX + a * U / 2, AY + a * U / 2], [Q[0] + b * U / 2, AY - b * U / 2], [AX + (a - b) * U / 2, AY - (a + b) * U / 2]]
    const sides = [a, b, Math.hypot(a, b)]
    this.labels.forEach((t, i) => set(t, { x: mids[i][0], y: mids[i][1] + 5, display: sides[i] >= 2 ? "inline" : "none" }))

    // Whole numbers keep the line short, and adding the rounded ones keeps it true.
    const sa = Math.round(a * a), sb = Math.round(b * b)
    this.na.textContent = sa
    this.nb.textContent = sb
    this.nc.textContent = sa + sb
  }
}
