import { Controller } from "@hotwired/stimulus"
import { capture } from "analytics"
import { audio } from "audio"
import { sfx } from "sfx"

// Onboarding as a story (onboarding/story.html.erb, a demo). π drops into a vector field, and as the story goes on you
// meet friends, each a math symbol, who show you something and bring a tool along: ∫ the examples, { } the code, ∞ your
// buddy, Σ the board. The editor assembles itself around you as they arrive: the stage gets a frame, the code pane slides
// in, then the timeline, the rail of friends and the top bar. The questions are theirs to ask, as dialogue choices; at
// the end you sign, which keeps the same Pledge as the pledge page, and the friends hop into their rail slots as the
// editor finishes assembling. Every piece is at the editor's own size and the stage ends where the editor's canvas is,
// so the hand-over to /editor (a full page load: Python needs it) changes nothing on screen; a snapshot of the last
// frame stands in on the editor's stage until Python has drawn the first one.
//
// Click, Space or Enter moves the dialogue on; skip fast-forwards to the next question, the way a game skips a
// cutscene (you still answer everything, so the pledge still gets made). The script is run(): a plain list of beats.
const W_UNITS = 14.2, H_UNITS = 8
const CODE_KEY = "manimator:code"
const VIEW_KEY = "manimator:view"
const POSTER_KEY = "manimator:poster" // the story's last frame, shown on the editor's stage until Python draws
const HOLD_MS = 1300
const PI_FEET = .79
const ACTOR = 1.35 // a character's height, in units
const EPI_LOOP = 7  // seconds for ∫'s circles to draw π once

// The friends, in the editor rail's order. How they look comes from FriendsHelper (the rail's markup is cloned for
// the stage and the dialogue); here is how they sound, where their feet are, and what they're called.
const FRIENDS = {
  pi: { name: "π", tool: "home", note: 72, color: "#58C4DD" },
  code: { name: "{ }", tool: "code", note: 76, color: "#9A72AC", feet: .86 },
  inf: { name: "∞", tool: "buddy", note: 74, color: "#83C167", feet: .84 },
  sig: { name: "Σ", tool: "board", note: 67, color: "#FC6255", feet: .86 },
  int: { name: "∫", tool: "examples", note: 79, color: "#5CD0B3", feet: .97 },
}
const RAIL = ["pi", "code", "inf", "sig", "int"]
// Where everyone stands once there's a crowd, along the bottom of the stage.
const SPOT = { pi: -5.3, code: -3.8, sig: -2.3, inf: 3.8, int: 5.3 }

