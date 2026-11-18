import { Controller } from "@hotwired/stimulus"

// Generation 4 of the idea step (/start/ideas/4, onboarding/ideas.html.erb). Sixteen arguments to settle, each a sketch
// π plays; a twist dealt with cards on the stage, which shows in the sketch; then a finished video about a different
// question, so you can see the three parts yours will have; then notes for your twist: the first thing to draw, a
// phrase to look up, the thing to crack. Nothing in them asks you to film or measure anything. A question of your own
// is dealt cards too (a way to tell it, which fits anything). Nothing is saved.
//
// A clip is { dur, draw(pen, t) }: it draws one frame at t seconds on a Pen, in manim's units (14.2 by 8, origin in
// the middle, y up), so the same clip plays on the stage and on a card.
const TAU = Math.PI * 2
const FLIPPED = 2.3 // seconds into a deal when your card has turned over
const LIFTED = 4 // and when it lifts away off your sketch
const SLOW = 1.6 // how much longer the deal takes than those times say: slow enough to watch the shuffle
const wait = ms => new Promise(r => setTimeout(r, ms))
const C = { blue: "#58C4DD", yellow: "#F4D345", green: "#83C167", red: "#FC6255", teal: "#5CD0B3", ink: "#ece9e2", faint: "#80868e", line: "#3a3e45", bg: "#08090a" }
const SERIF = `"Computer Modern Serif", "Latin Modern Roman", Georgia, serif`

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v
const lerp = (a, b, k) => a + (b - a) * k
const smooth = k => k * k * (3 - 2 * k)
// 0 before a, 1 after b, eased between.
const ph = (t, a, b) => smooth(clamp((t - a) / (b - a), 0, 1))
const mix = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)]
const add = (p, q) => [p[0] + q[0], p[1] + q[1]]
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c])
class Pen {
  constructor(ctx, w, h) { this.c = ctx; this.w = w; this.h = h; this.s = Math.min(w / 14.2, h / 8) }
  X(x) { return this.w / 2 + x * this.s }
  Y(y) { return this.h / 2 - y * this.s }

  paint({ stroke, fill, width = 3, alpha = 1, fillAlpha = 1, cap = "round", units } = {}) {
    const c = this.c
    if (fill) { c.globalAlpha = alpha * fillAlpha; c.fillStyle = fill; c.fill() }
    if (stroke) {
      c.globalAlpha = alpha; c.strokeStyle = stroke; c.lineCap = cap; c.lineJoin = "round"
      c.lineWidth = units ? units * this.s : Math.max(1, width * this.s / 56); c.stroke()
    }
    c.globalAlpha = 1
  }

  trace(pts, close) {
    const c = this.c
    c.beginPath()
    pts.forEach(([x, y], i) => i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y)))
    if (close) c.closePath()
  }

  poly(pts, o = {}) { this.trace(pts, o.close !== false); this.paint(o) }
  line(a, b, o = {}) { this.trace([a, b], false); this.paint({ stroke: C.ink, ...o }) }
  rect(x, y, w, h, o) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o) }
  circle(p, r, o) { this.c.beginPath(); this.c.arc(this.X(p[0]), this.Y(p[1]), r * this.s, 0, TAU); this.paint(o) }

  text(str, p, { size = .5, color = C.ink, align = "center", alpha = 1 } = {}) {
    if (alpha <= 0) return
    const c = this.c
    c.globalAlpha = alpha; c.fillStyle = color; c.font = `${size * this.s}px ${SERIF}`; c.textAlign = align; c.textBaseline = "middle"
    c.fillText(str, this.X(p[0]), this.Y(p[1]))
    c.globalAlpha = 1
  }

  // Text broken over up to three lines, no wider than maxW.
  wrap(str, p, maxW, o = {}) {
    const size = o.size ?? .5, lines = []
    let line = ""
    this.c.font = `${size * this.s}px ${SERIF}`
    for (const word of str.split(/\s+/)) {
      if (line && this.c.measureText(`${line} ${word}`).width > maxW * this.s) { lines.push(line); line = word } else line = line ? `${line} ${word}` : word
    }
    lines.push(line)
    lines.slice(0, 3).forEach((l, i) => this.text(l, [p[0], p[1] - i * size * 1.25], o))
  }

}

// ── Questions you could settle with your hands ───────────────────────────────────────────────────────────────────
// Each is a function of its twist, so the sketch changes when π deals a different one.

const pizzaPie = (p, O, r, crust) => {
  if (crust) { p.circle(O, r, { fill: "#a9793a", fillAlpha: .7, stroke: "#a9793a", width: 2 }); r *= .76 }
  p.circle(O, r, { fill: C.yellow, fillAlpha: .3, stroke: C.yellow, width: crust ? 2 : 7 })
  ;[[.45, .3], [-.4, .45], [-.1, -.5], [.5, -.35], [-.6, -.15], [.05, .05]].forEach(([x, y]) => p.circle([O[0] + x * r, O[1] + y * r], r * .13, { fill: C.red, alpha: .9 }))
}
const pizzaDeal = mode => ({
  dur: 6, seamless: true,
  draw(p, t) {
    const beat = Math.sin(t * TAU / 3) * .04, shrink = mode === "shrink" ? 1 - .28 * (.5 - .5 * Math.cos(t * TAU / 6)) : 1 + beat
    pizzaPie(p, [-3.6, 0], 2.1 * shrink, mode === "crust"); pizzaPie(p, [1.6, 0], 1.4 * (1 - beat), mode === "crust"); pizzaPie(p, [4.8, 0], 1.4 * (1 - beat), mode === "crust")
    p.text("or", [-.6, 0], { size: .6, color: C.faint })
    p.text(mode === "shrink" ? `one ${Math.round(18 * shrink)}-inch` : "one 18-inch", [-3.6, 3], { size: .56 }); p.text("two 12-inch", [3.2, 3], { size: .56 })
    if (mode === "price") { p.text("$19", [-3.6, -2.6], { size: .5, color: C.green }); p.text("$11 + $11", [3.2, -2.6], { size: .5, color: C.green }) }
    p.text({ crust: "which has more pizza, if you leave the crust?", price: "which is more pizza for your money?", shrink: "how big does the large have to be to win?" }[mode] ?? "which is more pizza?",
      [0, -3.4], { size: .5, color: C.yellow })
  }
})

