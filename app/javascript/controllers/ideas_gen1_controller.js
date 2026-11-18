import { Controller } from "@hotwired/stimulus"

// Generation 1 of the idea step (/start/ideas/1, onboarding/ideas.html.erb). π plays a few arguments a video could settle; you
// pick one by watching, or bring your own, and π says what you're building: a video that asks the question and shows
// the answer, with the answer yours to find out. Nothing is saved.
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

// ── Arguments to settle ──────────────────────────────────────────────────────────────────────────────────────────

const pizza = (p, O, r, k) => {
  p.circle(O, r * k, { fill: C.yellow, fillAlpha: .3, stroke: C.yellow, width: 7 })
  ;[[.45, .3], [-.4, .45], [-.1, -.5], [.5, -.35], [-.6, -.15], [.05, .05]].forEach(([x, y]) => p.circle([O[0] + x * r * k, O[1] + y * r * k], r * k * .13, { fill: C.red, alpha: .9 }))
}
const pizzaDeal = {
  dur: 6, seamless: true,
  draw(p, t) {
    const beat = Math.sin(t * TAU / 3) * .04
    pizza(p, [-3.6, 0], 2.1, 1 + beat); pizza(p, [1.6, 0], 1.4, 1 - beat); pizza(p, [4.8, 0], 1.4, 1 - beat)
    p.text("or", [-.6, 0], { size: .6, color: C.faint })
    p.text("one large", [-3.6, 3], { size: .56 }); p.text("two smalls", [3.2, 3], { size: .56 })
    p.text("which is more pizza?", [0, -3.3], { size: .56, color: C.yellow })
  }
}

const blockCircle = {
  dur: 6,
  draw(p, t) {
    const n = [4, 7, 12][Math.floor(t / 2)], R = 2.7, O = [-2.6, 0], cell = R / n
    for (let i = -n; i < n; i++) for (let j = -n; j < n; j++)
      if (Math.hypot(i + .5, j + .5) < n) p.rect(O[0] + i * cell, O[1] + j * cell, cell, cell, { fill: C.green, stroke: C.bg, width: 2 })
    p.circle(O, R, { stroke: C.ink, width: 2, alpha: .5 })
    p.text("a circle, in blocks", [3.7, 1.2], { size: .56 })
    p.text(`${n * 2} blocks wide`, [3.7, .2], { size: .46, color: C.faint })
    p.text("is it round yet?", [3.7, -1], { size: .56, color: C.yellow })
  }
}

const shortcut = {
  dur: 7.5,
  draw(p, t) {
    const A = [-3.6, -1.8], B = [1.2, -1.8], Q = [1.2, 1.8], d = clamp((t - .8) * 1.75, 0, 7)
    p.rect(A[0], A[1], 4.8, 3.6, { fill: C.green, fillAlpha: .16 })
    p.poly([A, B, Q], { stroke: C.line, width: 9, close: false })
    const around = d < 4 ? mix(A, B, d / 4) : mix(B, Q, Math.min(1, (d - 4) / 3)), across = mix(A, Q, Math.min(1, d / 5))
    p.poly(d < 4 ? [A, around] : [A, B, around], { stroke: C.blue, width: 4, close: false })
    p.line(A, across, { stroke: C.yellow, width: 4 })
    p.circle(Q, .2, { stroke: C.red, width: 4 }); p.circle(around, .2, { fill: C.blue }); p.circle(across, .2, { fill: C.yellow })
    p.text(`on the path: ${Math.min(7, d).toFixed(1)}`, [4.4, .6], { size: .5, color: C.blue })
    p.text(`across the grass: ${Math.min(5, d).toFixed(1)}`, [4.4, -.4], { size: .5, color: C.yellow })
    p.text("the shortcut wins by 2. Does it always?", [0, -3.3], { size: .5, alpha: ph(t, 5, 5.6) })
  }
}

