import { Controller } from "@hotwired/stimulus"

// Generation 14 of the idea step (/start/ideas/14, onboarding/ideas.html.erb). Generation 13's bet, with an ending
// that says what to do. "Change a number and watch" left everyone asking which number, so each what-if now comes
// with what scene two actually is ("set blocks_wide to 500 and zoom in on the edge"). π takes your bet without
// passing judgement on it. And the ending, which used to fizzle into grey text, is the one place you can name the
// video, on the story's own input: optional, and the button beside it is the way out. Nothing is saved.
//
// A clip is { dur, draw(pen, t) }: it draws one frame at t seconds on a Pen, in manim's units (14.2 by 8, origin in
// the middle, y up), so the same clip plays on the stage and on a card.
const TAU = Math.PI * 2
const HELD = 1.7 // seconds into a deal when your card is face up and holding still
const TUCKED = 3.5 // when it starts tucking away into the corner
const DRAWN = 4.1 // when it's gone and the redrawn sketch starts playing, alone
const ASKED = 5.3 // when π asks its one question
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

// ── Questions out of your own life ───────────────────────────────────────────────────────────────────────────────
// Each is a function of its what-if, so the sketch changes when the card turns over, and of s, whose s.v (once you've
// typed one) is your own number in place of π's.

const pizzaPie = (p, O, r, crust) => {
  if (crust) { p.circle(O, r, { fill: "#a9793a", fillAlpha: .7, stroke: "#a9793a", width: 2 }); r *= .76 }
  p.circle(O, r, { fill: C.yellow, fillAlpha: .3, stroke: C.yellow, width: crust ? 2 : 7 })
  ;[[.45, .3], [-.4, .45], [-.1, -.5], [.5, -.35], [-.6, -.15], [.05, .05]].forEach(([x, y]) => p.circle([O[0] + x * r, O[1] + y * r], r * .13, { fill: C.red, alpha: .9 }))
}
const pizzaDeal = (mode, s) => ({
  dur: 6, seamless: true,
  draw(p, t) {
    const beat = Math.sin(t * TAU / 3) * .04, big = s?.v ? clamp(s.v, 8, 26) / 18 : 1, shrink = big * (mode === "shrink" ? 1 - .28 * (.5 - .5 * Math.cos(t * TAU / 6)) : 1 + beat)
    pizzaPie(p, [-3.6, 0], 2.1 * shrink, mode === "crust"); pizzaPie(p, [1.6, 0], 1.4 * (1 - beat), mode === "crust"); pizzaPie(p, [4.8, 0], 1.4 * (1 - beat), mode === "crust")
    p.text("or", [-.6, 0], { size: .6, color: C.faint })
    p.text(`one ${Math.round(18 * (mode === "shrink" ? shrink : big))}-inch`, [-3.6, 3], { size: .56 }); p.text("two 12-inch", [3.2, 3], { size: .56 })
    if (mode === "price") { p.text("$19", [-3.6, -2.6], { size: .5, color: C.green }); p.text("$11 + $11", [3.2, -2.6], { size: .5, color: C.green }) }
    p.text({ crust: "which has more pizza, if you leave the crust?", price: "which is more pizza for your money?", shrink: "how big does the large have to be to win?" }[mode] ?? "which is more pizza?",
      [0, -3.4], { size: .5, color: C.yellow })
  }
})