const shotArc = mode => ({
  dur: 8,
  draw(p, t) {
    const far = mode === "three", moon = mode === "moon", tall = mode === "tall"
    const S = [far ? -6.3 : -5.2, tall ? -1.3 : -2], D = 4.6 - S[0] - .1, rise = 1.2 - S[1], floor = -2.9
    if (moon) for (let i = 0; i < 26; i++) p.circle([(i * 7.3 % 14.2) - 7.1, (i * 3.7 % 6) - 1.6], .03, { fill: C.ink, alpha: .5 })
    p.line([-7, floor], [7, floor], { stroke: moon ? C.faint : C.line, width: moon ? 5 : 3 })
    p.line([5, 1.2], [5, 2.5], { stroke: C.ink, width: 5 }); p.line([4, 1.2], [5, 1.2], { stroke: C.red, width: 6 }); p.line([5, floor], [5, 1.2], { stroke: C.line })
    if (tall) { // you, before: a foot shorter
      p.line([S[0] - .95, floor], [S[0] - .95, -2.15], { stroke: C.ink, width: 5, alpha: .3 }); p.circle([S[0] - .95, -1.9], .22, { fill: C.ink, alpha: .3 })
      p.line([S[0] - .6, -1.9], [S[0] - .6, S[1] + .1], { stroke: C.yellow, width: 2 }); p.text("+1 ft", [S[0] - 1.25, S[1] + .5], { size: .36, color: C.yellow })
    }
    if (moon) { p.circle([-5.6, 2.6], .7, { fill: C.blue, alpha: .7 }); p.text("Earth", [-5.6, 1.6], { size: .32, color: C.faint }) }
    p.line([S[0] - .25, floor], [S[0] - .25, S[1] - .15], { stroke: C.ink, width: 5 }); p.circle([S[0] - .25, S[1] + .1], .22, { fill: C.ink })
    const pace = moon ? .45 : 1
    ;[[36, C.blue], [45, C.yellow], [55, C.green]].forEach(([angle, color], i) => {
      const k = clamp((t * pace - .3 - i * (moon ? 1.1 : 2.2)) / (moon ? 1.1 : 1.8), 0, 1), tan = Math.tan(angle * Math.PI / 180), drop = (tan * D - rise) / D / D
      if (!k) return
      const at = dx => [S[0] + dx, S[1] + tan * dx - drop * dx * dx], pts = []
      for (let n = 0; n <= 40; n++) pts.push(at(D * k * n / 40))
      p.poly(pts, { stroke: color, width: 3, close: false, alpha: k < 1 ? 1 : .45 })
      if (k < 1) p.circle(at(D * k), .26, { fill: "#e8833a" })
      p.text(`${angle}°`, add(at(1 + i * 1.1), [-.7, .4]), { size: .4, color })
    })
    p.text({ three: "from the three-point line", moon: "on the Moon, where gravity is a sixth as strong", tall: "if you were a foot taller" }[mode] ?? "from the free-throw line", [-1, 3.4], { size: .46 })
    p.text(moon ? "the ball floats. Does the best angle change?" : "three ways in. Which one gives the ball the most room?", [0, -3.5], { size: .44, color: C.faint })
  }
})

const shortcut = mode => ({
  dur: 8,
  draw(p, t) {
    const [w, h] = { square: [3.8, 3.8], fence: [6, 1.3] }[mode] ?? [4.8, 3.6], mud = mode === "mud" ? .55 : 1, cx = -2
    const A = [cx - w / 2, -h / 2 - .2], B = [cx + w / 2, A[1]], Q = [B[0], A[1] + h], cut = Math.hypot(w, h)
    const go = Math.max(0, t - .8) * 1.9, d = Math.min(go, w + h), g = Math.min(go * mud, cut)
    p.rect(A[0], A[1], w, h, { fill: mode === "mud" ? "#7a5a34" : C.green, fillAlpha: mode === "mud" ? .35 : .16 })
    p.poly([A, B, Q], { stroke: C.line, width: 9, close: false })
    const around = d < w ? mix(A, B, d / w) : mix(B, Q, (d - w) / h), across = mix(A, Q, g / cut)
    p.poly(d < w ? [A, around] : [A, B, around], { stroke: C.blue, width: 4, close: false })
    p.line(A, across, { stroke: C.yellow, width: 4 })
    p.circle(Q, .22, { stroke: C.red, width: 4 }); p.circle(around, .2, { fill: C.blue }); p.circle(across, .2, { fill: C.yellow })
    const steps = len => Math.round(len * 12)
    p.text(`on the path: ${steps(d)} steps${d >= w + h ? " ✓" : ""}`, [4.4, .8], { size: .46, color: C.blue })
    p.text(`across: ${steps(g)} steps${g >= cut ? " ✓" : ""}`, [4.4, -.1], { size: .46, color: C.yellow })
    p.text({ square: "across a square park", fence: "past a long, thin lawn", mud: "when the grass is mud and slows you down" }[mode] ?? "across a soccer field", [0, 3.4], { size: .46 })
    p.text("who gets to the corner first?", [0, -3.5], { size: .44, color: C.faint })
  }
})

const blockCircle = mode => ({
  dur: 6,
  draw(p, t) {
    const n = (mode === "big" ? [4, 12, 28] : [4, 7, 12])[Math.floor(t / 2)], R = 2.7, O = [-2.6, 0], cell = R / n
    const inside = (i, j) => Math.hypot(i + .5, j + .5) < n
    let count = 0
    for (let i = -n; i < n; i++) for (let j = -n; j < n; j++) {
      if (!inside(i, j)) continue
      const edge = !inside(i + 1, j) || !inside(i - 1, j) || !inside(i, j + 1) || !inside(i, j - 1)
      if (mode === "outline" && !edge) continue
      count++
      const poke = Math.max(Math.hypot(Math.abs(i + .5) + .5, Math.abs(j + .5) + .5) - n, 0) // how far its far corner pokes out of the true circle
      p.rect(O[0] + i * cell, O[1] + j * cell, cell, cell, { fill: mode === "wrong" && poke > .25 ? C.red : C.green, stroke: C.bg, width: n > 14 ? 1 : 2 })
    }
    p.circle(O, R, { stroke: C.ink, width: 2, alpha: .6 })
    p.text(`${n * 2} blocks wide`, [3.8, 1.3], { size: .56 })
    p.text(mode === "outline" ? `${count} blocks in the ring` : `${count} blocks`, [3.8, .3], { size: .46, color: C.faint })
    p.text({ outline: "that's all the ring takes", wrong: "red ones stick out the most", big: "does it ever turn round?" }[mode] ?? "is it round yet?", [3.8, -1], { size: .46, color: C.yellow })
  }
})

// Rain: how wet you get is what lands on top of you (longer out = more) plus what you walk into (the same either way).
const rainRun = mode => ({
  dur: 8,
  draw(p, t) {
    const wind = mode === "wind", hat = mode === "hat", far = mode === "far" ? 4 : 1, lean = wind ? -.55 : 0, go = Math.max(0, t - .6)
    for (let i = 0; i < 70; i++) {
      const fall = (i * .618 + t * 1.3) % 1, x = ((i * 2.399) % 15) - 7.5 + lean * fall * 8, y = 4 - fall * 8
      p.line([x, y], [x + lean * .45, y - .45], { stroke: C.blue, width: 2, alpha: .35 })
    }
    ;[["walk", 5.2, .5], ["run", 2, -2.9]].forEach(([name, time, ground]) => {
      const k = clamp(go / time, 0, 1), x = lerp(-5.6, 4.4, k), top = hat ? 0 : Math.round(11 * time * k * far), front = Math.round((wind ? 46 : 20) * k * far)
      p.line([-7, ground], [7, ground], { stroke: C.line })
      p.poly([[4.9, ground], [4.9, ground + 2], [6.6, ground + 2]], { stroke: C.ink, width: 4, close: false })
      p.rect(x - .2, ground, .4, 1, { fill: C.ink }); p.circle([x, ground + 1.25], .24, { fill: C.ink })
      if (hat) p.rect(x - .55, ground + 1.55, 1.1, .16, { fill: C.yellow })
      p.text(name, [-6.6, ground + 1.9], { size: .46, align: "left" })
      p.text(`on top ${top} + in front ${front} = ${top + front} drops`, [-5.2, ground + 1.9], { size: .4, align: "left", color: k < 1 ? C.faint : C.yellow })
    })
    p.text({ wind: "with the wind blowing it into your face", hat: "holding a pizza box over your head", far: "all the way across a football field" }[mode] ?? "to the bus stop on the corner", [0, 3.5], { size: .44 })
  }
})