// Every swap each sort makes on the same ten bars.
const BARS = [6, 2, 9, 4, 10, 1, 7, 3, 8, 5]
const swaps = sort => { const a = [...BARS], out = [[...a]]; sort(a, (i, j) => { [a[i], a[j]] = [a[j], a[i]]; out.push([...a]) }); return out }
const BUBBLE = swaps((a, swap) => { for (let i = 0; i < a.length; i++) for (let j = 0; j < a.length - 1 - i; j++) if (a[j] > a[j + 1]) swap(j, j + 1) })
const SELECTION = swaps((a, swap) => { for (let i = 0; i < a.length; i++) { let m = i; for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j; if (m !== i) swap(i, m) } })
const sortRace = {
  dur: 8.5,
  draw(p, t) {
    const step = Math.max(0, Math.floor((t - .6) * 4.5))
    ;[["swap neighbours", BUBBLE, -6.3], ["pick the smallest", SELECTION, .7]].forEach(([name, steps, x]) => {
      const n = Math.min(step, steps.length - 1), done = n === steps.length - 1
      steps[n].forEach((v, i) => p.rect(x + i * .56, -2, .46, v * .36, { fill: done ? C.green : i % 2 ? C.blue : C.teal }))
      p.text(name, [x + 2.75, 2.9], { size: .52 })
      p.text(done ? `done in ${n} swaps` : `${n} swaps`, [x + 2.75, -2.7], { size: .46, color: done ? C.green : C.faint })
    })
  }
}

const shotArc = {
  dur: 8,
  draw(p, t) {
    const S = [-5.2, -2], D = 9.6, rise = 3.2
    p.line([-6.6, -2.7], [6.6, -2.7], { stroke: C.line })
    p.line([5, 1.2], [5, 2.5], { stroke: C.ink, width: 5 }); p.line([4, 1.2], [5, 1.2], { stroke: C.red, width: 6 })
    ;[[38, C.blue], [48, C.yellow], [60, C.green]].forEach(([angle, color], i) => {
      const k = clamp((t - .5 - i * 2.2) / 1.8, 0, 1), tan = Math.tan(angle * Math.PI / 180), drop = (tan * D - rise) / D / D
      if (!k) return
      const at = dx => [S[0] + dx, S[1] + tan * dx - drop * dx * dx], pts = []
      for (let n = 0; n <= 40; n++) pts.push(at(D * k * n / 40))
      p.poly(pts, { stroke: color, width: 3, close: false, alpha: k < 1 ? 1 : .45 })
      if (k < 1) p.circle(at(D * k), .26, { fill: "#e8833a" })
      p.text(`${angle}°`, add(at(1 + i * 1.1), [-.7, .4]), { size: .4, color })
    })
    p.circle(S, .2, { fill: C.ink })
    p.text("three ways in. Which is the easiest shot?", [0, -3.4], { size: .46, color: C.faint })
  }
}

const unrollRings = {
  dur: 7.5,
  draw(p, t) {
    const M = 9, R = 1.9, by = -1.9, k = ph(t, 1, 4.2)
    for (let j = 1; j <= M; j++) {
      const r = j * R / M, y0 = by + R - r, pts = []
      // The ring, cut at the top and flattening: the same length of line, bending less and less.
      for (let n = 0; n <= 48; n++) {
        const u = n / 24 - 1
        if (1 - k < 1e-3) { pts.push([u * Math.PI * r, y0]); continue }
        const rho = r / (1 - k), phi = u * Math.PI * (1 - k)
        pts.push([rho * Math.sin(phi), y0 + rho * (1 - Math.cos(phi))])
      }
      p.poly(pts, { stroke: j % 2 ? C.blue : C.teal, units: R / M * .78, cap: "butt", close: false })
    }
    const a = ph(t, 4.5, 5.1)
    p.text("2 π r  (the outside edge)", [0, by - .75], { size: .44, color: C.yellow, alpha: a })
    p.line([0, by - .1], [0, by + R], { stroke: C.yellow, alpha: a })
    p.text("r", [.4, by + R + .3], { size: .5, color: C.yellow, alpha: a })
    p.text("a triangle:  ½ × 2 π r × r = π r²", [0, 3.2], { size: .56, alpha: ph(t, 5.1, 5.7) })
  }
}


