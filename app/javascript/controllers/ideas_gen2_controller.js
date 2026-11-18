import { Controller } from "@hotwired/stimulus"

// Generation 2 of the idea step (/start/ideas/2, onboarding/ideas.html.erb). The questions are ones you could settle
// with your hands (a pizza, a ball, a stack of books). After you pick, π deals you a catch, which bends the question a
// different way for each person so the videos differ. You leave with notes on where to start finding the answer.
// Nothing is saved.
//
// A clip is { dur, draw(pen, t) }: it draws one frame at t seconds on a Pen, in manim's units (14.2 by 8, origin in
// the middle, y up), so the same clip plays on the stage and on a card.
const TAU = Math.PI * 2
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
// Each is a function of its catch, so the sketch changes when π deals a different one.

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
    p.text({ crust: "which has more pizza, if you leave the crust?", price: "which is more pizza for your money?", shrink: "how small can the large get and still win?" }[mode] ?? "which is more pizza?",
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
    p.text({ three: "from the three-point line", moon: "on the Moon, where things fall six times slower", tall: "if you were a foot taller" }[mode] ?? "from the free-throw line", [-1, 3.4], { size: .46 })
    p.text("three ways in. Which is the easiest shot?", [0, -3.5], { size: .44, color: C.faint })
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

// ── What π offers ────────────────────────────────────────────────────────────────────────────────────────────────

// catches: the same question, bent a different way for each person, so no two videos come out the same. The first is
// the plain one the card plays. notes: where to start finding out, left in your editor.
const QUESTIONS = [
  { title: "Is one large pizza more than two smalls?", clip: pizzaDeal,
    catches: [["shrink", "how small can the large get before two smalls win?"], ["crust", "what if you don't eat the crust?"], ["price", "which is more pizza for your money?"]],
    notes: ["Measure a real pizza, or look up the sizes on a menu near you.", "area of a circle", "the width of each size, and what each one costs"] },
  { title: "What's the best angle to shoot a basketball?", clip: shotArc,
    catches: [["three", "from the three-point line"], ["tall", "if you were a foot taller"], ["moon", "on the Moon"]],
    notes: ["Film ten shots from the side and trace the arc the ball makes.", "projectile motion launch angle", "how wide the rim is next to the ball"] },
  { title: "Is cutting across the grass really shorter?", clip: shortcut,
    catches: [["mud", "when the grass is mud and slows you down"], ["square", "across a square park"], ["fence", "when the lawn is long and thin: is it worth it?"]],
    notes: ["Find a corner near you and count your steps both ways.", "Pythagorean theorem", "how much slower you walk on grass than on a path"] },
  { title: "Why is a Minecraft circle a lie?", clip: blockCircle,
    catches: [["outline", "how many blocks does just the outline need?"], ["wrong", "which blocks are the most wrong?"], ["big", "does a bigger one ever turn round?"]],
    notes: ["Build one in creative mode and count the blocks.", "midpoint circle algorithm", "how the block count grows as the circle gets wider"] },
  { title: "Do you get less wet running in the rain?", clip: rainRun,
    catches: [["wind", "when the wind blows it into your face"], ["hat", "if you hold a pizza box over your head"], ["far", "all the way across a football field"]],
    notes: ["Tape a paper towel to two shirts. One of you walks, one runs. Compare.", "walk or run in the rain", "how big you are from above next to how big you are from the front"] },
  { title: "How far can a stack of books lean off a table?", clip: bookStack,
    catches: [["cards", "with a whole deck of cards"], ["far", "how many books until the top one is two books out?"], ["plain", "with only four books: can the top one clear the table?"]],
    notes: ["Try it on your desk with books or a deck of cards.", "block stacking problem", "how far yours got before it fell"] }
]
// For a question of your own π can't sketch: catches that bend anything.
const ANY = ["what would have to change for the answer to flip?", "what if it were ten times bigger?", "what's the worst way to do it?"]

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

  // For checking the clips: /start/ideas/2#clips=.8 lays every clip out, stopped 80% of the way through.
  sheet(k) {
    const clips = QUESTIONS.flatMap(q => [[q.title, q.clip()], ...q.catches.map(([mode, text]) => [text, q.clip(mode)])])
    this.element.innerHTML = `<div class="pick__choices" style="grid-template-columns:repeat(4,1fr);width:100%">${clips.map(([name]) =>
      `<div class="pick__card"><canvas></canvas><span class="pick__card-sub">${esc(name)}</span></div>`).join("")}</div>`
    this.element.querySelectorAll("canvas").forEach((canvas, i) => this.freeze(canvas, clips[i][1], k))
  }

  // ── The beats ──────────────────────────────────────────────────────────────────────────────────────────────────

  async askQuestion() {
    const shown = [0, 1, 2].map(i => QUESTIONS[(this.offset + i) % QUESTIONS.length]).map(q => ({ ...q, plain: q.plain ??= q.clip() }))
    this.perform(shown[0].plain, false)
    await this.say("You're going to make an animated video that settles one question. Which one? Pick, or tell me yours.", "speaking")
    this.cards(shown.map(q => ({ clip: q.plain, title: q.title, pick: () => this.deal(q, Math.floor(Math.random() * q.catches.length)) })),
      `<div class="pick__row"><form class="pick__ask"><input class="pick__input" maxlength="80" autocomplete="off" placeholder="or yours: why my bus is always late"><button class="pick__chip">Mine ▸</button></form>
       <button type="button" class="pick__chip pick__chip--quiet" data-do="more">Show me others</button></div>`)
    const form = this.choicesTarget.querySelector("form"), input = form.querySelector("input")
    form.addEventListener("submit", e => { e.preventDefault(); const title = input.value.trim(); if (title) this.deal({ title }, Math.floor(Math.random() * ANY.length)) })
    this.on("more", () => { this.offset = (this.offset + 3) % QUESTIONS.length; this.askQuestion() })
  }

  // π deals you a catch: the question, bent one way. Everyone who picks this question gets dealt a different one, so
  // the videos differ. (Here it's random; the real thing would deal whichever catch the fewest people have.)
  async deal(q, n, again = false) {
    const own = !q.clip, catches = own ? ANY.map(text => [null, text]) : q.catches, [mode, text] = catches[n % catches.length]
    this.perform(own ? this.written(q.title, text) : q.clip(mode), !own)
    await this.say(again ? `Then how about: ${text}` : own ? `"${q.title}" I want to watch that. To make it yours, here's a catch: ${text}`
      : `Good one. Other people will pick it too, so here's a catch to make yours different: ${text}`, again ? "thinking" : "tease")
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="back">◂ another question</button>
      <button type="button" class="pick__chip" data-do="again">Deal me another</button>${own ? `<button type="button" class="pick__chip" data-do="none">No catch</button>` : ""}
      <button type="button" class="pick__chip pick__chip--go" data-do="keep">I'll take it ▸</button></div>`
    this.on("back", () => this.askQuestion())
    this.on("again", () => this.deal(q, n + 1, true))
    this.on("none", () => this.plan(q, null, null))
    this.on("keep", () => this.plan(q, mode, text))
  }

  // What you're building, said plainly, and where to start finding out.
  async plan(q, mode, text) {
    const own = !q.clip, notes = own ? ["Try it once yourself and write down what happens.", q.title, "one thing about it you can count or measure"] : q.notes
    this.perform(own ? this.written(q.title, text) : q.clip(mode), !own)
    await this.say(`So that's your video: it asks the question, then shows what you found. ${own ? "I don't know the answer to yours." : "I've sketched how it could open."} Finding out is your part, and it's most of the fun. Here's where I'd start.`, "happy")
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<div class="pick__notes">
        <p class="pick__notes-title">${esc(q.title)}${text ? `<span>${esc(text)}</span>` : ""}</p>
        <dl><dt>Try it</dt><dd>${esc(notes[0])}</dd><dt>Look up</dt><dd>“${esc(notes[1])}”</dd><dt>Find out</dt><dd>${esc(notes[2])}</dd></dl>
        <p class="pick__notes-foot">These notes will be waiting in your editor. Plan on about three hours.</p>
      </div>
      <div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="back">◂ change the catch</button>
      <button type="button" class="pick__chip pick__chip--go" data-do="next">That's my video ▸</button></div>`
    this.on("back", () => this.deal(q, 0, true))
    this.on("next", async () => {
      await this.say("That's where this demo stops. In the real thing your prize comes next.", "hooray")
      this.choicesTarget.innerHTML = `<div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="again">◂ start over</button></div>`
      this.on("again", () => this.askQuestion())
    })
  }

  // Your own question, written on the stage, with its catch under it.
  written(title, text) {
    return { dur: 6, draw: (p, t) => { p.wrap(title, [0, 1.2], 11, { size: .8, alpha: ph(t, .2, 1) }); if (text) p.wrap(text, [0, -1.6], 11, { size: .5, color: C.yellow, alpha: ph(t, 1, 1.8) }) } }
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
  perform(clip, sketch) {
    this.screens.set(this.stageTarget, { clip, t0: performance.now() })
    this.tagTarget.hidden = !sketch
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
