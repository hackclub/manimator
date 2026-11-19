import { Controller } from "@hotwired/stimulus"

// Generation 5 of the idea step (/start/ideas/5, onboarding/ideas.html.erb). Questions out of your own life, each a
// sketch π plays. There is no dealt twist: once you pick, π asks one thing about you (how wide your build is, how rare
// your drop is) and the sketch redraws as you drag, so the video is about your number and no two come out the same.
// You leave with a title, the opening scene already drawn, and one mystery π couldn't answer: no list of chores.
// Nothing is saved.
//
// A clip is { dur, draw(pen, t) }: it draws one frame at t seconds on a Pen, in manim's units (14.2 by 8, origin in
// the middle, y up), so the same clip plays on the stage and on a card.
const TAU = Math.PI * 2
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
// Each is a function of s, whose s.v is your number: the sketch reads it every frame, so dragging redraws it.

const rand = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

const blockCircle = s => ({
  dur: 6, seamless: true,
  draw(p) {
    const d = Math.round(s.v), R = 2.7, O = [-2.8, 0], cell = 2 * R / d
    let count = 0, out = 0
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
      const x = i + .5 - d / 2, y = j + .5 - d / 2
      if (Math.hypot(x, y) >= d / 2) continue
      const poke = Math.hypot(Math.abs(x) + .5, Math.abs(y) + .5) - d / 2 > .3
      count++; if (poke) out++
      p.rect(O[0] - R + i * cell, O[1] - R + j * cell, cell, cell, { fill: poke ? C.red : C.green, stroke: C.bg, width: d > 28 ? .5 : 2 })
    }
    p.circle(O, R, { stroke: C.ink, width: 2, alpha: .7 })
    p.text(`${d} blocks wide`, [3.8, 1.5], { size: .6 })
    p.text(`${count} blocks`, [3.8, .6], { size: .46, color: C.faint })
    p.text(`${out} poke out past the real circle`, [3.8, -.2], { size: .42, color: C.red })
    p.text("is it round yet?", [3.8, -1.5], { size: .5, color: C.yellow })
  }
})

// A hundred players after the same drop. Each gets it on some try; most of them not by the try you'd expect.
const lootDrop = s => ({
  dur: 10,
  draw(p, t) {
    const N = Math.round(s.v), k = Math.floor(clamp((t - .6) / 7, 0, 1) * 2 * N), miss = Math.log(1 - 1 / N)
    let got = 0, late = 0
    for (let i = 0; i < 100; i++) {
      const need = Math.ceil(Math.log(1 - rand(i + 7) * .999) / miss), has = need <= k
      if (has) got++
      if (need > N) late++
      p.rect(-6.4 + (i % 10) * .56, 2.1 - Math.floor(i / 10) * .56, .44, .44, { fill: has ? C.yellow : C.line, fillAlpha: has ? 1 : .8 })
    }
    p.text("100 players, same boss", [-3.65, 3.2], { size: .42, color: C.faint })
    p.text(`a 1 in ${N} drop`, [3.6, 2], { size: .6 })
    p.text(`try ${k}`, [3.6, .9], { size: .5, color: C.faint })
    p.text(`${got} of them have it`, [3.6, .1], { size: .5, color: C.yellow })
    if (k >= N) p.wrap(`after ${N} tries, ${late} still had nothing`, [3.6, -1.2], 5.6, { size: .46, color: C.red })
  }
})