// Each book can stick out half a book past the one below, then a quarter, then a sixth…
const bookStack = mode => ({
  dur: 8,
  draw(p, t) {
    const [most, tall, pace] = { cards: [52, .07, 9], far: [31, .11, 5] }[mode] ?? [4, .44, .9]
    const L = 2.4, top = -2, n = clamp(1 + Math.floor(Math.max(0, t - .5) * pace), 1, most), edge = -5
    p.rect(-7.1, top - 1.6, 7.1 + edge, 1.6, { fill: C.line }); p.line([edge, top], [edge, 3], { stroke: C.faint, width: 1.5, alpha: .5 })
    let reach = 0
    for (let i = n; i >= 1; i--) {
      reach += L / (2 * i)
      p.rect(edge + reach - L, top + (n - i) * tall, L, tall, { fill: i % 2 ? C.blue : C.teal, stroke: C.bg, width: tall < .2 ? 1 : 2 })
    }
    if (mode === "far") p.line([edge + 2 * L, top], [edge + 2 * L, 3], { stroke: C.yellow, width: 2 })
    p.text(`${n} ${mode === "cards" ? "cards" : n === 1 ? "book" : "books"}`, [3.6, 2.2], { size: .56 })
    p.text(`the top one sticks out ${(reach / L).toFixed(2)} of its length`, [3.2, 1.2], { size: .4, color: C.faint })
    p.text(reach > L ? "the top one is past the table. Nothing fell." : "", [3.2, .3], { size: .4, color: C.yellow })
    p.text({ cards: "with a whole deck of cards", far: "until the top one is two books out" }[mode] ?? "with four books", [0, 3.5], { size: .44 })
  }
})

// ── Ten more, after Francis Su's Math Fun Facts (math.hmc.edu/funfacts): our own titles and sketches ─────────────

const rand = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const person = (p, x, ground, o = {}) => { p.line([x, ground], [x, ground + .75], { stroke: C.ink, width: 5, ...o }); p.circle([x, ground + .98], .2, { fill: C.ink, ...o }) }

const ropeLift = mode => ({
  dur: 6, seamless: true,
  draw(p, t) {
    const gap = .1 + (mode === "walk" ? .9 : .32) * (.5 - .5 * Math.cos(t * TAU / 6)), earth = [3.2, -10.2]
    if (mode === "box") { p.rect(-4.9, -1.5, 2.6, 2.6, { fill: C.blue, fillAlpha: .7 }); p.rect(-4.9 - gap, -1.5 - gap, 2.6 + 2 * gap, 2.6 + 2 * gap, { stroke: C.yellow, width: 3 }) }
    else { p.circle([-3.6, -.2], 1.3, { fill: "#e8833a", fillAlpha: .85 }); p.circle([-3.6, -.2], 1.3 + gap, { stroke: C.yellow, width: 3 }) }
    p.circle(earth, 9.6, { fill: C.blue, fillAlpha: .45, stroke: C.blue, width: 2 }); p.circle(earth, 9.6 + gap, { stroke: C.yellow, width: 3 })
    if (mode === "walk") person(p, 3.2, -.6)
    if (mode === "ant") p.circle([3.2, -.52], .07, { fill: C.ink })
    p.text(mode === "box" ? "a box" : "a basketball", [-3.6, -2.4], { size: .42 }); p.text("the whole Earth", [3.2, -2.4], { size: .42 })
    p.text({ walk: "how much extra rope before you can walk under it?", ant: "how much extra rope so an ant fits under, everywhere?" }[mode] ?? "lift the rope an inch off each. Which needs more extra rope?", [0, 3.3], { size: .46, color: C.yellow })
  }
})

const toothpicks = mode => ({
  dur: 9,
  draw(p, t) {
    const len = mode === "short" ? .5 : 1, grid = mode === "grid", many = mode === "many", n = Math.min(many ? 420 : 60, Math.floor(Math.max(0, t - .5) * (many ? 70 : 9)))
    for (let y = -3; y <= 3; y++) p.line([-6.8, y], [1.2, y], { stroke: C.line, width: 2 })
    if (grid) for (let x = -6.8; x <= 1.21; x++) p.line([x, -3], [x, 3], { stroke: C.line, width: 2 })
    let crossed = 0
    for (let i = 0; i < n; i++) {
      const cx = -6.2 + rand(i) * 6.8, cy = -2.6 + rand(i + 1000) * 5.2, a = rand(i + 2000) * Math.PI, dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2
      const hit = Math.floor(cy + dy + 10) !== Math.floor(cy - dy + 10) || (grid && Math.floor(cx + dx + 6.8) !== Math.floor(cx - dx + 6.8))
      if (hit) crossed++
      p.line([cx - dx, cy - dy], [cx + dx, cy + dy], { stroke: hit ? C.red : C.ink, width: 2.5, alpha: many ? .6 : .9 })
    }
    p.text(`${n} dropped`, [4.2, 1.7], { size: .5 }); p.text(`${crossed} touch a line`, [4.2, .8], { size: .5, color: C.red })
    if (crossed && !grid && mode !== "short") p.text(`2 × ${n} ÷ ${crossed} = ${(2 * n / crossed).toFixed(2)}`, [4.2, -.4], { size: .5, color: C.yellow })
    p.wrap({ short: "half-size toothpicks. What comes out now?", grid: "on square tiles. What comes out now?", many: "how many drops until it settles?" }[mode] ?? "why does that number look familiar?", [4.2, -1.6], 5, { size: .4, color: C.yellow })
  }
})

// The same height of ring, cut from balls of different sizes.
const bead = mode => ({
  dur: 6, seamless: true,
  draw(p, t) {
    const swing = .5 - .5 * Math.cos(t * TAU / 6), h = mode === "earth" ? .5 : 1.6
    const R = mode === "earth" ? 3 + .3 * swing : mode === "tiny" ? .85 + .25 * swing : 1 + 1.5 * swing, O = [-2.6, 0], hole = Math.sqrt(R * R - h * h / 4)
    if (mode === "cube") p.rect(O[0] - R, -R, 2 * R, 2 * R, { fill: "#e8833a", fillAlpha: .85 }); else p.circle(O, R, { fill: "#e8833a", fillAlpha: .85 })
    const half = mode === "cube" ? R * .6 : hole
    p.rect(O[0] - half, -R - .1, 2 * half, 2 * R + .2, { fill: C.bg }); p.rect(O[0] - half, -R, 2 * half, 2 * R, { fill: "#e8833a", fillAlpha: .14, stroke: C.faint, width: 1.5 })
    if (mode !== "cube") [h / 2, -h / 2].forEach(y => p.line([O[0] - R - .5, y], [O[0] + R + .5, y], { stroke: C.yellow, width: 1.5, alpha: .7 }))
    p.text({ earth: "through the whole Earth", tiny: "through a marble", cube: "through a cube" }[mode] ?? "drill straight through a ball", [3.8, 1.5], { size: .5 })
    p.wrap(mode === "cube" ? "does a cube play the same trick?" : "the ring left over is always this tall", [3.8, .6], 5, { size: .38, color: C.faint })
    p.text(mode === "cube" ? "how much is left?" : "bigger ball: more left, or less?", [3.8, -.8], { size: .5, color: C.yellow })
  }
})

const slices = mode => ({
  dur: 8,
  draw(p, t) {
    const n = mode === "thin" ? 12 : 5, R = 2.5, O = [-2.4, 0], lit = mode === "end" ? (Math.floor(t / 2) % 2 ? Math.floor(n / 2) : 0) : Math.floor(t / (8 / n)) % n
    p.circle(O, R, { fill: mode === "bread" ? "#c9a36a" : "#e8833a", fillAlpha: .85 })
    for (let i = 1; i < n; i++) { const y = -R + i * 2 * R / n, half = Math.sqrt(R * R - y * y); p.line([O[0] - half, y], [O[0] + half, y], { stroke: C.bg, width: 3 }) }
    // The peel on the lit slice, both sides.
    const a0 = Math.asin(-1 + lit * 2 / n), a1 = Math.asin(-1 + (lit + 1) * 2 / n)
    ;[1, -1].forEach(side => p.poly(Array.from({ length: 13 }, (_, k) => { const a = lerp(a0, a1, k / 12); return [O[0] + side * R * Math.cos(a), R * Math.sin(a)] }), { stroke: C.yellow, width: 7, close: false }))
    p.text("every slice is the same thickness", [3.8, 1.5], { size: .44 })
    p.text(`slice ${lit + 1} of ${n}`, [3.8, .5], { size: .44, color: C.faint })
    p.wrap({ bread: "which slice gets the most crust?", thin: "cut thinner: does the answer change?", end: "is the end slice the worst deal?" }[mode] ?? "which slice gets the most peel?", [3.8, -.8], 5.4, { size: .46, color: C.yellow })
  }
})