const shotArc = (mode, s) => ({
  dur: 8,
  draw(p, t) {
    const far = mode === "three", moon = mode === "moon", tall = mode === "tall"
    const S = [far ? -6.3 : -5.2, (tall ? -1.3 : -2) + (s?.v ? (clamp(s.v / 12, 4, 7.5) - 5.5) * .41 : 0)], D = 4.6 - S[0] - .1, rise = 1.2 - S[1], floor = -2.9
    if (moon) for (let i = 0; i < 26; i++) p.circle([(i * 7.3 % 14.2) - 7.1, (i * 3.7 % 6) - 1.6], .03, { fill: C.ink, alpha: .5 })
    p.line([-7, floor], [7, floor], { stroke: moon ? C.faint : C.line, width: moon ? 5 : 3 })
    p.line([5, 1.2], [5, 2.5], { stroke: C.ink, width: 5 }); p.line([4, 1.2], [5, 1.2], { stroke: C.red, width: 6 }); p.line([5, floor], [5, 1.2], { stroke: C.line })
    if (tall) { // you, before: a foot shorter
      p.line([S[0] - .95, floor], [S[0] - .95, -2.15], { stroke: C.ink, width: 5, alpha: .3 }); p.circle([S[0] - .95, -1.9], .22, { fill: C.ink, alpha: .3 })
      p.line([S[0] - .6, -1.9], [S[0] - .6, S[1] + .1], { stroke: C.yellow, width: 2 }); p.text("+1 ft", [S[0] - 1.25, S[1] + .5], { size: .36, color: C.yellow })
    }
    if (moon) { p.circle([-6.2, 2.1], .6, { fill: C.blue, alpha: .7 }); p.text("Earth", [-6.2, 1.25], { size: .32, color: C.faint }) }
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

const blockCircle = (mode, s) => ({
  dur: 6,
  draw(p, t) {
    // d blocks across. An odd width has a block dead centre; an even one has a corner there.
    const d = s?.v ? clamp(Math.round(s.v), 3, 128) : 2 * (mode === "big" ? [4, 12, 28] : [4, 7, 12])[Math.floor(t / 2)], n = d / 2, off = d % 2 ? 0 : .5
    const R = 2.7, O = [-2.6, 0], cell = R / n, reach = Math.ceil(n) + 1
    const inside = (i, j) => Math.hypot(i + off, j + off) < n
    let count = 0
    for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) {
      if (!inside(i, j)) continue
      const edge = !inside(i + 1, j) || !inside(i - 1, j) || !inside(i, j + 1) || !inside(i, j - 1)
      if (mode === "outline" && !edge) continue
      count++
      const poke = Math.max(Math.hypot(Math.abs(i + off) + .5, Math.abs(j + off) + .5) - n, 0) // how far its far corner pokes out of the true circle
      p.rect(O[0] + (i + off - .5) * cell, O[1] + (j + off - .5) * cell, cell, cell, { fill: mode === "wrong" && poke > .25 ? C.red : C.green, stroke: C.bg, width: d > 28 ? 1 : 2 })
    }
    p.circle(O, R, { stroke: C.ink, width: 2, alpha: .6 })
    p.text(`${d} blocks wide`, [3.8, 1.3], { size: .56 })
    p.text(mode === "outline" ? `${count} blocks in the ring` : `${count} blocks`, [3.8, .3], { size: .46, color: C.faint })
    p.text({ outline: "that's all the ring takes", wrong: "red ones stick out the most", big: "does it ever turn round?" }[mode] ?? "is it round yet?", [3.8, -1], { size: .46, color: C.yellow })
  }
})

// Rain: how wet you get is what lands on top of you (longer out = more) plus what you walk into (the same either way).
const rainRun = (mode, s) => ({
  dur: 8,
  draw(p, t) {
    const wind = mode === "wind", hat = mode === "hat", far = s?.v ? clamp(s.v, 5, 500) / 50 : mode === "far" ? 4 : 1, lean = wind ? -.55 : 0, go = Math.max(0, t - .6)
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
const bookStack = (mode, s) => ({
  dur: 8,
  draw(p, t) {
    const own = s?.v ? clamp(Math.round(s.v), 1, 60) : 0, [most, tall, pace] = own ? [own, Math.min(.44, 4.6 / own), Math.max(.9, own / 5)] : { cards: [52, .07, 9], far: [31, .11, 5] }[mode] ?? [4, .44, .9]
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
    p.text(own ? "" : { cards: "with a whole deck of cards", far: "until the top one is two books out" }[mode] ?? "with four books", [0, 3.5], { size: .44 })
  }
})

const rand = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

// A hundred players after the same drop. Each gets it on some try; most of them not by the try you'd expect.
const lootDrop = (mode, s) => ({
  dur: 10,
  draw(p, t) {
    const base = s?.v ? clamp(Math.round(s.v), 2, 2000) : 20, N = mode === "event" ? Math.max(2, Math.round(base / 2)) : base, pity = Math.round(base * 1.5), k = Math.floor(clamp((t - .6) / 7, 0, 1) * 2 * N), miss = Math.log(1 - 1 / N)
    const tries = i => Math.ceil(Math.log(1 - rand(i) * .999) / miss)
    let got = 0, late = 0
    for (let i = 0; i < 100; i++) {
      const need = mode === "two" ? tries(i + 7) + tries(i + 300) : mode === "pity" ? Math.min(tries(i + 7), pity) : tries(i + 7), has = need <= k
      if (has) got++
      if (need > N) late++
      p.rect(-6.4 + (i % 10) * .56, 2.1 - Math.floor(i / 10) * .56, .44, .44, { fill: has ? C.yellow : C.line, fillAlpha: has ? 1 : .8 })
    }
    p.text("100 players, same boss", [-3.65, 3.2], { size: .42, color: C.faint })
    p.text(`a 1 in ${base} drop`, [3.6, 2.4], { size: .6 })
    p.text({ pity: `with a pity timer: it's yours on try ${pity}`, two: "and you need two of them", event: `double-drop weekend: 1 in ${N}` }[mode] ?? "", [3.6, 1.6], { size: .4, color: C.teal })
    p.text(`try ${k}`, [3.6, .7], { size: .5, color: C.faint })
    p.text(`${got} of them have ${mode === "two" ? "both" : "it"}`, [3.6, -.1], { size: .5, color: C.yellow })
    if (k >= N) p.wrap(`after ${N} tries, ${late} still weren't done`, [3.6, -1.4], 5.6, { size: .46, color: C.red })
  }
})

// Coin-flip games: the longest run of losses is longer than feels fair.
const loseStreak = (mode, s) => ({
  dur: 8,
  draw(p, t) {
    const n = s?.v ? clamp(Math.round(s.v), 3, 60) : mode === "long" ? 50 : 20, shown = Math.min(n, Math.floor(Math.max(0, t - .4) * n / 3.5)), win = mode === "win"
    const lost = i => rand(i + 91) < (mode === "good" ? .4 : .5), hit = i => lost(i) !== win
    let best = 0, at = 0, run = 0
    for (let i = 0; i < shown; i++) { run = hit(i) ? run + 1 : 0; if (run > best) { best = run; at = i - run + 1 } }
    for (let i = 0; i < shown; i++) {
      const x = -6.5 + (i % 10) * .62, y = 2.2 - Math.floor(i / 10) * .8, lit = best > 1 && i >= at && i < at + best
      p.rect(x, y, .5, .5, { fill: lost(i) ? C.red : C.green, fillAlpha: lit ? 1 : .45, stroke: lit ? C.ink : undefined, width: 2 })
      p.text(lost(i) ? "L" : "W", [x + .25, y + .25], { size: .28, color: C.bg })
    }
    p.text(mode === "long" ? `${n} games this weekend` : `${n} games tonight`, [3.7, 2], { size: .6 })
    p.text(mode === "good" ? "and you win 60% of them" : "every one a coin flip", [3.7, 1.1], { size: .44, color: mode === "good" ? C.teal : C.faint })
    p.text(win ? `best winning streak: ${best}` : `worst losing streak: ${best}`, [3.7, 0], { size: .5, color: win ? C.green : C.red })
    p.text(win ? "got better, or got lucky?" : "bad, or just unlucky?", [3.7, -1.3], { size: .5, color: C.yellow })
  }
})

const birthdays = (mode, s) => ({
  dur: 6, seamless: true,
  draw(p, t) {
    const n = s?.v ? clamp(Math.round(s.v), 2, 80) : mode === "grade" ? 60 : mode === "month" ? 5 : 25, mine = mode === "mine", days = mode === "month" ? 12 : 365
    const R = 2.7, O = [-2.8, 0], at = i => [O[0] + R * Math.cos(i / n * TAU + 1.57), O[1] + R * Math.sin(i / n * TAU + 1.57)]
    let none = 1
    for (let i = 0; i < n; i++) none *= mine ? (i ? 364 / 365 : 1) : (days - i) / days
    for (let i = 0; i < (mine ? 1 : n); i++) for (let j = i + 1; j < n; j++) p.line(at(i), at(j), { stroke: C.blue, width: 1, alpha: mine ? .6 : clamp(6 / n, .05, .5) })
    const a = mine ? 0 : Math.floor(t * 3) % n, b = (a + 1 + Math.floor(rand(Math.floor(t * 3)) * (n - 1))) % n
    p.line(at(a), at(b), { stroke: C.yellow, width: 3 })
    for (let i = 0; i < n; i++) p.circle(at(i), n > 30 ? .1 : .16, { fill: i === a || i === b ? C.yellow : C.ink })
    if (mine) p.text("you", add(at(0), [0, .45]), { size: .36, color: C.yellow })
    p.text({ grade: `your whole grade: ${n} people`, month: `you and ${n - 1} friends` }[mode] ?? `${n} people in your class`, [3.8, 2], { size: .52 })
    p.text(`${mine ? n - 1 : n * (n - 1) / 2} pairs to check`, [3.8, 1.1], { size: .46, color: C.blue })
    p.wrap(`chance ${mine ? "someone shares yours" : mode === "month" ? "two share a birth month" : "two share a birthday"}: ${Math.round((1 - none) * 100)}%`, [3.8, 0], 5.6, { size: .5, color: C.yellow })
  }
})

// ── A finished one ───────────────────────────────────────────────────────────────────────────────────────────────
// What a whole video looks like, in twenty seconds: it asks, shows what was tried, and shows what was found.

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
      p.text(`${n} folds`, [-4.9, 1.6], { size: .8, color: C.yellow })
      p.text("Past the Moon.", [-4.9, .7], { size: .44, alpha: ph(t, 17.6, 18.2) })
    }
    ;["asks", "pokes at it", "shows what turned up"].forEach((name, i) => {
      p.rect(-6.6 + i * 4.45, -3.95, 4.3, .12, { fill: i === part ? C.yellow : C.line })
      p.text(name, [-6.6 + i * 4.45 + 2.15, -3.55], { size: .34, color: i === part ? C.yellow : C.faint })
    })
  }
}

// ── What π offers ────────────────────────────────────────────────────────────────────────────────────────────────

// whatifs: each finishes the sentence "What if…", and is [the sketch's mode, the what-if, the mystery π leaves you
// with, where the rabbit hole starts, the bet: π's question and the two sides you can take, what scene two is: the thing you'd do to find out]; name is what π would call the video if you don't; range is the slider's [least, most, step]; ask is π's one question, given the number it guessed; go is the button that takes your answer; unit says your number in words. code is the one line of π's code you see: [what comes before the number, π's number for a given what-if, what comes after, what to put in its place]. Three per question for now; the real thing wants five or six, dealt so that
// each person is shown a different three.
const feet = v => `${Math.floor(v / 12)}'${v % 12}"`
const QUESTIONS = [
  { title: "Why is a Minecraft circle a lie?", name: "The Cursed Circle", range: [5, 128, 1], ask: v => `I made it ${v} blocks wide. How wide is the thing you're really building?`, go: "That's my build", unit: v => `${v} blocks wide`, code: ["blocks_wide = ", m => m === "big" ? 56 : 24, "", "the width of something you've really built"], clip: blockCircle, whatifs: [
    ["outline", "you only build the outline?", "Count the blocks in the ring next to how wide it is. There's a pattern hiding in there.", "minecraft circle generator", ["Make it twice as wide. Does the ring need twice the blocks, or more?", "Twice", "More than twice"], "double blocks_wide and count the ring again"],
    ["wrong", "you hunt down the most wrong blocks?", "Which blocks sit furthest from the real circle? Could you ever fix them?", "how do pixel circles work", ["Where do the most wrong blocks hide: on the diagonals, or by the flat sides?", "On the diagonals", "By the flat sides"], "zoom right in on one red block and measure how far it pokes out"],
    ["big", "you just keep making it bigger?", "Does it ever actually turn round, or do the corners only hide?", "when does a pixel circle look round", ["Keep going bigger. Does it ever turn truly round?", "It gets there", "Never. The corners just hide"], "set blocks_wide to 500 and zoom in on the edge"]] },
  { title: "Why haven't I got the rare drop yet?", name: "Where's My Drop", range: [2, 500, 1], ask: v => `I guessed 1 in ${v}. What are the real odds on the thing you're grinding for?`, go: "Those are my odds", unit: v => `a 1 in ${v} drop`, code: ["drop_rate = 1 / ", () => 20, "", "the real odds of the thing you're grinding for"], clip: lootDrop, whatifs: [
    ["pity", "the game has a pity timer?", "How much does a guaranteed drop really help the unluckiest players?", "pity system probability", ["Does a pity timer rescue a lot of players, or only a few?", "A lot", "Only a few"], "move the pity timer later and later, and count who's still waiting each time"],
    ["two", "you need two of them?", "Does needing two take twice as long, or is it worse than that?", "expected tries for two rare drops", ["Needing two: is that twice the grind, or worse?", "Twice the grind", "Worse"], "run it for one drop, then for two, and put the two grids side by side"],
    ["event", "it's double-drop weekend?", "Double the rate: do half as many players miss out, or fewer?", "drop rate probability after n tries", ["Double the drop rate. Do half as many players miss out, or far fewer?", "Half as many", "Far fewer"], "run the normal rate and the doubled one side by side and count the grey squares"]] },
  { title: "I lost five in a row. Am I bad or unlucky?", name: "Five in a Row", range: [5, 60, 1], ask: v => `I guessed ${v} games. How many do you really play?`, go: "That's my night", unit: v => `${v} games`, code: ["games = ", m => m === "long" ? 50 : 20, "", "how many you really play"], clip: loseStreak, whatifs: [
    ["good", "you actually win 60% of your games?", "How much shorter do the losing streaks get when you're good?", "longest losing streak probability", ["If you win 60%, do the losing streaks get much shorter, or barely?", "Much shorter", "Barely"], "nudge the win chance from 50 to 60 and line the worst streaks up"],
    ["long", "you play all weekend?", "More games, longer streaks. How fast do they grow?", "longest run in n coin flips", ["Play twice as many games. Does your worst streak double?", "It doubles", "It barely grows"], "go from 20 games to 40 to 80 and plot the worst streak each time"],
    ["win", "you count winning streaks?", "Is a six-win streak proof you got better, or the same coin?", "hot hand fallacy", ["Six wins in a row: proof you got better, or the same coin?", "I got better", "Same coin"], "let a fair coin play your night a thousand times and count the six-win streaks"]] },
  { title: "Does anyone in my class share a birthday?", name: "Birthday Twins", range: [3, 80, 1], ask: v => `I guessed ${v} people. How many is it really, for you?`, go: "That's how many", unit: v => `${v} people`, code: ["people = ", m => m === "grade" ? 60 : m === "month" ? 5 : 25, "", "the size of your actual class"], clip: birthdays, whatifs: [
    ["grade", "it's your whole grade?", "How many people until a match is basically certain? It's far fewer than 365.", "birthday paradox", ["How many people before a shared birthday is nearly certain?", "About 60", "More like 300"], "add one person at a time and watch the chance climb"],
    ["mine", "it has to be YOUR birthday?", "Why is matching yours so much harder than matching anyone's?", "birthday paradox same birthday as me", ["In a class of 25, is someone sharing YOUR birthday better or worse than a 1 in 10 shot?", "Better", "Worse"], "draw both side by side: lines from you only, and lines between everyone"],
    ["month", "it only has to be the same month?", "How few friends do you need before a same-month match is a safe bet?", "birthday problem months", ["You and four friends. Two born in the same month: likelier than not?", "Likelier than not", "Probably not"], "add one friend at a time until it tips past half"]] },
  { title: "Is one large pizza more than two smalls?", name: "Pizza Math", range: [10, 22, 1], ask: v => `I guessed an ${v}-inch large. How big is the large at your pizza place?`, go: "That's my pizza place", unit: v => `a ${v}-inch large`, code: ["large = ", () => 18, "  # inches", "the large at your pizza place"], clip: pizzaDeal, whatifs: [
    ["shrink", "the large keeps shrinking?", "At what size do they tie? It isn't where you'd guess.", "one large pizza vs two small", ["To match two 12-inch smalls, does the large have to be twice as wide?", "Yes, twice as wide", "No, far less"], "shrink the large an inch at a time, with both amounts as bars next to it"],
    ["crust", "nobody eats the crust?", "Take the same rim off every pizza. Who loses more?", "how much of a pizza is crust", ["Take the same rim off every pizza. Who loses more?", "The one large", "The two smalls"], "take the same rim off each and show what's left as two bars"],
    ["price", "you count the money?", "What does one bite of each actually cost?", "pizza price per square inch", ["$19 for the large, $22 for two smalls. Which is more pizza per dollar?", "The large", "The two smalls"], "divide each price by how much pizza it buys and race the two bars"]] },
  { title: "What's the best angle to shoot a basketball?", name: "Nothing but Net", range: [54, 84, 1], ask: v => `I drew the shooter ${feet(v)}. How tall are you?`, go: "That's me", unit: v => feet(v), code: ["shooter_height = ", () => 66, "  # inches", "your own height"], clip: shotArc, whatifs: [
    ["three", "you shoot from the three-point line?", "Does backing up change the best angle, or only how hard you throw?", "best arc for a three pointer", ["Back up to the three-point line. Does the best angle change, or only how hard you throw?", "The angle changes", "Only the throw"], "walk the shooter back a step at a time and see which arc still drops in"],
    ["tall", "you were a foot taller?", "Does the best angle move when the shooter grows? Which way?", "does release height change shooting angle", ["Grow a foot. Does your best angle go up, or down?", "Up", "Down"], "raise the shooter a few inches at a time and watch the best arc"],
    ["moon", "you played on the Moon?", "Weaker gravity: a different angle, or the same angle and a softer throw?", "throwing a ball on the Moon", ["On the Moon: a different best angle, or the same angle and a softer throw?", "Different angle", "Same angle, softer"], "turn gravity down to a sixth and see if the arcs change shape or only slow down"]] },
  { title: "How far can a stack of books lean off a table?", name: "The Leaning Tower", range: [1, 60, 1], ask: v => `I stacked ${v}. How many would you stack?`, go: "That's my stack", unit: v => `${v} books`, code: ["books = ", m => m === "cards" ? 52 : m === "far" ? 31 : 4, "", "how many are on your shelf"], clip: bookStack, whatifs: [
    ["cards", "it's a whole deck of cards?", "How far past the edge can 52 cards reach before they go?", "card stacking overhang", ["A whole deck. Can the top card end up more than two cards past the edge?", "Yes", "No way"], "stack all 52 and measure how far out the top card got"],
    ["far", "you want the top one two whole books out?", "How many books does that take? More than you own?", "how far can a stack overhang a table", ["Getting the top book two whole books out: fewer than 20 books, or more?", "Fewer than 20", "More than 20"], "keep adding books until the top one is two lengths out, and count them"],
    ["plain", "you've only got four books?", "Four just about does it. What's the trick to where each one sits?", "block stacking problem", ["With enough books, could the top one lean out as far as you like?", "Yes, forever", "No, there's a limit"], "add books ten at a time and plot how far the top one reaches"]] },
  { title: "Do you get less wet running in the rain?", name: "Run or Walk", range: [10, 300, 10], ask: v => `I guessed ${v} metres. How far is your real walk?`, go: "That's my walk", unit: v => `${v} metres`, code: ["distance = ", m => m === "far" ? 200 : 50, "  # metres", "your real walk home"], clip: rainRun, whatifs: [
    ["wind", "the wind blows it in your face?", "Does running still win when the rain comes at you sideways?", "run or walk in the rain with wind", ["Wind in your face. Does running still win?", "Running still wins", "Walking wins now"], "tilt the rain a little at a time and watch the two totals"],
    ["hat", "you hold a pizza box over your head?", "Once your top is covered, is there any point running?", "does an umbrella help when you run", ["Your head's covered. Is there any point running now?", "Still worth it", "Makes no difference"], "cover your head and send three runners at three speeds"],
    ["far", "it's a whole football field to cover?", "Does the gap between running and walking grow the farther you go?", "walk or run in the rain", ["Across a whole field, does running's lead grow, or stay the same?", "It grows", "It stays the same"], "make the trip longer and longer and plot running against walking"]] }
]

export default class extends Controller {
  static targets = ["stage", "tag", "portrait", "text", "choices"]
  static values = { poses: Object }

  connect() {
    this.screens = new Map() // each canvas and the clip playing on it
    this.frozen = new Map()
    this.touch = matchMedia("(hover: none)").matches
    this.order = QUESTIONS.map((q, i) => [[0, 1, 3, 5].includes(i) ? i : 6 + Math.random(), q]).sort((a, b) => a[0] - b[0]).map(([, q]) => q) // a build, a game, a classroom and a sport lead, so the first page isn't all for one kind of person
    this.offset = 0
    this.tick = now => { this.draw(now); this.raf = requestAnimationFrame(this.tick) }
    this.raf = requestAnimationFrame(this.tick)
    const still = location.hash.match(/^#clips=([\d.]+)$/)
    if (still) this.sheet(+still[1]); else this.askQuestion()
  }

  disconnect() { cancelAnimationFrame(this.raf); this.gone = true }

  // For checking the clips: /start/ideas/14#clips=.8 lays every clip out, stopped 80% of the way through.
  sheet(k) {
    const clips = [["a finished one", paperMoon], ...QUESTIONS.flatMap(q => [[q.title, q.clip()], ...q.whatifs.map(([mode, text]) => [`what if ${text}`, q.clip(mode)])])]
    this.element.innerHTML = `<div class="pick__choices" style="grid-template-columns:repeat(4,1fr);width:100%">${clips.map(([name]) =>
      `<div class="pick__card"><canvas></canvas><span class="pick__card-sub">${esc(name)}</span></div>`).join("")}</div>`
    this.element.querySelectorAll("canvas").forEach((canvas, i) => this.freeze(canvas, clips[i][1], k))
  }

  // ── The beats ──────────────────────────────────────────────────────────────────────────────────────────────────

  async askQuestion(again) {
    const shown = [0, 1, 2, 3].map(i => this.order[(this.offset + i) % this.order.length])
    shown.forEach(q => { q.plain ??= q.clip() })
    this.deals = null
    this.tagTarget.hidden = true
    this.room("")
    this.perform(shown[0].plain)
    await this.say(again ? "Which one, then?" : "You're making a video about something that's actually bugged you. I'll draw the first scene. Which one?", "speaking", again)
    this.cards(shown.map(q => ({ clip: q.plain, title: q.title, pick: () => this.pull(q) })),
      `<div class="pick__row"><button type="button" class="story__choice" data-do="more">Show me the other four</button></div>`)
    this.choicesTarget.classList.add("pick__choices--four")
    this.mine = {} // a new question: no number of yours yet
    this.on("more", () => { this.offset = (this.offset + 4) % this.order.length; this.askQuestion(true) })
  }

  // π has the what-if itself, out loud; the card turns over on the stage without being asked and holds while π
  // keeps quiet, then tucks away so the redrawn sketch plays by itself, and only then does π ask its one question.
  // The times are fixed: clicking hurries π's typing, never the card. (Whoever else picks this question gets a
  // different what-if, so the videos differ, though π doesn't say so; here it's random.)
  async pull(q, last) {
    const left = q.whatifs.map((w, n) => n).filter(n => n !== last), n = left[Math.floor(Math.random() * left.length)]
    const [mode, text] = q.whatifs[n], at = performance.now(), turn = this.deals = Symbol(), until = s => wait(Math.max(0, at + s * 1000 - performance.now()))
    // The stage is as big as the words under it leave room for: fix that room, so it doesn't jump about.
    if (!this.touch) this.room("220px") // what π's question will need: the stage grows once, now, and then keeps its size
    this.tagTarget.hidden = true
    this.perform(q.clip(mode, this.mine ??= {}), { before: last === undefined ? q.plain : this.screens.get(this.stageTarget)?.clip, text, at })
    await this.say(last === undefined ? "Ooh, I like that one. Wait. Wait wait wait. What if…" : "Not that one? Okay, okay. What if…", "thinking")
    await until(DRAWN)
    if (this.deals !== turn) return
    this.tag(q.name)
    await this.say("Ha. Drew it. That's scene one of your video.", "hooray")
    await until(ASKED)
    if (this.deals !== turn) return
    this.yours(q, n)
  }

  // The one thing π asks: the number it guessed, on the story's slider. The sketch redraws as you drag, the line of
  // π's code shows your number going in, and the button is the way out. Under it, the two what-ifs π didn't pick:
  // one tap swaps to either, at once, so the what-if you leave with is one you chose.
  async yours(q, n, swapped) {
    const [mode, text, asks] = q.whatifs[n], mine = this.mine ??= {}, [before, num, after] = q.code, [min, max, step] = q.range
    const guess = num(mode), turn = this.deals
    if (!mine.moved) mine.v = guess
    await this.say(swapped ? `Okay: what if ${text} ${mine.moved ? "Kept your number." : q.ask(guess)}` : q.ask(guess), "speaking", swapped)
    if (this.deals !== turn) return
    const others = q.whatifs.map((w, i) => i).filter(i => i !== n)
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<div class="story__slider pick__yours">
        <code class="pick__line">${esc(before)}<b>${mine.v}</b>${esc(after)}</code>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${clamp(mine.v, min, max)}" aria-label="your number">
        <button type="button" class="story__choice" data-do="next">${esc(q.go)}</button>
      </div>
      <div class="pick__row pick__or"><span>or what if</span>${others.map(i => `<button type="button" class="pick__quiet" data-swap="${i}">${esc(q.whatifs[i][1])}</button>`).join("")}
        <button type="button" class="pick__quiet pick__quiet--far" data-do="back">pick another question</button></div>`
    const range = this.choicesTarget.querySelector("input"), out = this.choicesTarget.querySelector(".pick__line b"), slider = this.choicesTarget.querySelector(".story__slider")
    range.addEventListener("input", () => { mine.moved = true; mine.v = +range.value; out.textContent = mine.v; slider.classList.add("story__slider--moved") })
    this.settle()
    this.on("back", () => this.askQuestion(true))
    this.choicesTarget.querySelectorAll("[data-swap]").forEach(b => b.addEventListener("click", () => {
      const to = +b.dataset.swap
      this.perform(q.clip(q.whatifs[to][0], mine))
      this.yours(q, to, true)
    }))
    this.on("next", () => this.bet(q, n))
  }

  // The bet: π asks what it couldn't settle, and the two answers are the buttons.
  async bet(q, n) {
    const [, , , , [question, ...sides], next] = q.whatifs[n], mine = this.mine, turn = this.deals = Symbol()
    await this.say(`${mine.moved ? "Now it's got you in it." : "My guess it is."} One last thing, and it's a bet. ${question}`, "tease")
    if (this.deals !== turn) return
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<div class="pick__row">${sides.map((side, i) => `<button type="button" class="story__choice" data-side="${i}">${esc(side)}</button>`).join("")}</div>`
    this.settle()
    this.choicesTarget.querySelectorAll("[data-side]").forEach(b => b.addEventListener("click", () => this.done(q, sides[+b.dataset.side], next)))
  }

  // The way out. π takes the bet as it is, says what scene two is, and offers the one thing nobody has to do: name
  // it. The story's own input, with π's name for it standing in, and the button beside it works either way.
  async done(q, side, next) {
    const turn = this.deals = Symbol()
    await this.say(`“${side}.” You're on. Scene one's done. Scene two settles it: ${next}. What are we calling this?`, "hooray")
    if (this.deals !== turn) return
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<form class="story__ask pick__naming-ask"><input class="story__input" maxlength="40" spellcheck="false" autocomplete="off" placeholder="${esc(q.name)}">
      <button class="story__choice">Open it</button></form>`
    const form = this.choicesTarget.querySelector("form"), input = form.querySelector("input")
    input.addEventListener("input", () => this.tag(input.value.trim() || q.name))
    this.settle()
    form.addEventListener("submit", async e => {
      e.preventDefault()
      const name = input.value.trim() || q.name
      this.tag(name)
      await this.say(`“${name}” it is. That's where this demo stops: in the real thing the editor opens now, with scene one in it and that line of code lit up.`, "happy")
      this.choicesTarget.innerHTML = `<div class="pick__row"><button type="button" class="story__choice" data-do="again">Start over</button></div>`
      this.on("again", () => { this.offset = 0; this.askQuestion(true) })
    })
  }

  // The dialog's least height. The stage takes whatever room the dialog leaves, so holding the dialog's height holds
  // the stage's size.
  get dialog() { return this.textTarget.closest(".pick__dialog") }
  room(height) { this.dialog.style.minHeight = height }

  // The tag on the stage: what the video is called.
  tag(name) { this.tagTarget.hidden = false; this.tagTarget.classList.add("pick__tag--top"); this.tagTarget.classList.remove("pick__tag--name"); this.tagTarget.textContent = name }

  // On a phone, bring the buttons that just arrived into view.
  settle() { if (this.touch) this.choicesTarget.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" }) }

  // ── π talking ──────────────────────────────────────────────────────────────────────────────────────────────────

  // π says a line, typed out; a click finishes it early. Whatever was on offer goes away first.
  say(text, pose, instant) {
    const turn = this.turn = Symbol()
    this.choicesTarget.replaceChildren()
    for (const canvas of this.screens.keys()) if (canvas !== this.stageTarget) { this.screens.delete(canvas); this.frozen.delete(canvas) }
    this.portraitTarget.innerHTML = `<img src="${this.posesValue[pose]}" alt="">`
    return new Promise(resolve => {
      const started = performance.now()
      const finish = () => { this.element.removeEventListener("pointerdown", finish); this.textTarget.textContent = text; if (this.turn === turn) resolve() }
      const step = now => {
        if (this.gone || this.turn !== turn || this.textTarget.textContent === text) return
        const n = Math.floor((now - started) / 1000 * 40)
        if (n >= text.length) return finish()
        this.textTarget.textContent = text.slice(0, n)
        requestAnimationFrame(step)
      }
      if (instant) return finish()
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
      <span class="pick__card-title">${esc(c.title)}</span><span class="pick__card-go">Choose this</span></button>`).join("") + extra
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

  // deal: when the clip arrives by a card turning over ({ before, text, at }), the stage plays that first.
  perform(clip, deal) {
    this.screens.set(this.stageTarget, { clip, t0: deal ? deal.at + DRAWN * 1000 : performance.now(), deal })
  }

  // A canvas showing one moment of a clip, k of the way through.
  freeze(canvas, clip, k) {
    this.screens.set(canvas, { clip: { ...clip, seamless: true, dur: Infinity }, t0: performance.now() - k * clip.dur * 1000, still: true })
  }

  // The deal, e seconds in: the old sketch dims, three cards come up and swap round once, the middle one turns over
  // with your what-if on it and holds still; then it tucks away into the corner as the dim lifts off the new sketch,
  // which starts from its beginning once the card is gone. True while it's still playing.
  dealing(p, { before, text }, clip, e) {
    if (e > DRAWN) return false
    const c = p.c, tucking = e >= TUCKED
    if (tucking) clip.draw(p, 0); else if (before) before.draw(p, e % before.dur)
    c.globalAlpha = .84 * ph(e, 0, .4) * (1 - ph(e, TUCKED, DRAWN)); c.fillStyle = C.bg; c.fillRect(0, 0, p.w, p.h); c.globalAlpha = 1
    const spots = [-3.6, 0, 3.6], round = ph(e, .6, 1.15), flip = ph(e, 1.2, HELD), away = ph(e, TUCKED, DRAWN)
    for (let i = 0; i < 3; i++) {
      // Each card moves one place round, so the one that started on the left ends in the middle: that one's yours.
      const yours = i === 0, x = lerp(spots[i], spots[(i + 1) % 3], round), hop = Math.sin(round * Math.PI) * (i % 2 ? .7 : -.7)
      const rise = lerp(-7, 0, ph(e, .05 + i * .08, .55 + i * .08)), drop = yours ? 0 : ph(e, 1.2, 1.7) * -8
      const grow = yours ? (1 + flip * 1.1) * (1 - away * .8) : 1, turn = yours ? Math.abs(Math.cos(flip * Math.PI)) : 1, face = yours && flip > .5
      c.save()
      c.translate(p.X(lerp(x, 5.6, yours ? away : 0)), p.Y(lerp(rise + hop + drop, 3.2, yours ? away : 0))); c.scale(grow * turn, grow); c.rotate(yours ? 0 : (i - 1) * .06)
      c.globalAlpha = yours ? 1 - away * away : 1
      const w = (face ? 4.4 : 2.3) * p.s, h = (face ? 2.5 : 3.2) * p.s
      c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, .18 * p.s)
      c.fillStyle = face ? C.yellow : "#14181d"; c.fill(); c.lineWidth = Math.max(1.5, p.s * .05); c.strokeStyle = face ? C.yellow : C.blue; c.stroke()
      c.fillStyle = face ? C.bg : C.blue; c.textAlign = "center"; c.textBaseline = "middle"
      if (face) {
        c.font = `${.4 * p.s}px ${SERIF}`
        const lines = []; let line = ""
        for (const word of `What if ${text}`.split(" ")) { if (line && c.measureText(`${line} ${word}`).width > w - .5 * p.s) { lines.push(line); line = word } else line = line ? `${line} ${word}` : word }
        lines.push(line)
        lines.forEach((l, k) => c.fillText(l, 0, (k - (lines.length - 1) / 2) * .52 * p.s))
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