// Coin-flip games: the longest run of losses is longer than feels fair.
const loseStreak = s => ({
  dur: 8,
  draw(p, t) {
    const n = Math.round(s.v), shown = Math.min(n, Math.floor(Math.max(0, t - .4) * n / 3.5)), lost = i => rand(i + 91) < .5
    let best = 0, at = 0, run = 0
    for (let i = 0; i < shown; i++) { run = lost(i) ? run + 1 : 0; if (run > best) { best = run; at = i - run + 1 } }
    for (let i = 0; i < shown; i++) {
      const x = -6.5 + (i % 10) * .62, y = 2.2 - Math.floor(i / 10) * .8, worst = best > 1 && i >= at && i < at + best
      p.rect(x, y, .5, .5, { fill: lost(i) ? C.red : C.green, fillAlpha: lost(i) ? (worst ? 1 : .45) : .7, stroke: worst ? C.ink : undefined, width: 2 })
      p.text(lost(i) ? "L" : "W", [x + .25, y + .25], { size: .28, color: C.bg })
    }
    p.text(`${n} games tonight`, [3.7, 2], { size: .6 })
    p.text("every one a coin flip", [3.7, 1.1], { size: .44, color: C.faint })
    p.text(`worst losing streak: ${best}`, [3.7, 0], { size: .5, color: C.red })
    p.text("bad, or just unlucky?", [3.7, -1.3], { size: .5, color: C.yellow })
  }
})

const birthdays = s => ({
  dur: 6, seamless: true,
  draw(p, t) {
    const n = Math.round(s.v), R = 2.7, O = [-2.8, 0], at = i => [O[0] + R * Math.cos(i / n * TAU + 1.57), O[1] + R * Math.sin(i / n * TAU + 1.57)]
    let none = 1
    for (let i = 0; i < n; i++) none *= (365 - i) / 365
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) p.line(at(i), at(j), { stroke: C.blue, width: 1, alpha: clamp(6 / n, .05, .5) })
    const a = Math.floor(t * 3) % n, b = (a + 1 + Math.floor(rand(Math.floor(t * 3)) * (n - 1))) % n
    p.line(at(a), at(b), { stroke: C.yellow, width: 3 })
    for (let i = 0; i < n; i++) p.circle(at(i), n > 30 ? .1 : .16, { fill: i === a || i === b ? C.yellow : C.ink })
    p.text(`${n} people in the room`, [3.8, 2], { size: .56 })
    p.text(`${n * (n - 1) / 2} pairs to check`, [3.8, 1.1], { size: .46, color: C.blue })
    p.wrap(`chance two share a birthday: ${Math.round((1 - none) * 100)}%`, [3.8, 0], 5.6, { size: .5, color: C.yellow })
  }
})

const pizzaPie = (p, O, r) => {
  p.circle(O, r, { fill: C.yellow, fillAlpha: .3, stroke: C.yellow, width: 7 })
  ;[[.45, .3], [-.4, .45], [-.1, -.5], [.5, -.35], [-.6, -.15], [.05, .05]].forEach(([x, y]) => p.circle([O[0] + x * r, O[1] + y * r], r * .13, { fill: C.red, alpha: .9 }))
}
const pizzaDeal = s => ({
  dur: 6, seamless: true,
  draw(p) {
    const D = Math.round(s.v), area = d => Math.round(Math.PI * d * d / 4), big = area(D), two = 2 * area(10)
    pizzaPie(p, [-3.6, 0], D * .105); pizzaPie(p, [2, 0], 1.05); pizzaPie(p, [4.6, 0], 1.05)
    p.text("or", [-.6, 0], { size: .6, color: C.faint })
    p.text(`one ${D}-inch`, [-3.6, 3.2], { size: .56 }); p.text("two 10-inch", [3.3, 3.2], { size: .56 })
    p.text(`${big} square inches`, [-3.6, -2.7], { size: .42, color: big >= two ? C.yellow : C.faint }); p.text(`${two} square inches`, [3.3, -2.7], { size: .42, color: two > big ? C.yellow : C.faint })
    p.text(big === two ? "a tie?!" : big > two ? "the one pizza wins" : "the two smalls win", [0, -3.5], { size: .5, color: C.yellow })
  }
})