const slackRope = mode => ({
  dur: 7, seamless: true,
  draw(p, t) {
    const lift = (mode === "inch" ? .6 : mode === "mile" ? 3.4 : 2.2) * (.5 - .5 * Math.cos(t * TAU / 7)), ground = -2
    p.rect(-6, ground - .5, 12, .5, { fill: C.green, fillAlpha: .3 })
    for (let x = -6; x <= 6.01; x += 1.2) p.line([x, ground - .5], [x, ground], { stroke: C.ink, width: 1.5, alpha: .3 })
    ;[-6, 6].forEach(x => p.line([x, ground], [x, ground + .9], { stroke: C.ink, width: 4 }))
    if (mode === "truck") { p.rect(-.9, ground, 1.8, 1.1, { fill: C.blue }); p.circle([-.5, ground], .2, { fill: C.ink }); p.circle([.5, ground], .2, { fill: C.ink }) } else person(p, 0, ground)
    p.poly([[-6, ground], [0, ground + lift], [6, ground]], { stroke: C.yellow, width: 3, close: false })
    p.text({ inch: "a rope along a football field, one inch too long", mile: "a rope a mile long, one foot too long" }[mode] ?? "a rope along a football field, one foot too long", [0, 3.3], { size: .46 })
    p.text(mode === "truck" ? "pull the middle up. Could a truck drive under?" : "pull the middle up. Could you walk under?", [0, -3.4], { size: .46, color: C.yellow })
  }
})

// Lines for each digit, one bunch crossing another; the crossings are the answer.
const lineTimes = mode => ({
  dur: 8,
  draw(p, t) {
    const [A, B, name] = { big: [[9, 9], [9, 9], "99 × 99"], three: [[1, 2, 3], [2, 1], "123 × 21"] }[mode] ?? [[2, 2], [1, 3], "22 × 13"]
    const gap = mode === "big" ? .15 : .26, O = [-2.6, -.1], reach = 2.7, at = (u, v) => [O[0] + (u + v) * Math.SQRT1_2, O[1] + (u - v) * Math.SQRT1_2]
    const bunch = digits => digits.flatMap((d, i) => Array.from({ length: d }, (_, k) => (i - (digits.length - 1) / 2) * 2.3 + (k - (d - 1) / 2) * gap))
    const vs = bunch(A), us = bunch(B), k1 = ph(t, .3, 2.2), k2 = ph(t, 2.2, 4.1)
    vs.forEach(v => p.line(at(-reach, v), at(lerp(-reach, reach, k1), v), { stroke: C.blue, width: 2.5 }))
    if (k2) us.forEach(u => p.line(at(u, -reach), at(u, lerp(-reach, reach, k2)), { stroke: C.green, width: 2.5 }))
    const dots = ph(t, 4.3, 5.1)
    if (dots) us.forEach(u => vs.forEach(v => p.circle(at(u, v), mode === "big" ? .05 : .08, { fill: C.yellow, alpha: dots })))
    p.text(name, [4.2, 1.7], { size: .9 })
    p.wrap("blue lines for the first number, green for the second", [4.2, .7], 5, { size: .34, color: C.faint })
    p.wrap({ big: "does it survive 99 × 99?", three: "where do the hundreds go?", why: "why would crossings multiply?" }[mode] ?? "count the crossings…", [4.2, -.9], 5, { size: .46, color: C.yellow })
  }
})

const mindCards = mode => ({
  dur: 8,
  draw(p, t) {
    const cards = mode === "five" ? 5 : 4, top = 2 ** cards - 1, secret = 11, w = cards === 5 ? 2.5 : 3.1, cols = cards === 5 ? 4 : 4
    for (let k = 0; k < cards; k++) {
      const x = (k - (cards - 1) / 2) * (w + .2), on = (secret >> k & 1) && t > 3, numbers = Array.from({ length: top }, (_, i) => i + 1).filter(n => n >> k & 1)
      p.rect(x - w / 2, -2.2, w, 4, { fill: "#14181d", stroke: on ? C.yellow : C.blue, width: on ? 4 : 2 })
      numbers.forEach((n, i) => p.text(`${n}`, [x - w / 2 + (i % cols + .5) * w / cols, 1.3 - Math.floor(i / cols) * (cards === 5 ? .8 : 1.4)], { size: cards === 5 ? .32 : .42, color: n === secret && t > 3 ? C.yellow : C.ink }))
    }
    p.text(`think of a number from 1 to ${top}. Which cards is it on?`, [0, 3.3], { size: .46 })
    p.text({ own: "what would your own deck look like?", three: "what if the answers were yes, no and maybe?" }[mode] ?? "π says: you picked 11. How?", [0, -3.3], { size: .46, color: C.yellow, alpha: ph(t, 4.5, 5.2) })
  }
})

const rentSplit = mode => ({
  dur: 7, seamless: true,
  draw(p, t) {
    const rooms = { chores: [["dishes", 3], ["trash", 2.2], ["bathroom", 3.4]], five: [["big", 3], ["nice", 2.4], ["ok", 2], ["small", 1.6], ["closet", 1.2]] }[mode] ?? [["big room", 3.6], ["middle", 2.6], [mode === "window" ? "no window" : "tiny", 1.8]]
    const total = rooms.reduce((s, r) => s + r[1], 0) + (rooms.length - 1) * .2
    let x = -total / 2
    rooms.forEach(([name, w], i) => {
      const price = mode === "chores" ? `${(1 + i * .5 + .4 * Math.sin(t * TAU / 7 + i * TAU / 3)).toFixed(1)} h` : `$${Math.round(1500 * w / (total - (rooms.length - 1) * .2) + 25 * Math.sin(t * TAU / 7 + i * TAU / rooms.length))}`
      p.rect(x, -1.6, w, 2.6, { fill: [C.blue, C.teal, C.green, C.yellow, C.red][i], fillAlpha: mode === "window" && i === 2 ? .12 : .3, stroke: C.ink, width: 2 })
      p.text(name, [x + w / 2, .4], { size: .36 }); p.text(price, [x + w / 2, -.6], { size: .5, color: C.yellow })
      p.circle([x + w / 2, 2], .32, { fill: [C.blue, C.teal, C.green, C.yellow, C.red][(i + 1) % rooms.length] })
      x += w + .2
    })
    p.text(mode === "chores" ? "three chores, three people" : `${rooms.length} friends, one flat, $1500 a month`, [0, 3.3], { size: .46 })
    p.text(mode === "chores" ? "who does what, so nobody's sulking?" : "what should each room cost so nobody's jealous?", [0, -3.3], { size: .46, color: C.yellow })
  }
})