// ── What π offers ────────────────────────────────────────────────────────────────────────────────────────────────

const QUESTIONS = [
  { title: "Is one large pizza more than two smalls?", clip: pizzaDeal },
  { title: "Why is a Minecraft circle a lie?", clip: blockCircle },
  { title: "What's the best angle to shoot a basketball?", clip: shotArc },
  { title: "What's the fastest way to sort a deck of cards?", clip: sortRace },
  { title: "Is cutting across the grass really shorter?", clip: shortcut },
  { title: "Can you unroll a circle into a triangle?", clip: unrollRings }
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

  // For checking the clips: /start/ideas/1#clips=.8 lays every clip out, stopped 80% of the way through.
  sheet(k) {
    this.element.innerHTML = `<div class="pick__choices" style="width:100%">${QUESTIONS.map(q =>
      `<div class="pick__card"><canvas></canvas><span class="pick__card-sub">${esc(q.title)}</span></div>`).join("")}</div>`
    this.element.querySelectorAll("canvas").forEach((canvas, i) => this.freeze(canvas, QUESTIONS[i].clip, k))
  }

  // ── The beats ──────────────────────────────────────────────────────────────────────────────────────────────────

  async askQuestion() {
    const shown = [0, 1, 2].map(i => QUESTIONS[(this.offset + i) % QUESTIONS.length])
    this.perform(shown[0].clip, false)
    await this.say("You're going to make an animated video that answers one question. Which question? Pick one, or tell me yours.", "speaking")
    this.cards(shown.map(q => ({ clip: q.clip, title: q.title, pick: () => this.plan(q.title, q.clip) })),
      `<div class="pick__row"><form class="pick__ask"><input class="pick__input" maxlength="80" autocomplete="off" placeholder="or yours: how a redstone door works"><button class="pick__chip">Mine ▸</button></form>
       <button type="button" class="pick__chip pick__chip--quiet" data-do="more">Show me others</button></div>`)
    const form = this.choicesTarget.querySelector("form"), input = form.querySelector("input")
    form.addEventListener("submit", e => { e.preventDefault(); const title = input.value.trim(); if (title) this.plan(title, null) })
    this.on("more", () => { this.offset = (this.offset + 3) % QUESTIONS.length; this.askQuestion() })
  }

  // What you're building, said plainly. clip: π's sketch of the question; null when the question is your own.
  async plan(title, clip) {
    this.perform(clip ?? { dur: 6, draw: (p, t) => p.wrap(title, [0, .5], 11, { size: .9, alpha: ph(t, .2, 1) }) }, !!clip)
    await this.say(clip
      ? `"${title}" That's your video: it asks the question, then shows the answer. I've sketched how it could open. The answer you'll dig up yourself, and I'll help you get started. Plan on about three hours.`
      : `"${title}" I want to watch that. Your video asks the question, then shows the answer. I don't know the answer to yours, so you'll dig it up, and I'll help you get started. Plan on about three hours.`, clip ? "happy" : "awe")
    this.choicesTarget.className = "pick__choices"
    this.choicesTarget.innerHTML = `<div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="back">◂ pick another</button>
      <button type="button" class="pick__chip pick__chip--go" data-do="next">That's my video ▸</button></div>`
    this.on("back", () => this.askQuestion())
    this.on("next", async () => {
      await this.say("That's where this demo stops. In the real thing your prize comes next, and this question is waiting in your editor.", "hooray")
      this.choicesTarget.innerHTML = `<div class="pick__row"><button type="button" class="pick__chip pick__chip--quiet" data-do="again">◂ start over</button></div>`
      this.on("again", () => this.askQuestion())
    })
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