// Drawn to scale, a free throw: the gentlest throw that still gets there is 45° plus half the angle up to the hoop.
const shotArc = s => ({
  dur: 6,
  draw(p, t) {
    const ft = .55, floor = -3.3, tall = Math.round(s.v), S = [-4.2, floor + (tall + 6) / 12 * ft], D = 13.75 * ft, rise = floor + 10 * ft - S[1]
    const lazy = 45 + Math.atan(rise / D) * 90 / Math.PI
    p.line([-7, floor], [7, floor], { stroke: C.line })
    p.line([S[0] + D + .45, floor], [S[0] + D + .45, floor + 12.5 * ft], { stroke: C.ink, width: 4 }); p.line([S[0] + D - .41, S[1] + rise], [S[0] + D + .41, S[1] + rise], { stroke: C.red, width: 6 })
    p.line([S[0] - .3, floor], [S[0] - .3, floor + tall / 12 * ft - .4], { stroke: C.ink, width: 5 }); p.circle([S[0] - .3, floor + tall / 12 * ft - .2], .2, { fill: C.ink })
    ;[[lazy - 12, C.blue], [lazy, C.yellow], [lazy + 5, C.green]].forEach(([angle, color], i) => {
      const tan = Math.tan(angle * Math.PI / 180), drop = (tan * D - rise) / D / D, at = dx => [S[0] + dx, S[1] + tan * dx - drop * dx * dx]
      p.poly(Array.from({ length: 41 }, (_, n) => at(D * n / 40)), { stroke: color, width: i === 1 ? 4 : 2, close: false, alpha: i === 1 ? 1 : .6 })
      if (i === 1) p.circle(at(D * clamp((t - .5) / 2.2, 0, 1)), .24, { fill: "#e8833a" })
      p.text(`${Math.round(angle)}°`, add(at(.9 + i * .5), [-.75, .1 + i * .25]), { size: .36, color })
    })
    p.text(`you, ${Math.floor(tall / 12)}'${tall % 12}"`, [-5.6, floor - .4], { size: .4 })
    p.text(`the laziest throw that still drops in: ${Math.round(lazy)}°`, [1.6, floor - .4], { size: .42, color: C.yellow })
  }
})

// Each book can stick out half a book past the one below, then a quarter, then a sixth…
const bookStack = s => ({
  dur: 6, seamless: true,
  draw(p) {
    const n = Math.round(s.v), L = 2.4, top = -2.4, edge = -5.6, tall = Math.min(.44, 5.6 / n)
    p.rect(-7.1, top - 1.4, 7.1 + edge, 1.4, { fill: C.line }); p.line([edge, top], [edge, 3.6], { stroke: C.faint, width: 1.5, alpha: .5 })
    let reach = 0
    for (let i = n; i >= 1; i--) {
      reach += L / (2 * i)
      p.rect(edge + reach - L, top + (n - i) * tall, L, tall, { fill: i % 2 ? C.blue : C.teal, stroke: C.bg, width: tall < .2 ? 1 : 2 })
    }
    p.text(`${n} book${n === 1 ? "" : "s"}`, [4, 2.2], { size: .6 })
    p.wrap(`the top one hangs ${(reach / L).toFixed(2)} of a book past the edge`, [4, 1.2], 5.4, { size: .42, color: C.faint })
    if (reach > L) p.wrap("the top book is right off the table. Nothing fell.", [4, -.6], 5.4, { size: .44, color: C.yellow })
  }
})