const needleTurn = mode => ({
  dur: 8, seamless: true,
  draw(p, t) {
    const O = [-2.6, -.3], L = 3.8
    if (mode === "sofa") {
      p.poly([[-6, 1.4], [-.8, 1.4], [-.8, -3.2]], { stroke: C.ink, width: 4, close: false }); p.poly([[-6, 3], [.8, 3], [.8, -3.2]], { stroke: C.ink, width: 4, close: false })
      const k = .5 - .5 * Math.cos(t * TAU / 8), c = p.c
      c.save(); c.translate(p.X(lerp(-4.4, -.1, k)), p.Y(lerp(2.2, 2.1, k))); c.rotate(k * .9); c.fillStyle = C.yellow; c.fillRect(-1.3 * p.s, -.45 * p.s, 2.6 * p.s, .9 * p.s); c.restore()
    } else if (mode === "car" || mode === "zero") {
      // Three swings about an end, not one spin about the middle: the stick still ends up turned right round.
      const V = [0, 1, 2].map(i => [O[0] + L / Math.sqrt(3) * Math.cos(Math.PI / 2 + i * TAU / 3), O[1] + L / Math.sqrt(3) * Math.sin(Math.PI / 2 + i * TAU / 3)])
      const s = t / 8 * 3 % 3, leg = Math.floor(s), pivot = V[[0, 2, 1][leg]], from = V[[1, 0, 2][leg]], to = V[[2, 1, 0][leg]]
      const a0 = Math.atan2(from[1] - pivot[1], from[0] - pivot[0])
      let turn = Math.atan2(to[1] - pivot[1], to[0] - pivot[0]) - a0
      while (turn > Math.PI) turn -= TAU; while (turn < -Math.PI) turn += TAU
      V.forEach((v, i) => { const b = V[(i + 1) % 3], start = Math.atan2(b[1] - v[1], b[0] - v[0]); p.poly(Array.from({ length: 13 }, (_, k) => [v[0] + L * Math.cos(start + k / 12 * Math.PI / 3), v[1] + L * Math.sin(start + k / 12 * Math.PI / 3)]), { stroke: C.line, width: 2, close: false }) })
      const a = a0 + turn * smooth(s - leg)
      p.line(pivot, [pivot[0] + L * Math.cos(a), pivot[1] + L * Math.sin(a)], { stroke: C.yellow, width: 5 }); p.circle(pivot, .12, { fill: C.red })
    } else {
      const a = t / 8 * TAU
      p.circle(O, L / 2, { stroke: C.line, width: 2, fill: C.yellow, fillAlpha: .06 })
      p.line([O[0] - L / 2 * Math.cos(a), O[1] - L / 2 * Math.sin(a)], [O[0] + L / 2 * Math.cos(a), O[1] + L / 2 * Math.sin(a)], { stroke: C.yellow, width: 5 }); p.circle(O, .12, { fill: C.red })
    }
    p.text({ sofa: "a sofa and a corner", car: "a three-point turn", zero: "three swings, not one spin" }[mode] ?? "a sword, turned right round", [4, 1.5], { size: .5 })
    p.text({ sofa: "the hallway is one sofa wide", car: "less room than spinning on the spot", zero: "already less room than a circle" }[mode] ?? "spinning it sweeps a whole circle", [4, .5], { size: .36, color: C.faint })
    p.wrap({ sofa: "what's the biggest sofa that makes it?", car: "how narrow can the street be?", zero: "is there a smallest room at all?" }[mode] ?? "can the room be smaller?", [4, -.8], 5, { size: .46, color: C.yellow })
  }
})

const twoNotes = mode => ({
  dur: 6,
  draw(p, t) {
    const ratio = { octave: 2, clash: 16 / 15, piano: 2 ** (7 / 12) }[mode] ?? 1.5
    const wave = (y, color, f) => p.poly(Array.from({ length: 161 }, (_, i) => [-6.6 + i * .0825, y + f((i * .0825) * TAU * 4 / 13.2 - t * 2)]), { stroke: color, width: 3, close: false })
    wave(1.9, C.blue, x => .55 * Math.sin(x)); wave(.2, C.green, x => .55 * Math.sin(x * ratio)); wave(-1.9, C.yellow, x => .5 * (Math.sin(x) + Math.sin(x * ratio)))
    p.text("together", [-6.6, -.9], { size: .32, color: C.faint, align: "left" })
    p.text({ octave: "two wiggles for every one", clash: "sixteen wiggles against fifteen", piano: "a piano's version: almost three for two, not quite" }[mode] ?? "three wiggles for every two", [0, 3.3], { size: .46 })
    p.text({ octave: "why does that sound like the same note?", clash: "why does that sound awful?", piano: "why is every piano a tiny bit out of tune?" }[mode] ?? "why does that sound good?", [0, -3.4], { size: .46, color: C.yellow })
  }
})

// ── A finished one ───────────────────────────────────────────────────────────────────────────────────────────────
// What a whole video looks like, in twenty seconds and about a different question: it asks, shows what was tried, and
// shows what was found. Paper is about a tenth of a millimetre thick, and every fold doubles it.

const paperMoon = {
  dur: 21, seamless: true,
  draw(p, t) {
    const part = t < 5 ? 0 : t < 11 ? 1 : 2
    if (part === 0) {
      p.text("Can you fold a piece of paper", [0, 2.6], { size: .7, alpha: ph(t, .2, .9) }); p.text("all the way to the Moon?", [0, 1.7], { size: .7, color: C.yellow, alpha: ph(t, .8, 1.5) })
      const folds = Math.min(3, Math.floor(Math.max(0, t - 2) / .8)), w = 4.4 / 2 ** folds
      p.rect(-w / 2, -2.2, w, 2.6, { fill: C.ink, fillAlpha: .9, stroke: C.faint, width: 2 })
      p.text(folds ? `${folds} fold${folds > 1 ? "s" : ""}` : "", [0, -2.8], { size: .44, color: C.faint })
    } else if (part === 1) {
      const n = clamp(Math.floor((t - 5.4) / .55), 0, 7), layers = 2 ** n
      p.text("I tried it.", [0, 3], { size: .6 })
      p.rect(-1.6, -2.4, 3.2, Math.max(.03, layers * .028), { fill: C.ink })
      p.text(`${n} fold${n === 1 ? "" : "s"} = ${layers} layers`, [0, 1.9], { size: .5, color: C.yellow })
      p.text("After seven it wouldn't bend. It was as thick as a notebook.", [0, -3], { size: .42, color: C.faint, alpha: ph(t, 9.4, 9.9) })
    } else {
      const n = clamp(7 + Math.floor((t - 11.6) / .16), 7, 42), base = -2.6, per = 5.4 / 35, top = base + (n - 7) * per
      p.text("So I did the folding with numbers. Every fold doubles it.", [0, 3.4], { size: .44 })
      p.line([-1.5, base], [1.5, base], { stroke: C.line })
      p.rect(-.5, base, 1, Math.max(.03, top - base), { fill: C.yellow })
      ;[[17, "a house"], [27, "above Everest"], [30, "space"], [42, "the Moon"]].forEach(([folds, name]) => {
        const y = base + (folds - 7) * per, on = n >= folds
        p.line([-1.2, y], [1.2, y], { stroke: on ? C.ink : C.line, width: 2 }); p.text(`${name}`, [1.5, y], { size: .4, align: "left", color: on ? C.ink : C.faint })
        p.text(`${folds} folds`, [-1.5, y], { size: .34, align: "right", color: C.faint })
      })
      p.text(`${n} folds`, [-4.6, 0], { size: .8, color: C.yellow })
      p.text("42 folds. Past the Moon.", [-4.6, -1.2], { size: .44, alpha: ph(t, 17.6, 18.2) })
    }
    // Where you are in it.
    ;["the question", "what I tried", "what I found"].forEach((name, i) => {
      p.rect(-6.6 + i * 4.45, -3.95, 4.3, .12, { fill: i === part ? C.yellow : C.line })
      p.text(name, [-6.6 + i * 4.45 + 2.15, -3.55], { size: .34, color: i === part ? C.yellow : C.faint })
    })
  }
}