// A rough π, traced by Fourier epicycles when ∫ shows off.
const PI_PATH = [[-1.6, .95], [1.6, .95], [1.6, .55], [.9, .55], [.9, -.8], [1.25, -1.05], [1.1, -1.2], [.55, -.95], [.55, .55],
  [-.5, .55], [-.6, -.5], [-1, -1.15], [-1.3, -1.05], [-.95, -.45], [-.9, .55], [-1.6, .55]]

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v
const lerp = (a, b, k) => a + (b - a) * k
const smooth = k => k * k * (3 - 2 * k)
const ease = (from, to, dt, rate) => lerp(from, to, 1 - Math.exp(-dt * rate))
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c])
const wait = ms => new Promise(r => setTimeout(r, ms))
// "19:00" → "7pm", "15:30" → "3:30pm"
const clockTime = hhmm => { const [h, m] = hhmm.split(":").map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}` }
const shortDate = d => d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })

// The scene as the editor opens it: the field you met π in, and your idea written over it. The code pane shows the
// same lines as they come in. Each line is [id, text]; ids are what light() points at.
function sceneLines(idea, k = 1) {
  const lines = [
    ["", "from manim import *"], ["", ""], ["", ""],
    ["", "class FirstScene(Scene):"],
    ["", "    def construct(self):"],
    ["k", `        k = ${k.toFixed(1)}`],
    ["", ""],
    ["field", "        def flow(p):"],
    ["field", "            x, y = p[0], p[1]"],
    ["field", "            return [np.sin(k * y), np.sin(k * x), 0]"],
    ["", ""],
    ["field", "        self.add(ArrowVectorField(flow))"],
  ]
  if (idea) lines.push(
    ["title", `        title = Text(${JSON.stringify(idea)}, font_size=48)`],
    ["title", "        if title.width > 12:"],
    ["title", "            title.scale_to_fit_width(12)"],
    ["title", "        title.to_edge(UP)"],
    ["title", "        self.play(Write(title))"],
    ["title", "        self.wait()"])
  return lines
}
const sceneCode = idea => sceneLines(idea).map(([, text]) => text).join("\n") + "\n"

// Just enough Python colouring for these lines, in the editor's colours.
const TOKEN = /("(?:[^"\\]|\\.)*")|\b(from|import|class|def|lambda|if|return)\b|\b(\d+(?:\.\d+)?)\b|\b(ArrowVectorField|Text|Write|Scene|FirstScene|UP)\b|\b(construct|flow)\b/g
function highlight(line) {
  let out = "", at = 0
  for (const m of line.matchAll(TOKEN)) {
    const cls = m[1] ? "c-str" : m[2] ? "c-kw" : m[3] ? "c-num" : m[4] ? "c-fn" : "c-def"
    out += esc(line.slice(at, m.index)) + `<span class="${cls}">${esc(m[0])}</span>`
    at = m.index + m[0].length
  }
  return out + esc(line.slice(at))
}

// The discrete Fourier transform of a closed path, biggest circles first.
function epicycles(points, n = 96) {
  const per = [], lens = points.map((p, i) => Math.hypot(points[(i + 1) % points.length][0] - p[0], points[(i + 1) % points.length][1] - p[1]))
  const total = lens.reduce((a, b) => a + b, 0)
  for (let i = 0; i < n; i++) {
    let d = i / n * total, j = 0
    while (d > lens[j]) { d -= lens[j]; j++ }
    const a = points[j], b = points[(j + 1) % points.length], k = d / lens[j]
    per.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)])
  }
  const out = []
  for (let k = -n / 2; k < n / 2; k++) {
    let re = 0, im = 0
    per.forEach(([x, y], t) => { const a = -2 * Math.PI * k * t / n; re += x * Math.cos(a) - y * Math.sin(a); im += x * Math.sin(a) + y * Math.cos(a) })
    out.push({ freq: k, amp: Math.hypot(re, im) / n, phase: Math.atan2(im, re) })
  }
  return out.sort((a, b) => b.amp - a.amp).slice(0, 48)
}
const CIRCLES = epicycles(PI_PATH)

export default class extends Controller {
  static targets = ["canvas", "bar", "rail", "code", "timeline", "cast", "dialog", "portrait", "name", "text", "choices", "next", "skip"]
  static values = { poses: Object, prizes: Array, slots: Object, days: Array, sessions: Object, classes: Array,
    drawUrl: String, claimUrl: String, pledgeUrl: String, scenesUrl: String, editorUrl: String, hours: Number }

  connect() {
    this.clock = 0
    this.startedAt = performance.now()
    this.show = { bar: false, rail: false, code: false, timeline: false, dialog: false, frame: false }
    this.rect = { x: 0, y: 0, w: innerWidth, h: innerHeight }
    this.scene = { field: 0, epi: 0, title: 0, k: 1 }
    this.want = { field: 1, epi: 0 }
    this.actors = {}
    this.met = new Set()
    this.answers = {}
    this.sparks = []
    this.pointer = null
    this.ctx = this.canvasTarget.getContext("2d")
    this.serif = getComputedStyle(document.documentElement).getPropertyValue("--serif").trim() || "Georgia, serif"
    this.images = {}
    for (const [pose, src] of Object.entries(this.posesValue)) { const img = new Image(); img.src = src; this.images[pose] = img }

    this.layout()
    this.particles()
    this.onResize = () => this.size()
    this.onKey = e => this.key(e)
    this.onClick = e => this.click(e)
    this.onMove = e => this.stir(e)
    addEventListener("resize", this.onResize)
    addEventListener("keydown", this.onKey)
    this.element.addEventListener("click", this.onClick)
    addEventListener("pointermove", this.onMove)
    this.onLeave = () => this.abandoned()
    addEventListener("pagehide", this.onLeave)
    this.size()

    this.last = performance.now()
    const loop = now => { this.frame(now); this.raf = requestAnimationFrame(loop) }
    this.raf = requestAnimationFrame(loop)

    const decoded = Promise.all(Object.values(this.images).map(img => img.decode().catch(() => {})))
    Promise.race([decoded, wait(800)]).then(() => this.run())
  }

  disconnect() {
    this.gone = true
    cancelAnimationFrame(this.raf)
    removeEventListener("resize", this.onResize)
    removeEventListener("keydown", this.onKey)
    removeEventListener("pointermove", this.onMove)
    removeEventListener("pagehide", this.onLeave)
    this.abandoned()
    cancelAnimationFrame(this.holdRaf)
  }

  // ── The editor, piece by piece ───────────────────────────────────────────────────────────────────────────────

  reveal(part, on = true) {
    this.show[part] = on
    this.layout()
  }

  // Each piece of the editor is a CSS variable the others lay out around; the stage's frame follows in frame().
  layout() {
    const narrow = innerWidth < 760, s = this.show, st = this.element.style
    st.setProperty("--bar", s.bar ? "60px" : "0px")
    st.setProperty("--rail", s.rail ? "64px" : "0px")
    st.setProperty("--code", s.code && !narrow ? (innerWidth <= 1240 ? "420px" : "520px") : "0px")
    st.setProperty("--tl", this.final ? "250px" : s.timeline ? "64px" : "0px")
    for (const part of ["bar", "rail", "code", "timeline", "dialog"]) this.element.toggleAttribute(`data-${part}`, s[part])
    this.element.toggleAttribute("data-frame", s.frame)
    this.element.toggleAttribute("data-final", !!this.final)
  }

  targetRect() {
    const cs = getComputedStyle(this.element), px = v => parseFloat(cs.getPropertyValue(v)) || 0
    const W = innerWidth, H = innerHeight
    if (!this.show.frame) return { x: 0, y: 0, w: W, h: H }
    if (this.final) {
      // Where the editor puts its canvas: 16:9, as big as fits in its pane less 40 × 32 of padding, centred.
      const x0 = px("--rail") + px("--code"), y0 = px("--bar"), pw = W - x0, ph = H - y0 - px("--tl")
      const w = Math.max(0, Math.floor(Math.min(pw - 40, (ph - 32) * 16 / 9))), h = Math.floor(w * 9 / 16)
      return { x: x0 + (pw - w) / 2, y: y0 + (ph - h) / 2, w, h }
    }
    const pad = W < 760 ? 10 : 20
    const left = px("--rail") + (this.show.code ? this.codeTarget.getBoundingClientRect().width : 0) + pad
    const top = px("--bar") + pad
    const bottom = px("--tl") + (this.show.dialog ? Math.min(this.dialogTarget.offsetHeight, 150) + 24 : 0) + pad
    return { x: left, y: top, w: Math.max(100, W - left - pad), h: Math.max(80, H - top - bottom) }
  }

  // A friend as FriendsHelper drew them in the rail, for the stage and the dialogue.
  friend(id) { return this.railTarget.querySelector(`[data-friend="${id}"] .friend`).outerHTML }

  meet(id) {
    if (this.met.has(id)) return
    this.met.add(id)
    if (!this.show.rail) this.reveal("rail")
    const slot = this.railTarget.querySelector(`[data-friend="${id}"]`)
    slot.classList.add("story__slot--met")
    sfx.meet(FRIENDS[id].note)
    this.toast(id, slot)
  }

  // An achievement-style badge out of the friend's rail slot: who joined, and how many of the five you've met.
  toast(id, slot) {
    const f = FRIENDS[id], el = document.createElement("div")
    el.className = "story__toast"
    el.innerHTML = `<b style="color:${f.color}">${f.name}</b> joined <span>· ${this.met.size} of ${RAIL.length} friends</span>`
    this.element.append(el)
    const place = () => { const r = slot.getBoundingClientRect(); el.style.top = `${r.top + r.height / 2}px` }
    requestAnimationFrame(place)
    setTimeout(place, 850) // the rail may still be sliding in
    setTimeout(() => el.classList.add("story__toast--out"), 2600)
    setTimeout(() => el.remove(), 3200)
  }

  // The code pane: what you're looking at, as manim code. Lines light up as someone talks about them.
  renderCode() {
    this.codeTarget.innerHTML = sceneLines(this.answers.idea, this.scene.k).map(([id, text], i) => {
      const html = id === "k" ? `        k = <span class="c-num" data-k>${this.scene.k.toFixed(1)}</span>` : highlight(text)
      return `<div class="sl ${id && id === this.lit ? "sl--lit" : ""} ${id === "title" ? "sl--new" : ""}"><span class="sl__n">${i + 1}</span><span>${html || " "}</span></div>`
    }).join("")
    this.kEl = this.codeTarget.querySelector("[data-k]")
  }

  light(id) { this.lit = id; this.renderCode() }

  renderTimeline() {
    this.timelineTarget.innerHTML = `<span class="story__clip story__clip--blue" style="left:0;width:30%">field</span>
      ${this.answers.idea ? `<span class="story__clip story__clip--teal" style="left:31%;width:34%">Write(title)</span>` : ""}
      <span class="story__head" style="left:${this.answers.idea ? 65 : 30}%"></span>`
  }

  // ── The cast ─────────────────────────────────────────────────────────────────────────────────────────────────

  enter(id, { x, y = -2.9, from = 1 } = {}) {
    const el = document.createElement("div")
    el.className = "story__actor"
    el.innerHTML = id === "pi" ? `<img alt="" draggable="false">` : this.friend(id)
    this.castTarget.append(el)
    const a = this.actors[id] = { id, el, x: from * (W_UNITS / 2 + 1.5), y, tx: x ?? SPOT[id], ty: y, walk: 0, hop: 0, talk: false, pose: "plain", sx: 1, sy: 1 }
    if (id === "pi") this.setPose("plain")
    return a
  }

  moveTo(id, x, y = this.actors[id].ty) { const a = this.actors[id]; a.tx = x; a.ty = y }
  lineUp() { for (const id of Object.keys(this.actors)) this.moveTo(id, SPOT[id], -2.9) }

  setPose(pose) {
    const pi = this.actors.pi
    if (!pi || !this.posesValue[pose] || pi.pose === pose) return
    pi.pose = pose
    pi.el.querySelector("img").src = this.posesValue[pose]
  }

  cheer() { Object.values(this.actors).forEach((a, i) => { a.cheerAt = this.clock + i * .08 }); this.setPose("hooray") }

  moveActors(dt) {
    const s = this.s, r = this.rect
    for (const a of Object.values(this.actors)) {
      if (a.home) continue
      if (!a.falling) {
        const dx = a.tx - a.x, step = Math.sign(dx) * Math.min(Math.abs(dx), dt * (this.skipping ? 20 : 4))
        a.x += step
        a.y = ease(a.y, a.ty, dt, 8)
        a.walk = Math.abs(dx) > .02 ? a.walk + dt * 13 : 0
      }
      let lift = Math.abs(Math.sin(a.walk)) * .22, sy = a.sy, rot = a.walk ? Math.sin(a.walk) * 6 : 0
      if (a.cheerAt !== undefined) {
        const c = this.clock - a.cheerAt
        if (c > 0 && c < 1.8) lift += Math.abs(Math.sin(c * Math.PI * 2.2)) * .7 * (1 - c / 1.8)
      }
      if (a.talk) sy *= 1 + Math.sin(this.clock * 22) * .035
      if (!a.walk && !a.talk && !a.falling) lift += Math.sin(this.clock * 2 + a.x) * .03
      const feet = a.id === "pi" ? PI_FEET : FRIENDS[a.id].feet, h = ACTOR * s, w = a.id === "pi" ? h : h * 100 / 110
      const X = r.x + r.w / 2 + a.x * s, Y = r.y + r.h / 2 - (a.y + lift) * s
      a.el.style.width = `${w}px`
      a.el.style.transformOrigin = `50% ${feet * 100}%`
      a.el.style.transform = `translate(${X - w / 2}px, ${Y - h * feet}px) rotate(${rot}deg) scale(${a.sx}, ${sy})`
    }
  }

  // ── Dialogue ─────────────────────────────────────────────────────────────────────────────────────────────────

  async say(who, text, { pose, choices, input, hold, until } = {}) {
    if (this.gone) return new Promise(() => {})
    if (!this.show.dialog) this.reveal("dialog")
    if (pose) this.setPose(pose)
    const f = FRIENDS[who]
    this.portraitTarget.innerHTML = who === "pi" ? `<img src="${this.posesValue[pose ?? this.actors.pi?.pose ?? "plain"]}" alt="">` : this.friend(who)
    this.nameTarget.textContent = f.name
    this.nameTarget.style.color = f.color
    this.choicesTarget.replaceChildren()
    this.nextTarget.hidden = true
    this.dialogTarget.classList.remove("story__dialog--pop"); void this.dialogTarget.offsetWidth; this.dialogTarget.classList.add("story__dialog--pop")
    const decision = !!(choices || input || hold)
    if (decision) this.skipping = false
    this.skipTarget.hidden = decision
    const speaker = this.actors[who]
    if (speaker) speaker.talk = true
    await this.type(text, f.note)
    if (speaker) speaker.talk = false
    if (!decision && this.skipping) return
    // A big moment (∫'s drawing, k turning) holds until it has played out, so a quick click can't cut it short.
    if (until) await this.dwell(until)
    if (!decision && this.skipping) return
    if (choices) return this.offer(choices)
    if (input) return this.ask(input)
    if (hold) return this.holdToSign(hold)
    this.nextTarget.hidden = false
    await new Promise(r => { this.advance = r })
    this.advance = null
  }

  type(text, note) {
    if (this.skipping) { this.textTarget.textContent = text; return Promise.resolve() }
    return new Promise(resolve => {
      this.textTarget.textContent = ""
      let i = 0, acc = 0, last = performance.now()
      this.skipTyping = () => { i = text.length }
      const step = now => {
        if (this.gone) return
        acc += (now - last) / 1000 * 40; last = now
        while (acc >= 1 && i < text.length) {
          acc -= 1; i++
          const c = text[i - 1]
          if (i % 2 === 0 && /\S/.test(c)) sfx.blip(note)
          if (/[.!?]/.test(c) && text[i] === " ") acc -= 6
          else if (c === ",") acc -= 2.5
        }
        this.textTarget.textContent = text.slice(0, i)
        if (i >= text.length) { this.skipTyping = null; return resolve() }
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
  }

  offer(choices) {
    // Choices with a line under them (ideas) stack as a list, every row the same width.
    this.choicesTarget.classList.toggle("story__choices--list", choices.some(c => c.sub && !c.image))
    return new Promise(resolve => {
      this.choicesTarget.innerHTML = choices.map((c, i) => `<button type="button" class="story__choice ${c.image ? "story__choice--card" : ""}" data-i="${i}">
        ${c.image ? `<img src="${c.image}" alt="">` : ""}<span class="story__choice-label">${esc(c.label)}</span>${c.sub ? `<span class="story__choice-sub">${esc(c.sub)}</span>` : ""}</button>`).join("")
      const buttons = [...this.choicesTarget.querySelectorAll("button")]
      buttons.forEach((b, i) => b.addEventListener("click", e => {
        e.stopPropagation()
        sfx.tick(i)
        this.choicesTarget.replaceChildren()
        resolve(choices[i].value ?? choices[i].label)
      }))
      buttons[0]?.focus({ preventScroll: true })
    })
  }

  ask({ placeholder, button }) {
    return new Promise(resolve => {
      this.choicesTarget.innerHTML = `<form class="story__ask"><input class="story__input" maxlength="80" spellcheck="false" autocomplete="off" placeholder="${esc(placeholder)}">
        <button class="story__choice" disabled>${esc(button)}</button></form>`
      const form = this.choicesTarget.querySelector("form"), input = form.querySelector("input"), ok = form.querySelector("button")
      input.addEventListener("input", () => { ok.disabled = !input.value.trim() })
      form.addEventListener("submit", e => { e.preventDefault(); if (input.value.trim()) { sfx.tick(3); resolve(input.value.trim()) } })
      input.focus()
    })
  }

  holdToSign(label) {
    return new Promise(resolve => {
      this.choicesTarget.innerHTML = `<button type="button" class="story__hold"><span class="story__hold-fill"></span><span class="story__hold-label">${esc(label)}</span></button>`
      const b = this.choicesTarget.querySelector("button"), fill = b.querySelector(".story__hold-fill")
      let held = false, k = 0, last = 0
      const tick = now => {
        const dt = now - last; last = now
        k = clamp(k + (held ? dt / HOLD_MS : -dt / 350), 0, 1)
        fill.style.transform = `scaleX(${k})`
        if (k >= 1) { resolve(); return }
        if (held || k > 0) this.holdRaf = requestAnimationFrame(tick)
      }
      const start = e => { if (e.button > 0) return; e.preventDefault(); held = true; audio.unlock(); last = performance.now(); cancelAnimationFrame(this.holdRaf); this.holdRaf = requestAnimationFrame(tick) }
      const end = () => { held = false }
      b.addEventListener("pointerdown", start)
      ;["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, end))
      b.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) start(e) })
      b.addEventListener("keyup", end)
      b.addEventListener("click", e => e.stopPropagation())
      b.focus({ preventScroll: true })
    })
  }

  click(event) {
    audio.unlock()
    if (event.target.closest("button, a, input, form, .story__code, .story__rail")) return
    this.next()
  }

  key(event) {
    if (event.target.closest?.("input, button")) return
    if (event.key === " " || event.key === "Enter") { event.preventDefault(); audio.unlock(); this.next() }
  }

  next() {
    if (this.skipTyping) return this.skipTyping()
    this.advance?.()
  }

  // Fast-forward: talk and entrances race by until the next question.
  skip(event) {
    event?.stopPropagation()
    audio.unlock()
    this.skipping = true
    capture("onboarding_skipped", { variant: "story", step: this.beat, seconds: this.seconds })
    this.skipTyping?.()
    this.advance?.()
  }

  // Each beat is a step, logged like the pledge page's, so the two can be compared and drop-off read beat by beat.
  step(name) {
    this.beat = name
    capture("onboarding_step_viewed", { variant: "story", step: name, seconds: this.seconds })
  }

  get seconds() { return Math.round((performance.now() - this.startedAt) / 100) / 10 }

  abandoned() {
    if (this.signed || this.left) return
    this.left = true
    capture("onboarding_abandoned", { variant: "story", step: this.beat, seconds: this.seconds })
  }

  dwell(until) {
    return new Promise(resolve => {
      const check = () => (this.skipping || this.clock >= until || this.gone) ? resolve() : requestAnimationFrame(check)
      check()
    })
  }

  pause(ms) { return wait(this.skipping ? ms * .15 : ms) }

  // ── The story ────────────────────────────────────────────────────────────────────────────────────────────────

  async run() {
    this.step("drop")
    await this.drop()
    this.step("hello")
    await this.pause(700)
    this.meet("pi")
    // The first click is a choice: it should feel like playing, not reading.
    const hi = await this.say("pi", "Whoa! Hi, I'm π. Wave your cursor around. The field tickles.",
      { pose: "hooray", choices: [{ label: "Hi π!", value: "hi" }, { label: "Where am I?", value: "where" }] })
    if (hi === "where") await this.say("pi", "In a vector field! Every arrow points where sin y and sin x say to.", { pose: "awe" })

    // ∫ and the examples: it shows off while it talks.
    this.step("examples")
    this.moveTo("pi", -3.2, -2.4)
    this.enter("int", { x: 3.2, y: -2.4 })
    await this.pause(1300)
    this.meet("int")
    this.reveal("frame")
    this.want = { field: .22, epi: 1 }
    this.epiStart = this.clock
    this.lineUp()
    setTimeout(() => { this.setPose("hooray"); if (this.actors.pi) this.actors.pi.cheerAt = this.clock }, EPI_LOOP * 1000)
    await this.say("int", "I'm ∫! I collect scenes. Watch: circles riding on circles can draw anything. Even π.", { until: this.clock + EPI_LOOP + .6 })

    // { } and the code: the field comes back, with what made it.
    this.step("code")
    this.enter("code", { from: -1 })
    await this.pause(1100)
    this.meet("code")
    this.want = { field: 1, epi: 0 }
    this.renderCode()
    this.reveal("code")
    this.light("k")
    this.kFrom = this.clock + .6
    await this.say("code", "Psst, I'm { }. These few lines made that field. Watch what happens when k changes.", { until: this.kFrom + 6 })
    this.light(null)

    // Your idea
    this.step("idea")
    const idea = await this.pickIdea()
    Object.assign(this.answers, idea)
    this.renderCode()
    this.light("title")
    this.titleStart = this.clock
    sfx.write(1.6)
    this.reveal("timeline")
    this.renderTimeline()
    await this.pause(1700)
    this.light(null)
    await this.say("pi", "That's your first frame. Look at it!", { pose: "awe" })
    // ∞ and your buddy
    this.step("buddy")
    this.enter("inf")
    await this.pause(800)
    await this.say("inf", "Hi hi! I'm ∞. Nobody ships alone, so I'll keep you company.")
    this.meet("inf")
    const slots = Object.keys(this.slotsValue)
    this.answers.when = await this.say("inf", "When do you usually have time?", { choices: slots.map(s => ({ label: s })) })
    this.answers.days = this.answers.when === "weekends" ? 2 : await this.say("inf", "How many days a week?",
      { choices: this.daysValue.map(d => ({ label: d === 7 ? "every day" : `${d} days`, value: d })) })
    this.answers.minutes = Number(await this.say("inf", "And for how long each time?",
      { choices: Object.entries(this.sessionsValue).map(([m, label]) => ({ label, value: m })) }))
    this.answers.shipBy = this.shipBy()
    await this.say("inf", `At that pace your video is done by ${shortDate(this.answers.shipBy)}. I'll check in ${this.answers.when === "weekends" ? "on weekends" : `around ${clockTime(this.slotsValue[this.answers.when])}`}.`)

    // Σ and the board
    this.step("prize")
    this.enter("sig", { from: -1 })
    await this.pause(800)
    await this.say("sig", "And I'm Σ. I add up everyone who ships.")
    this.meet("sig")
    const prizeId = await this.say("sig", "Ship it, and the 3Blue1Brown store mails you one of these. Pick one.",
      { choices: this.prizesValue.map(p => ({ label: p.name, sub: `about ${p.videos}`, image: p.image, value: p.id })) })
    this.answers.prize = prizeId
    const prize = this.prizesValue.find(p => p.id === prizeId)
    await this.say("sig", `The ${prize.name}. Good choice.`)

    // Signing
    this.step("sign")
    await this.say("pi", `So: "${this.answers.idea}", done by ${shortDate(this.answers.shipBy)}. Then the ${prize.name} is yours.`, { pose: "speaking" })
    await this.say("pi", "Sign it and it's official. We'll all be cheering.", { pose: "happy", hold: "Hold to sign" })
    await this.sign()
    this.signed = true
    this.step("signed")
    this.cheer()
    this.reveal("bar")
    this.burst(0, 1, 60)
    sfx.land()
    await this.say("pi", "It's official! Let's go make it move.", { pose: "hooray", choices: [{ label: "Open the editor →", value: "go" }] })
    await this.handOff()
  }

  async pickIdea() {
    const how = await this.say("pi", "That's Manimator: write a little, and math moves. Your turn! What do you wish someone could finally see?",
      { pose: "happy", choices: [{ label: "Surprise me", value: "draw" }, { label: "I have an idea", value: "own" }] })
    if (how === "own") return { idea: await this.say("pi", "Tell me! Anything you can show with moving pictures.", { pose: "awe", input: { placeholder: "how attention works in transformers", button: "That one" } }), ideaId: null }
    const klass = await this.say("pi", "What math class are you in? I'll find you ideas nobody else has.",
      { pose: "thinking", choices: this.classesValue.map(c => ({ label: c.label, value: c.key })) })
    let seen = []
    for (;;) {
      const ideas = await this.drawIdeas(klass, seen)
      if (!ideas.length) return { idea: await this.say("pi", "Huh, they're all taken! Tell me your own instead.", { pose: "erm", input: { placeholder: "how attention works in transformers", button: "That one" } }), ideaId: null }
      seen = [...seen, ...ideas.map(i => i.id)]
      const pick = await this.say("pi", "Here are three. Whichever you pick, nobody else gets it.",
        { pose: "speaking", choices: [...ideas.map(i => ({ label: i.title, sub: i.line, value: i.id })), { label: "Show me others", value: "more" }] })
      if (pick !== "more") { const idea = ideas.find(i => i.id === pick); return { idea: idea.title, ideaId: idea.id } }
    }
  }

  async drawIdeas(klass, except) {
    try {
      const response = await this.post(this.drawUrlValue, { klass, except })
      return response.status === 200 ? await response.json() : []
    } catch { return [] }
  }

  shipBy() {
    const { days, minutes } = this.answers
    const sessions = Math.ceil(this.hoursValue * 60 / minutes)
    const date = new Date()
    date.setDate(date.getDate() + Math.max(sessions - 1, Math.ceil(sessions / days * 7)))
    return date
  }

  // Keeps the same Pledge the pledge page does, and leaves your idea in the editor.
  async sign() {
    const a = this.answers
    if (a.ideaId) { try { await this.post(this.claimUrlValue.replace("ID", a.ideaId)) } catch { /* offline: keep going */ } }
    try {
      await this.post(this.pledgeUrlValue, { pledge: {
        idea: a.idea, idea_record_id: a.ideaId, prize: a.prize, build_time: a.when, days_per_week: a.days,
        session_minutes: a.minutes, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ship_by: a.shipBy.toISOString().slice(0, 10),
      } })
    } catch { /* offline */ }
    capture("onboarding_pledge_signed", { variant: "story", idea: a.idea, prize: a.prize, when: a.when, days: a.days, minutes: a.minutes })
    // Your scene, saved now, so the editor opens this one even if you have others. Offline, it waits in localStorage
    // instead, which the editor turns into a scene when you have none yet.
    try {
      const response = await this.post(this.scenesUrlValue, { scene: { code: sceneCode(a.idea) } })
      if (response.ok) this.sceneId = (await response.json()).id
    } catch { /* offline */ }
    try {
      if (!this.sceneId) localStorage.setItem(CODE_KEY, sceneCode(a.idea))
      localStorage.setItem(VIEW_KEY, "code")
    } catch { /* storage unavailable */ }
  }

  post(url, body = {}) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": document.querySelector("meta[name=csrf-token]")?.content },
      body: JSON.stringify(body),
    })
  }

  // π falls in from above, hits the field and wakes it with a ripple.
  async drop() {
    const pi = this.enter("pi", { x: 0, y: -.8, from: 0 })
    pi.x = 0; pi.y = H_UNITS / 2 + 1.5; pi.falling = true
    this.setPose("surprised")
    await wait(350)
    sfx.fall(.6)
    const from = this.clock
    await new Promise(resolve => {
      const fall = () => {
        const f = clamp((this.clock - from) / .6, 0, 1)
        pi.y = lerp(H_UNITS / 2 + 1.5, -.8, f * f)
        pi.sy = 1 + .16 * f; pi.sx = 1 / Math.sqrt(pi.sy)
        if (f < 1) return requestAnimationFrame(fall)
        resolve()
      }
      fall()
    })
    this.landAt = this.clock
    this.landY = -.8
    sfx.land()
    this.burst(0, -.4, 36)
    this.setPose("hooray")
    const hit = this.clock
    await new Promise(resolve => {
      const wobble = () => {
        const t = this.clock - hit
        pi.sy = t < .05 ? lerp(1.16, .72, smooth(t / .05)) : 1 - .28 * Math.exp(-t * 6) * Math.cos(t * 15)
        pi.sx = 1 + (1 - pi.sy) * .7
        if (t < 1.1) return requestAnimationFrame(wobble)
        pi.sx = pi.sy = 1; pi.falling = false; pi.tx = 0; pi.ty = -.8
        resolve()
      }
      wobble()
    })
    this.setPose("awe")
  }

  // ── Into the editor ──────────────────────────────────────────────────────────────────────────────────────────

  // The dialogue goes, the timeline opens to its full height, everyone hops home into their rail slot and the music
  // fades; then a snapshot of the stage for the editor to show while Python wakes up, and over we go.
  async handOff() {
    this.step("editor")
    this.final = true
    this.light(null)
    this.reveal("dialog", false)
    audio.stopBed(1.8)
    RAIL.forEach((id, i) => setTimeout(() => this.goHome(id), 250 + i * 170))
    await wait(250 + RAIL.length * 170 + 1000)
    this.savePoster()
    const url = new URL(this.editorUrlValue, location.href)
    if (this.sceneId) url.searchParams.set("scene", this.sceneId)
    location.assign(url)
  }

  goHome(id) {
    const a = this.actors[id], slot = this.railTarget.querySelector(`[data-friend="${id}"]`)
    if (!a || !slot) return
    const g = slot.querySelector(".friend").getBoundingClientRect(), r = a.el.getBoundingClientRect()
    a.home = true
    const scale = g.height / r.height, tx = g.left + g.width / 2 - r.width / 2, ty = g.top + g.height / 2 - r.height / 2
    a.el.style.transformOrigin = "50% 50%"
    const hop = a.el.animate([
      { transform: `translate(${r.left}px, ${r.top}px)` },
      { transform: `translate(${(r.left + tx) / 2}px, ${Math.min(r.top, ty) - 90}px) scale(${(1 + scale) / 2}) rotate(-12deg)`, offset: .45 },
      { transform: `translate(${tx}px, ${ty}px) scale(${scale})` },
    ], { duration: 720, easing: "cubic-bezier(.45, 0, .25, 1)", fill: "forwards" })
    hop.finished.then(() => {
      a.el.remove()
      delete this.actors[id]
      slot.classList.remove("story__slot--home"); void slot.offsetWidth; slot.classList.add("story__slot--home")
      sfx.blip(FRIENDS[id].note)
    })
  }

  savePoster() {
    try {
      const r = this.rect, d = this.canvasTarget.width / innerWidth, c = document.createElement("canvas")
      c.width = Math.round(r.w * d); c.height = Math.round(r.h * d)
      c.getContext("2d").drawImage(this.canvasTarget, r.x * d, r.y * d, r.w * d, r.h * d, 0, 0, c.width, c.height)
      sessionStorage.setItem(POSTER_KEY, c.toDataURL("image/jpeg", .85))
    } catch { /* storage full or unavailable: the editor just starts dark */ }
  }

  // ── The stage ────────────────────────────────────────────────────────────────────────────────────────────────

  size() {
    const d = Math.min(2, devicePixelRatio || 1)
    this.canvasTarget.width = Math.round(innerWidth * d)
    this.canvasTarget.height = Math.round(innerHeight * d)
    this.ctx.setTransform(d, 0, 0, d, 0, 0)
    this.layout()
  }

  stir(event) {
    const r = this.rect, s = this.s
    if (!s) return
    const x = (event.clientX - r.x - r.w / 2) / s, y = (r.y + r.h / 2 - event.clientY) / s, now = performance.now(), p = this.pointer
    if (p) {
      const dt = Math.max(8, now - p.at) / 1000
      p.vx = p.vx * .5 + (x - p.x) / dt * .5; p.vy = p.vy * .5 + (y - p.y) / dt * .5
      p.x = x; p.y = y; p.at = now
    } else this.pointer = { x, y, vx: 0, vy: 0, at: now }
  }

  F(x, y) {
    const k = this.scene.k
    let fx = Math.sin(k * y), fy = Math.sin(k * x)
    const p = this.pointer
    if (p) {
      const dx = x - p.x, dy = y - p.y, g = Math.exp(-(dx * dx + dy * dy) / 2.2)
      if (g > .01) {
        const swirl = 1 + Math.min(2, Math.hypot(p.vx, p.vy) / 8)
        fx += (p.vx * .12 - dy * swirl) * g; fy += (p.vy * .12 + dx * swirl) * g
      }
    }
    return [fx, fy]
  }

  particles() {
    this.p = Array.from({ length: 420 }, () => this.spawn({}))
  }

  spawn(p) {
    p.x = (Math.random() - .5) * 16; p.y = (Math.random() - .5) * 10; p.age = 0; p.life = 2 + Math.random() * 3
    return p
  }

  burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() ** 1.5 * 5
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .8 + 1.5, life: 0, max: .5 + Math.random() * .9, r: 1.4 + Math.random() * 2.4, seed: Math.random() * 9, gold: Math.random() < .6 })
    }
  }

  frame(now) {
    const dt = Math.min(.05, (now - this.last) / 1000)
    this.last = now
    this.clock += dt

    const t = this.targetRect()
    for (const k of ["x", "y", "w", "h"]) this.rect[k] = ease(this.rect[k], t[k], dt, 6)
    this.s = Math.min(this.rect.w / W_UNITS, this.rect.h / H_UNITS)
    this.scene.field = ease(this.scene.field, this.want.field, dt, 3)
    this.scene.epi = ease(this.scene.epi, this.want.epi, dt, 3)
    if (this.titleStart !== undefined) this.scene.title = clamp((this.clock - this.titleStart) / 1.6, 0, 1)
    if (this.kFrom !== undefined) {
      const u = this.clock - this.kFrom, keys = [[0, 1], [1.2, 2.2], [3, .6], [4.6, 1.4], [6, 1]]
      let k = 1
      for (let i = 0; i < keys.length - 1; i++) if (u >= keys[i][0] && u < keys[i + 1][0]) k = lerp(keys[i][1], keys[i + 1][1], smooth((u - keys[i][0]) / (keys[i + 1][0] - keys[i][0])))
      this.scene.k = k
      if (this.kEl) this.kEl.textContent = k.toFixed(1)
      if (u > 6) this.kFrom = undefined
    }
    const p = this.pointer
    if (p) { const k = Math.exp(-dt * 5); p.vx *= k; p.vy *= k }

    for (const q of this.p) {
      const [fx, fy] = this.F(q.x, q.y)
      q.x += fx * dt * .9; q.y += fy * dt * .9; q.age += dt
      if (q.age > q.life || Math.abs(q.x) > 8 || Math.abs(q.y) > 5) this.spawn(q)
    }
    const drag = Math.exp(-dt * 3)
    this.sparks = this.sparks.filter(q => { q.life += dt; q.vx *= drag; q.vy = q.vy * drag - 2.5 * dt; q.x += q.vx * dt; q.y += q.vy * dt; return q.life < q.max })

    this.moveActors(dt)
    this.draw()
  }

  px(x, y) { const r = this.rect; return [r.x + r.w / 2 + x * this.s, r.y + r.h / 2 - y * this.s] }

  draw() {
    const ctx = this.ctx, W = innerWidth, H = innerHeight, r = this.rect, s = this.s
    ctx.globalCompositeOperation = "source-over"
    ctx.globalAlpha = 1
    ctx.fillStyle = "#0e0f11"
    ctx.fillRect(0, 0, W, H)
    ctx.save()
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, this.show.frame ? 10 : 0); ctx.clip()
    ctx.fillStyle = "#0b0c0e"; ctx.fillRect(r.x, r.y, r.w, r.h)

    const ux = r.w / 2 / s, uy = r.h / 2 / s, field = this.scene.field
    // The plane.
    ctx.lineWidth = 1
    ctx.strokeStyle = `rgba(88,196,221,${.06 * field})`
    ctx.beginPath()
    for (let x = -Math.floor(ux); x <= ux; x++) { const [X] = this.px(x, 0); ctx.moveTo(X, r.y); ctx.lineTo(X, r.y + r.h) }
    for (let y = -Math.floor(uy); y <= uy; y++) { const [, Y] = this.px(0, y); ctx.moveTo(r.x, Y); ctx.lineTo(r.x + r.w, Y) }
    ctx.stroke()

    // The field, asleep until π's landing ripples through it.
    const since = this.landAt === undefined ? -1 : this.clock - this.landAt, reach = since * 9
    ctx.lineCap = "round"
    ctx.lineWidth = clamp(s / 40, 1, 1.8)
    for (let gx = -Math.floor(ux * 2) / 2 + .25; gx < ux; gx += .5) for (let gy = -Math.floor(uy * 2) / 2 + .25; gy < uy; gy += .5) {
      const [fx, fy] = this.F(gx, gy), mag = Math.hypot(fx, fy) + 1e-6
      const d = Math.hypot(gx, gy - (this.landY ?? 0))
      const wake = since < 0 ? 0 : smooth(clamp((reach - d) / 1.4, 0, 1))
      const ring = since < 0 ? 0 : Math.exp(-(((d - reach) / .45) ** 2)) * Math.exp(-since * .6)
      const len = Math.min(.46, .4 * (1 - Math.exp(-mag * 1.5))) * (.6 + .4 * wake) * (1 + ring * .4)
      if (len < .04) continue
      const ux2 = fx / mag, uy2 = fy / mag, [cx, cy] = this.px(gx, gy)
      const hx = ux2 * len * s / 2, hy = -uy2 * len * s / 2, head = Math.min(5, len * s * .38)
      ctx.globalAlpha = clamp(((.22 + .4 * wake) + ring * .6) * field, 0, 1)
      ctx.strokeStyle = ctx.fillStyle = ring > .35 ? "#fff" : mag > 1.05 ? "#F4D345" : mag > .55 ? "#5CD0B3" : "#58C4DD"
      ctx.beginPath(); ctx.moveTo(cx - hx, cy - hy); ctx.lineTo(cx + hx - ux2 * head * .7, cy + hy + uy2 * head * .7); ctx.stroke()
      const tx = cx + hx, ty = cy + hy
      ctx.beginPath(); ctx.moveTo(tx, ty)
      ctx.lineTo(tx - ux2 * head + uy2 * head * .55, ty + uy2 * head + ux2 * head * .55)
      ctx.lineTo(tx - ux2 * head - uy2 * head * .55, ty + uy2 * head - ux2 * head * .55)
      ctx.closePath(); ctx.fill()
    }
    ctx.globalAlpha = 1

    // Particles drifting with the flow.
    ctx.globalCompositeOperation = "lighter"
    ctx.strokeStyle = "#5CD0B3"; ctx.lineWidth = 1.2
    ctx.globalAlpha = .3 * field
    ctx.beginPath()
    for (const q of this.p) {
      const [X, Y] = this.px(q.x, q.y), [fx, fy] = this.F(q.x, q.y)
      ctx.moveTo(X - fx * s * .12, Y + fy * s * .12); ctx.lineTo(X, Y)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"

    // Ripples.
    if (since > 0) for (let n = 0; n < 3; n++) {
      const tn = since - n * .25, a = .35 * Math.exp(-tn * 1.4) * (1 - n * .3)
      if (tn <= 0 || a < .01) continue
      const [cx, cy] = this.px(0, this.landY)
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(cx, cy, tn * 9 * s * (1 - n * .12), 0, Math.PI * 2); ctx.stroke()
    }

    if (this.scene.epi > .01) this.drawEpicycles(this.scene.epi)
    if (this.answers.idea && this.titleStart !== undefined) this.drawTitle(this.answers.idea, this.scene.title)
    this.drawSparks()
    ctx.restore()

    if (this.show.frame) {
      ctx.strokeStyle = "#26292e"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.roundRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1, 10); ctx.stroke()
    }
  }

  // ∫'s example: circles on circles, tracing π.
  drawEpicycles(alpha) {
    const ctx = this.ctx, s = this.s, scale = 1.45, cy = .75
    const phase = ((this.clock - (this.epiStart ?? 0)) / EPI_LOOP) * Math.PI * 2
    const tip = ph => {
      let x = 0, y = 0
      for (const c of CIRCLES) { const a = c.freq * ph + c.phase; x += c.amp * Math.cos(a); y += c.amp * Math.sin(a) }
      return [x * scale, y * scale + cy]
    }
    // The trail: the last turn of the tip.
    const done = Math.min(Math.PI * 2, phase), steps = 220
    ctx.globalAlpha = alpha
    ctx.strokeStyle = "#F4D345"; ctx.lineWidth = 2.6; ctx.lineJoin = "round"
    ctx.shadowColor = "rgba(244,211,69,.7)"; ctx.shadowBlur = 10
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const ph = phase - done + done * i / steps, [x, y] = tip(ph), [X, Y] = this.px(x, y)
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)
    }
    ctx.stroke(); ctx.shadowBlur = 0
    // The circles.
    let x = 0, y = cy
    ctx.lineWidth = 1
    for (const c of CIRCLES) {
      if (c.amp * scale * s < .6) break
      const a = c.freq * phase + c.phase, nx = x + c.amp * scale * Math.cos(a), ny = y + c.amp * scale * Math.sin(a)
      const [X, Y] = this.px(x, y), [NX, NY] = this.px(nx, ny)
      ctx.strokeStyle = "rgba(236,233,226,.18)"
      ctx.beginPath(); ctx.arc(X, Y, c.amp * scale * s, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = "rgba(236,233,226,.55)"
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(NX, NY); ctx.stroke()
      x = nx; y = ny
    }
    ctx.globalAlpha = 1
  }

  // Your idea, written on the way manim's Write does: the outline draws on, then it fills.
  drawTitle(str, p) {
    const ctx = this.ctx, s = this.s
    let size = .62
    ctx.font = `${size * s}px ${this.serif}`
    const max = (W_UNITS - 1.6) * s, w = ctx.measureText(str).width
    if (w > max) { size *= max / w; ctx.font = `${size * s}px ${this.serif}` }
    const width = ctx.measureText(str).width, [X, Y] = this.px(0, 3.14) // where title.to_edge(UP) puts it
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    const drawn = clamp(p / .65, 0, 1), fill = clamp((p - .55) / .45, 0, 1)
    ctx.save()
    ctx.beginPath(); ctx.rect(X - width / 2 - 4, Y - size * s, width * drawn + 8, size * s * 2); ctx.clip()
    ctx.lineWidth = 1.1; ctx.strokeStyle = "#ece9e2"; ctx.strokeText(str, X, Y)
    ctx.restore()
    if (fill > 0) { ctx.globalAlpha = fill; ctx.fillStyle = "#ece9e2"; ctx.shadowColor = "#0b0c0e"; ctx.shadowBlur = 12; ctx.fillText(str, X, Y); ctx.shadowBlur = 0; ctx.globalAlpha = 1 }
    if (drawn > 0 && drawn < 1) {
      const pen = X - width / 2 + width * drawn, g = ctx.createRadialGradient(pen, Y, 0, pen, Y, size * s)
      g.addColorStop(0, "rgba(244,211,69,.55)"); g.addColorStop(1, "rgba(244,211,69,0)")
      ctx.fillStyle = g; ctx.fillRect(pen - size * s, Y - size * s, size * s * 2, size * s * 2)
    }
  }

  drawSparks() {
    const ctx = this.ctx
    ctx.globalCompositeOperation = "lighter"
    for (const q of this.sparks) {
      const age = q.life / q.max, a = (1 - age) ** 1.5 * (.65 + .35 * Math.sin(this.clock * 28 + q.seed * 7))
      const [X, Y] = this.px(q.x, q.y), r = q.r * (1 + (1 - age) * .6)
      ctx.globalAlpha = a
      ctx.strokeStyle = ctx.fillStyle = q.gold ? "rgb(255,226,120)" : "rgb(190,240,255)"
      ctx.lineWidth = Math.max(.8, r * .35)
      ctx.beginPath(); ctx.moveTo(X - r * 2, Y); ctx.lineTo(X + r * 2, Y); ctx.moveTo(X, Y - r * 2); ctx.lineTo(X, Y + r * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(X, Y, r * .55, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"
  }
}