// Rain: what lands on top of you (longer out = more) plus what you walk into (the same either way).
const rainRun = s => ({
  dur: 8,
  draw(p, t) {
    const far = Math.round(s.v), go = Math.max(0, t - .6)
    for (let i = 0; i < 70; i++) { const fall = (i * .618 + t * 1.3) % 1, x = ((i * 2.399) % 15) - 7.5, y = 4 - fall * 8; p.line([x, y], [x, y - .45], { stroke: C.blue, width: 2, alpha: .35 }) }
    ;[["walk", 5.2, .5], ["run", 2, -2.9]].forEach(([name, time, ground]) => {
      const k = clamp(go / time, 0, 1), x = lerp(-5.6, 4.4, k), top = Math.round(.22 * time * k * far), front = Math.round(.4 * k * far)
      p.line([-7, ground], [7, ground], { stroke: C.line })
      p.poly([[4.9, ground], [4.9, ground + 2], [6.6, ground + 2]], { stroke: C.ink, width: 4, close: false })
      p.rect(x - .2, ground, .4, 1, { fill: C.ink }); p.circle([x, ground + 1.25], .24, { fill: C.ink })
      p.text(name, [-6.6, ground + 1.9], { size: .46, align: "left" })
      p.text(`on top ${top} + in front ${front} = ${top + front} drops`, [-5.2, ground + 1.9], { size: .4, align: "left", color: k < 1 ? C.faint : C.yellow })
    })
    p.text(`${far} metres to your door`, [0, 3.5], { size: .44 })
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
    ;["the question", "what I tried", "what I found"].forEach((name, i) => {
      p.rect(-6.6 + i * 4.45, -3.95, 4.3, .12, { fill: i === part ? C.yellow : C.line })
      p.text(name, [-6.6 + i * 4.45 + 2.15, -3.55], { size: .34, color: i === part ? C.yellow : C.faint })
    })
  }
}

// ── What π offers ────────────────────────────────────────────────────────────────────────────────────────────────

// ask: the one thing π asks about you; its answer is the number the sketch is drawn from, between min and max.
// says: that number in words. yours: your video's title. mystery: what π leaves for you to find out.
// hole: where the rabbit hole starts, if you want one.
const feet = v => `${Math.floor(v / 12)}'${v % 12}"`
const QUESTIONS = [
  { title: "Why is a Minecraft circle a lie?", clip: blockCircle, ask: "How wide is the thing you're building? Drag it.", min: 5, max: 64, start: 9, says: v => `${v} blocks wide`,
    yours: v => `Why is my ${v}-block circle a lie?`, mystery: "Keep making it wider. Does it ever actually turn round, or do the corners just hide?", hole: "how do pixel circles work" },
  { title: "Why haven't I got the rare drop yet?", clip: lootDrop, ask: "How rare is the thing you're grinding for? Drag it.", min: 2, max: 200, start: 20, says: v => `1 in ${v}`,
    yours: v => `It's a 1 in ${v} drop. Why don't I have it after ${v} tries?`, mystery: v => `Drag the rarity around: about the same share of players always misses out. Why that share? And how many tries until you're 99% safe?`, hole: "drop rate probability after n tries" },
  { title: "I lost five in a row. Am I bad or unlucky?", clip: loseStreak, ask: "How many games do you play in a night? Drag it.", min: 5, max: 50, start: 20, says: v => `${v} games`,
    yours: v => `${v} games, all coin flips. How bad can the losing streak get?`, mystery: "How long does a losing streak have to be before it stops being luck?", hole: "longest run of tails in n coin flips" },
  { title: "Does anyone in my class share a birthday?", clip: birthdays, ask: "How many people are in your class? Drag it.", min: 4, max: 60, start: 12, says: v => `${v} people`,
    yours: v => `${v} people in my class. Do two of us share a birthday?`, mystery: "How small can a room be and still be a better-than-even bet? It's smaller than anyone guesses.", hole: "birthday paradox" },
  { title: "Is one large pizza more than two smalls?", clip: pizzaDeal, ask: "How big is the large at your pizza place? Drag it.", min: 10, max: 20, start: 16, says: v => `${v} inches`,
    yours: v => `Is one ${v}-inch pizza more than two 10-inch?`, mystery: "Find the size where they tie. It isn't 20 inches, and the reason is the whole video.", hole: "one large pizza vs two small" },
  { title: "What's the best angle to shoot a basketball?", clip: shotArc, ask: "How tall are you? Drag it.", min: 54, max: 82, start: 64, says: feet,
    yours: v => `What's the best angle to shoot from ${feet(v)}?`, mystery: "The laziest throw isn't what the pros shoot. They go higher. What are they buying with the extra arc?", hole: "best free throw angle" },
  { title: "How far can a stack of books lean off a table?", clip: bookStack, ask: "How many books could you grab right now? Drag it.", min: 1, max: 52, start: 4, says: v => `${v} book${v === 1 ? "" : "s"}`,
    yours: v => `How far can my ${v} books lean off a table?`, mystery: "With enough books, could the top one lean out as far as you like? It feels impossible.", hole: "block stacking problem" },
  { title: "Do you get less wet running in the rain?", clip: rainRun, ask: "How far is it from the bus to your door? Drag it.", min: 10, max: 200, start: 50, says: v => `${v} metres`,
    yours: v => `${v} metres in the rain: run or walk?`, mystery: "Running wins here. Turn the wind into your face: does it still?", hole: "run or walk in the rain" }
]

export default class extends Controller {
  static targets = ["stage", "tag", "portrait", "text", "choices"]
  static values = { poses: Object }

  connect() {
    this.screens = new Map() // each canvas and the clip playing on it
    this.frozen = new Map()
    this.touch = matchMedia("(hover: none)").matches
    this.order = QUESTIONS.map((q, i) => [i < 2 ? i : 2 + Math.random(), q]).sort((a, b) => a[0] - b[0]).map(([, q]) => q) // the first two lead, the rest are shuffled
    this.offset = 0
    this.tick = now => { this.draw(now); this.raf = requestAnimationFrame(this.tick) }
    this.raf = requestAnimationFrame(this.tick)
    const still = location.hash.match(/^#clips=([\d.]+)$/)
    if (still) this.sheet(+still[1]); else this.askQuestion()
  }

  disconnect() { cancelAnimationFrame(this.raf); this.gone = true }

  // For checking the clips: /start/ideas/5#clips=.8 lays every clip out at its smallest, starting and biggest number.
  sheet(k) {
    const clips = [["a finished one", paperMoon], ...QUESTIONS.flatMap(q => [q.min, q.start, q.max].map(v => [`${q.title} ${q.says(v)}`, q.clip({ v })]))]
    this.element.innerHTML = `<div class="pick__choices" style="grid-template-columns:repeat(3,1fr);width:100%">${clips.map(([name]) =>
      `<div class="pick__card"><canvas></canvas><span class="pick__card-sub">${esc(name)}</span></div>`).join("")}</div>`
    this.element.querySelectorAll("canvas").forEach((canvas, i) => this.freeze(canvas, clips[i][1], k))
  }

  // ── The beats ──────────────────────────────────────────────────────────────────────────────────────────────────

  async askQuestion() {
    const shown = [0, 1, 2].map(i => this.order[(this.offset + i) % this.order.length])
    shown.forEach(q => { q.plain ??= q.clip({ v: q.start }) })
    this.perform(shown[0].plain)
    await this.say("You're going to make a video that answers something you've actually wondered. I'll draw the first scene. Which one's bugged you?", "speaking")
    this.cards(shown.map(q => ({ clip: q.plain, title: q.title, pick: () => this.makeYours(q) })),
      `<div class="pick__row"><button type="button" class="pick__chip" data-do="more">None of these. Show me more</button></div>`)
    this.on("more", () => { this.offset = (this.offset + 3) % this.order.length; this.askQuestion() })
  }

  // π asks one thing about you, and the sketch on the stage redraws as you drag: now it's yours, and it's not the
  // one your friend will make.
  async makeYours(q, v = q.start) {
    const s = { v }
    this.perform(q.clip(s))
    await this.say(`Good one. I drew it with a number I made up, though. ${q.ask}`, "tease")
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<label class="pick__dial"><input type="range" min="${q.min}" max="${q.max}" value="${v}"><output>${esc(q.says(v))}</output></label>
      <div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="back">◂ a different question</button>
      <button type="button" class="pick__chip pick__chip--go" data-do="keep">That's mine ▸</button></div>`
    const range = this.choicesTarget.querySelector("input"), out = this.choicesTarget.querySelector("output")
    range.addEventListener("input", () => { s.v = +range.value; out.textContent = q.says(s.v) })
    this.settle()
    this.on("back", () => this.askQuestion())
    this.on("keep", () => this.yours(q, s.v))
  }

  // What you leave with: a title, a first scene that's already drawn, and one thing π couldn't answer.
  async yours(q, v) {
    const mystery = typeof q.mystery === "function" ? q.mystery(v) : q.mystery
    this.perform(q.clip({ v }))
    await this.say("Then that's your video, and scene one is done: I just drew it. You'll get my code for it and mess it up however you like. Here's the bit I couldn't work out.", "happy")
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<div class="pick__ticket">
        <p class="pick__ticket-label">your video</p>
        <p class="pick__ticket-title">${esc(q.yours(v))}</p>
        <p class="pick__ticket-mystery"><span>the mystery</span>${esc(mystery)}</p>
        <p class="pick__ticket-foot">Nobody hands you the answer. If you want a rabbit hole to start in, search “${esc(q.hole)}”.</p>
      </div>
      <div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="back">◂ change my number</button>
      <button type="button" class="pick__chip" data-do="example">What does a finished one look like?</button>
      <button type="button" class="pick__chip pick__chip--go" data-do="next">Open my sketch ▸</button></div>`
    this.settle()
    this.on("back", () => this.makeYours(q, v))
    this.on("example", () => this.example(q, v))
    this.on("next", async () => {
      await this.say("That's where this demo stops. In the real thing the editor opens here, with scene one in it.", "hooray")
      this.choicesTarget.innerHTML = `<div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="again">◂ start over</button></div>`
      this.on("again", () => this.askQuestion())
    })
  }

  // Only if you ask: a finished video about a different question, to see the three parts.
  async example(q, v) {
    this.perform(paperMoon)
    await this.say("Here's one somebody could have made. Different question, twenty seconds, three parts: the question, what they tried, what they found. Mine was only the first part.", "speaking")
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<div class="pick__row"><button type="button" class="pick__chip pick__chip--go" data-do="next">Got it. Back to mine ▸</button></div>`
    this.settle()
    this.on("next", () => this.yours(q, v))
  }

  // On a phone, bring the buttons that just arrived into view.
  settle() { if (this.touch) this.choicesTarget.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" }) }

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

  perform(clip) {
    this.screens.set(this.stageTarget, { clip, t0: performance.now() })
    this.tagTarget.hidden = true
  }

  // A canvas showing one moment of a clip, k of the way through.
  freeze(canvas, clip, k) {
    this.screens.set(canvas, { clip: { ...clip, seamless: true, dur: Infinity }, t0: performance.now() - k * clip.dur * 1000, still: true })
  }

  draw(now) {
    const ratio = window.devicePixelRatio || 1
    for (const [canvas, { clip, t0, still }] of this.screens) {
      const w = Math.round(canvas.clientWidth * ratio), h = Math.round(canvas.clientHeight * ratio)
      if (!w || !h) continue
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      const ctx = canvas.getContext("2d")
      const t = still ? this.frozen.get(canvas) ?? this.frozen.set(canvas, (now - t0) / 1000).get(canvas) : (now - t0) / 1000 % clip.dur
      ctx.clearRect(0, 0, w, h)
      clip.draw(new Pen(ctx, w, h), t)
      // Each loop fades in and out, so the jump back to the start isn't a cut.
      const fade = clip.seamless ? 0 : Math.max(1 - ph(t, 0, .35), ph(t, clip.dur - .35, clip.dur))
      if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1 }
    }
  }
}