// ── What π offers ────────────────────────────────────────────────────────────────────────────────────────────────

// first: the first thing to draw. twists: the same question, bent a different way for each person, so no two videos
// come out the same; each is [the sketch's mode, the twist in words, a phrase to look up, the thing to crack].
const QUESTIONS = [
  { title: "Why is a Minecraft circle a lie?", clip: blockCircle, first: "A grid of squares with a circle over it.", twists: [
    ["outline", "how many blocks does just the outline need?", "minecraft circle generator", "how many blocks a ring takes next to how wide it is"],
    ["wrong", "which blocks are the most wrong?", "how do pixel circles work", "how far the worst block sits from a true circle"],
    ["big", "does a bigger one ever turn round?", "when does a pixel circle look round", "the size where your eyes stop seeing corners"]] },
  { title: "What's the best angle to shoot a basketball?", clip: shotArc, first: "A hoop, a dot for the ball, and one curved path between them.", twists: [
    ["three", "from the three-point line", "best arc for a three pointer", "which angle leaves the ball the most room to drop through"],
    ["tall", "if you were a foot taller", "does release height change the best shooting angle", "how the best angle moves as the shooter grows"],
    ["moon", "on the Moon", "throwing a ball on the Moon", "whether weaker gravity changes the angle or only the throw"]] },
  { title: "Is one large pizza more than two smalls?", clip: pizzaDeal, first: "One big circle and two small ones.", twists: [
    ["shrink", "how big does the large have to be to win?", "one large pizza vs two small", "the size where they tie"],
    ["crust", "what if you don't eat the crust?", "how much of a pizza is crust", "what happens to the gap when every pizza loses the same rim"],
    ["price", "which is more pizza for your money?", "pizza price per square inch", "what one square inch of each pizza costs"]] },
  { title: "Can you find π by dropping toothpicks?", clip: toothpicks, first: "Stripes, and one stick dropped at a random angle.", twists: [
    ["short", "with toothpicks half as long", "Buffon's needle", "what the number turns into when the toothpick shrinks"],
    ["grid", "on square tiles, not stripes", "Buffon's needle on a grid", "what changes when there are lines both ways"],
    ["many", "how many drops until it settles?", "Buffon's needle how many throws", "how fast the guess stops jumping about"]] },
  { title: "Do you get less wet running in the rain?", clip: rainRun, first: "Rain lines falling, and a box for you.", twists: [
    ["wind", "when the wind blows it into your face", "run or walk in the rain with wind", "what the angle of the rain does to the answer"],
    ["hat", "if you hold a pizza box over your head", "does an umbrella keep you dry when you run", "what's left to get wet once your top is covered"],
    ["far", "all the way across a football field", "walk or run in the rain", "whether the gap grows the farther you go"]] },
  { title: "How much extra rope lifts it an inch off the whole Earth?", clip: ropeLift, first: "A circle, and a slightly bigger circle round it.", twists: [
    ["box", "what if it's wrapped round a box?", "rope around the earth puzzle", "whether the shape matters at all"],
    ["walk", "how much extra until you can walk under it?", "rope around the earth raised six feet", "how much rope six feet of lift costs"],
    ["ant", "how much extra so an ant fits under, everywhere?", "rope around the equator puzzle", "why the size of the ball drops out"]] },
  { title: "How far can a stack of books lean off a table?", clip: bookStack, first: "A table edge and one rectangle hanging off it.", twists: [
    ["cards", "with a whole deck of cards", "card stacking overhang", "how far past the edge a full deck can reach"],
    ["far", "how many books until the top one is two books out?", "how far can a stack overhang a table", "how many it takes to get one whole book past the edge"],
    ["plain", "with only four books: can the top one clear the table?", "block stacking problem", "how far each book has to stick out"]] },
  { title: "How does this card trick read your mind?", clip: mindCards, first: "Four cards, and the numbers on each.", twists: [
    ["five", "with five cards, up to 31", "binary magic cards", "which numbers go on which card"],
    ["own", "with a deck you design yourself", "make your own binary magic cards", "the rule that puts a number on a card"],
    ["three", "with yes, no and maybe", "ternary magic cards", "how the trick changes when there are three answers"]] },
  { title: "Which slice of an orange gets the most peel?", clip: slices, first: "A circle, cut by level lines.", twists: [
    ["bread", "a round loaf: which slice gets the most crust?", "equal slices of a sphere surface area", "whether the fat middle slice really wins"],
    ["thin", "cut into twelve thin slices", "Archimedes hat box theorem", "whether thinner slices change who wins"],
    ["end", "is the end slice really the worst deal?", "surface area of a spherical cap", "how the end slice compares to the middle one"]] },
  { title: "Is cutting across the grass really shorter?", clip: shortcut, first: "A rectangle, the path round its edge, and the line across.", twists: [
    ["mud", "when the grass is mud and slows you down", "walking speed on grass vs pavement", "how much slower the grass has to be before the path wins"],
    ["square", "across a square park", "diagonal of a square", "how much of the walk you save"],
    ["fence", "when the lawn is long and thin: is it worth it?", "is taking a shortcut worth it", "how thin it has to be before you save almost nothing"]] },
  { title: "What's the smallest room you can turn a sword around in?", clip: needleTurn, first: "A stick spinning about its middle.", twists: [
    ["car", "turning a car round in a narrow street", "three point turn smallest space", "how much room three swings need next to one spin"],
    ["sofa", "getting a sofa round a corner", "moving sofa problem", "the biggest sofa that still makes it"],
    ["zero", "can the room be as small as you like?", "Kakeya needle problem", "whether there's a smallest room at all"]] },
  { title: "A rope along a football field is a foot too long. Can you walk under it?", clip: slackRope, first: "A flat line, then the same line pulled up into a tent.", twists: [
    ["inch", "with one inch of slack", "rope one foot longer than a football field", "how high one inch of slack lifts the middle"],
    ["mile", "along a rope a mile long", "rope one foot longer how high", "whether a longer rope lifts higher or lower"],
    ["truck", "could a truck drive under?", "rope one foot longer than a football field", "how high the middle lifts"]] },
  { title: "Can you multiply by drawing lines?", clip: lineTimes, first: "Two bunches of lines crossing two more.", twists: [
    ["big", "does it survive 99 × 99?", "line multiplication method", "what to do when one corner has more than nine dots"],
    ["three", "with three-digit numbers", "multiply by drawing lines", "where the hundreds, tens and ones live in the picture"],
    ["why", "why does counting crossings multiply?", "why does line multiplication work", "what each crossing really stands for"]] },
  { title: "Drill a hole through a ball. How much is left?", clip: bead, first: "A circle with a strip cut out of the middle.", twists: [
    ["earth", "through the whole Earth, leaving a ring an inch tall", "napkin ring problem", "why the size of the ball stops mattering"],
    ["tiny", "through a marble", "napkin ring problem", "whether a marble's ring matches a beach ball's"],
    ["cube", "what if it's a cube?", "volume of a cube with a hole", "whether a cube plays the same trick"]] },
  { title: "How do three friends split the rent without a fight?", clip: rentSplit, first: "Three rooms and three price tags.", twists: [
    ["chores", "splitting chores, not rent", "fair division of chores", "a split of chores nobody would trade"],
    ["five", "with five roommates", "rental harmony", "prices where nobody wants to swap rooms"],
    ["window", "when one room has no window", "envy free rent division", "how much cheaper the worst room has to be"]] },
  { title: "Why do some notes sound good together?", clip: twoNotes, first: "Two wavy lines, one faster than the other.", twists: [
    ["octave", "why does an octave sound like the same note?", "why do octaves sound the same", "what lines up when one wave is twice the other"],
    ["clash", "what makes two notes clash?", "why do some notes sound bad together", "what never lines up when two notes clash"],
    ["piano", "why is every piano a little out of tune?", "equal temperament explained", "how far a piano's fifth is from three-for-two"]] }
]
// A question of your own, which π can't sketch: the cards deal a way to tell it, and that fits anything.
// [nothing to sketch, the twist in words, then three things to work out]
const TELLINGS = [
  [null, "told as a courtroom trial", "Pick the two sides.", "Find each side's best piece of evidence.", "who wins, and what proved it"],
  [null, "told as a nature documentary", "Watch it happen, or find a video of it, three times.", "Say what happens in order, the way a narrator would.", "the moment it could have gone the other way"],
  [null, "told as a sports replay", "Find the one moment that decides it.", "Slow that moment right down. What do you see?", "what you'd circle on the screen"],
  [null, "told as a heist", "Write the plan: what has to happen, in order.", "Find where the plan usually goes wrong.", "the one trick that makes it work"]
]

export default class extends Controller {
  static targets = ["stage", "tag", "portrait", "text", "choices"]
  static values = { poses: Object }

  connect() {
    this.screens = new Map() // each canvas and the clip playing on it
    this.frozen = new Map()
    this.offset = 0
    this.touch = matchMedia("(hover: none)").matches
    this.tick = now => { this.draw(now); this.raf = requestAnimationFrame(this.tick) }
    this.raf = requestAnimationFrame(this.tick)
    const still = location.hash.match(/^#clips=([\d.]+)$/)
    if (still) this.sheet(+still[1]); else this.askQuestion()
  }

  disconnect() { cancelAnimationFrame(this.raf); this.gone = true }

  // For checking the clips: /start/ideas/4#clips=.8 lays every clip out, stopped 80% of the way through.
  sheet(k) {
    const clips = [["a finished one", paperMoon], ...QUESTIONS.flatMap(q => [[q.title, q.clip()], ...q.twists.map(([mode, text]) => [text, q.clip(mode)])])]
    this.element.innerHTML = `<div class="pick__choices" style="grid-template-columns:repeat(4,1fr);width:100%">${clips.map(([name]) =>
      `<div class="pick__card"><canvas></canvas><span class="pick__card-sub">${esc(name)}</span></div>`).join("")}</div>`
    this.element.querySelectorAll("canvas").forEach((canvas, i) => this.freeze(canvas, clips[i][1], k))
  }

  // ── The beats ──────────────────────────────────────────────────────────────────────────────────────────────────

  async askQuestion() {
    const shown = [0, 1, 2].map(i => QUESTIONS[(this.offset + i) % QUESTIONS.length])
    shown.forEach(q => { q.plain ??= q.clip() })
    this.perform(shown[0].plain, false)
    await this.say("Let's make a video that settles an argument for good. It's about three hours of tinkering. Which argument? Pick one, or type your own.", "speaking")
    this.cards(shown.map(q => ({ clip: q.plain, title: q.title, pick: () => this.deal(q, Math.floor(Math.random() * q.twists.length)) })),
      `<div class="pick__row"><form class="pick__ask"><input class="pick__input" maxlength="80" autocomplete="off" placeholder="or type your own argument"><button class="pick__chip" disabled>Use mine ▸</button></form>
       <button type="button" class="pick__chip" data-do="more">Show me more</button></div>`)
    const form = this.choicesTarget.querySelector("form"), input = form.querySelector("input"), mine = form.querySelector("button")
    input.addEventListener("input", () => { mine.disabled = !input.value.trim() })
    form.addEventListener("submit", e => {
      e.preventDefault()
      const title = input.value.trim()
      if (title) this.deal({ title, twists: TELLINGS, plain: this.written(title) }, Math.floor(Math.random() * TELLINGS.length))
    })
    this.on("more", () => { this.offset = (this.offset + 3) % QUESTIONS.length; this.askQuestion() })
  }

  // π deals you a twist. For one of π's questions it bends the question (and whoever else picks it gets a different
  // bend, so the videos differ, though π doesn't say so; here it's random, the real thing would deal whichever twist
  // the fewest people have). For a question of your own it's a way to tell it. Either way the deal happens on the
  // stage: three cards, a shuffle, one turns over, and the sketch changes into yours.
  async deal(q, n, again = false) {
    n %= q.twists.length
    const own = !q.clip, [mode, text] = q.twists[n], at = performance.now()
    this.perform(own ? this.written(q.title, text) : q.clip(mode), !own, { before: again ? this.screens.get(this.stageTarget)?.clip : q.plain, text, at })
    await this.say(again ? "Fine, fine. Back in the deck. Shuffling…" : own ? `"${q.title}" Ooh, I've never seen that one. I can't sketch it, but I can deal you a way to tell it. Shuffling…`
      : "Ooh. Hang on, that one comes with a twist. Shuffling…", "thinking")
    await wait(Math.max(0, at + FLIPPED * SLOW * 1000 - performance.now()))
    await this.say(`Your twist: ${text}${/[?!.]$/.test(text) ? "" : "!"}`, "tease")
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="back">◂ another question</button>
      <button type="button" class="pick__chip" data-do="again">Shuffle again</button>
      <button type="button" class="pick__chip pick__chip--go" data-do="keep">I'll take it ▸</button></div>`
    this.settle()
    this.on("back", () => this.askQuestion())
    this.on("again", () => this.deal(q, n + 1, true))
    this.on("keep", () => this.example(q, n))
  }

  // What a finished one looks like, before you're sent off to make yours.
  async example(q, n) {
    this.perform(paperMoon, false)
    await this.say("Deal. Here's a finished one, so you know where you're headed. It's about a different question, it's twenty seconds, and it has three parts.", "happy")
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<div class="pick__row"><button type="button" class="pick__chip pick__chip--go" data-do="next">Got it. Back to mine ▸</button></div>`
    this.settle()
    this.on("next", () => this.plan(q, n))
  }

  // Yours: the same three parts, and where to start on the middle one.
  async plan(q, n) {
    const own = !q.clip, [mode, text, ...notes] = q.twists[n]
    this.perform(own ? this.written(q.title, text) : q.clip(mode), !own)
    await this.say(own ? "Yours goes the same way: the question, what you tried, what you found. I have no idea what the answer is. Here's how I'd crack it."
      : "Yours goes the same way. My sketch is the question. What you tried and what you found are yours to make. Here's how I'd crack it.", "happy")
    const rows = own ? [["First", notes[0]], ["Then", notes[1]], ["Crack this", notes[2]]] : [["Draw first", q.first], ["Look it up", `“${notes[0]}”`], ["Crack this", notes[1]]]
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<div class="pick__notes">
        <p class="pick__notes-title">${esc(q.title)}<span>${esc(text)}</span></p>
        <dl>${rows.map(([what, line]) => `<dt>${what}</dt><dd>${esc(line)}</dd>`).join("")}</dl>
        <p class="pick__notes-foot">Your video is drawn with code, like my sketches. These notes${own ? "" : " and my sketch's code"} will be waiting when you start.</p>
      </div>
      <div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="back">◂ shuffle again</button>
      <button type="button" class="pick__chip pick__chip--go" data-do="next">That's my video ▸</button></div>`
    this.settle()
    this.on("back", () => this.deal(q, n + 1, true))
    this.on("next", async () => {
      await this.say("That's where this demo stops. In the real thing your prize comes next.", "hooray")
      this.choicesTarget.innerHTML = `<div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="again">◂ start over</button></div>`
      this.on("again", () => this.askQuestion())
    })
  }

  // On a phone, bring the buttons that just arrived into view.
  settle() { if (this.touch) this.choicesTarget.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" }) }

  // Your own question, written on the stage, with how you'll tell it under it.
  written(title, text) {
    return { dur: 6, seamless: true, draw: p => { p.wrap(title, [0, text ? 1.3 : .5], 11, { size: .8 }); if (text) p.text(text, [0, -1.7], { size: .56, color: C.yellow }) } }
  }

  // ── π talking ──────────────────────────────────────────────────────────────────────────────────────────────────

  // π says a line, typed out; a click finishes it early. Whatever was on offer goes away first.
  say(text, pose) {
    const turn = this.turn = Symbol()
    this.choicesTarget.replaceChildren()
    for (const canvas of this.screens.keys()) if (canvas !== this.stageTarget) { this.screens.delete(canvas); this.frozen.delete(canvas) }
    this.portraitTarget.innerHTML = `<img src="${this.posesValue[pose]}" alt="">`
    return new Promise(resolve => {
      const started = performance.now()
      const finish = () => { this.element.removeEventListener("pointerdown", finish); this.textTarget.textContent = text; if (this.turn === turn) resolve() }
      const step = now => {
        if (this.gone || this.turn !== turn || this.textTarget.textContent === text) return
        const n = Math.floor((now - started) / 1000 * 70)
        if (n >= text.length) return finish()
        this.textTarget.textContent = text.slice(0, n)
        requestAnimationFrame(step)
      }
      this.textTarget.textContent = ""
      this.element.addEventListener("pointerdown", finish)
      requestAnimationFrame(step)
    })
  }

  // Cards that each play their clip; pointing at one plays it on the stage too. With no pointer to hover with, the
  // first tap plays a card on the stage and the second chooses it.
  cards(cards, extra = "") {
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = cards.map((c, i) => `<button type="button" class="pick__card" style="--i:${i}"><canvas></canvas>
      <span class="pick__card-title">${esc(c.title)}</span><span class="pick__card-go">Choose this ▸</span></button>`).join("") + extra
    const buttons = [...this.choicesTarget.querySelectorAll(".pick__card")]
    buttons.forEach((button, i) => {
      const card = cards[i]
      this.screens.set(button.querySelector("canvas"), { clip: card.clip, t0: performance.now() })
      const show = () => {
        buttons.forEach(b => b.classList.toggle("pick__card--on", b === button))
        if (this.screens.get(this.stageTarget)?.clip !== card.clip) this.perform(card.clip, false)
      }
      button.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") show() })
      button.addEventListener("focus", show)
      button.addEventListener("click", () => { if (this.touch && !button.classList.contains("pick__card--on")) show(); else card.pick() })
    })
    if (this.touch) buttons[0]?.classList.add("pick__card--on")
  }

  on(what, run) { this.choicesTarget.querySelector(`[data-do="${what}"]`)?.addEventListener("click", run) }

  // ── The stage ──────────────────────────────────────────────────────────────────────────────────────────────────

  // sketch: whether the stage says it's π's rough sketch (your video's opening is; the cards to choose from aren't).
  // deal: when the clip arrives by being dealt ({ before, text, at }), the stage plays the deal first.
  perform(clip, sketch, deal) {
    this.screens.set(this.stageTarget, { clip, t0: performance.now(), deal })
    this.tagTarget.hidden = !sketch
  }

  // A canvas showing one moment of a clip, k of the way through.
  freeze(canvas, clip, k) {
    this.screens.set(canvas, { clip: { ...clip, seamless: true, dur: Infinity }, t0: performance.now() - k * clip.dur * 1000, still: true })
  }

  // The deal, e seconds in: the old sketch dims, three cards come up and shuffle, the middle one turns over to show
  // your twist, then it lifts away off the new sketch. True while it's still playing.
  dealing(p, { before, text }, clip, real) {
    const e = real / SLOW
    if (e > LIFTED + .5) return false
    const c = p.c, turned = e >= LIFTED - .1
    if (turned) clip.draw(p, (e - LIFTED + .1) * SLOW); else if (before) before.draw(p, real % before.dur)
    c.globalAlpha = .82 * ph(e, 0, .4) * (1 - ph(e, LIFTED - .1, LIFTED + .4)); c.fillStyle = C.bg; c.fillRect(0, 0, p.w, p.h); c.globalAlpha = 1
    const spots = [-3.6, 0, 3.6], round = ph(e, .8, 1.2) + ph(e, 1.25, 1.65), flip = ph(e, 1.8, FLIPPED), away = ph(e, LIFTED, LIFTED + .5)
    for (let i = 0; i < 3; i++) {
      // Each card moves two places round, so the one that started on the right ends in the middle: that one's yours.
      const from = Math.floor(round) % 3, k = round - Math.floor(round), yours = i === 2
      const x = lerp(spots[(i + from) % 3], spots[(i + from + 1) % 3], smooth(k)), hop = Math.sin(k * Math.PI) * (i % 2 ? .7 : -.7)
      const rise = lerp(-7, 0, ph(e, .1 + i * .12, .6 + i * .12)), drop = yours ? 0 : ph(e, 1.7, 2.2) * -8
      const grow = yours ? 1 + flip * .9 + away * .6 : 1, turn = yours ? Math.abs(Math.cos(flip * Math.PI)) : 1, face = yours && flip > .5
      c.save()
      c.translate(p.X(x), p.Y(rise + hop + drop + (yours ? flip * .2 : 0))); c.scale(grow * turn, grow); c.rotate(yours ? 0 : (i - 1) * .06)
      c.globalAlpha = yours ? 1 - away : 1
      const w = (face ? 3.2 : 2.3) * p.s, h = (face ? 2.2 : 3.2) * p.s
      c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, .18 * p.s)
      c.fillStyle = face ? C.yellow : "#14181d"; c.fill(); c.lineWidth = Math.max(1.5, p.s * .05); c.strokeStyle = face ? C.yellow : C.blue; c.stroke()
      c.fillStyle = face ? C.bg : C.blue; c.textAlign = "center"; c.textBaseline = "middle"
      if (face) {
        c.font = `${.2 * p.s}px ${SERIF}`; c.fillText("YOUR TWIST", 0, -h / 2 + .3 * p.s)
        c.font = `${.3 * p.s}px ${SERIF}`
        const lines = []; let line = ""
        for (const word of text.split(" ")) { if (line && c.measureText(`${line} ${word}`).width > w - .4 * p.s) { lines.push(line); line = word } else line = line ? `${line} ${word}` : word }
        lines.push(line)
        lines.forEach((l, n) => c.fillText(l, 0, .12 * p.s + (n - (lines.length - 1) / 2) * .4 * p.s))
      } else { c.font = `${1.3 * p.s}px ${SERIF}`; c.fillText("π", 0, 0) }
      c.restore()
    }
    return true
  }

  draw(now) {
    const ratio = window.devicePixelRatio || 1
    for (const [canvas, { clip, t0, still, deal }] of this.screens) {
      const w = Math.round(canvas.clientWidth * ratio), h = Math.round(canvas.clientHeight * ratio)
      if (!w || !h) continue
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      const ctx = canvas.getContext("2d")
      const t = still ? this.frozen.get(canvas) ?? this.frozen.set(canvas, (now - t0) / 1000).get(canvas) : (now - t0) / 1000 % clip.dur
      ctx.clearRect(0, 0, w, h)
      if (deal && this.dealing(new Pen(ctx, w, h), deal, clip, (now - deal.at) / 1000)) continue
      clip.draw(new Pen(ctx, w, h), t)
      // Each loop fades in and out, so the jump back to the start isn't a cut.
      const fade = clip.seamless ? 0 : Math.max(1 - ph(t, 0, .35), ph(t, clip.dur - .35, clip.dur))
      if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1 }
    }
  }
}
