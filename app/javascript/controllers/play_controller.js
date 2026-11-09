import { Controller } from "@hotwired/stimulus"
import { audio } from "audio"
import { sfx } from "sfx"

// Onboarding as the editor scaled down (onboarding/play.html.erb). Each answer is a line of your first scene and the
// stage re-renders as you go: click the stage and π drops there, type your idea and it's written on, drag the plan's
// numbers and the ship date moves on a plot. Each answered line adds a clip to the timeline, which doubles as the
// progress bar; signing plays the whole scene from the start. Nothing tells you what to do: the next line is waiting.
const W_UNITS = 14.2, H_UNITS = 8        // manim's frame
const FALL = .6                          // seconds π falls for, inside the drop clip
const STEPS = ["drop", "idea", "audience", "plan", "reward", "sign"]
const CLIPS = [
  { key: "field", label: "field", len: 1, color: "blue" },
  { key: "drop", label: "drop", len: 1, color: "yellow" },
  { key: "idea", label: "Write(idea)", len: 1.8, color: "teal" },
  { key: "audience", label: "audience", len: .6, color: "green" },
  { key: "plan", label: "plan.plot()", len: 2.4, color: "purple" },
  { key: "reward", label: "reward", len: .7, color: "yellow" },
  { key: "sign", label: "Sign()", len: 1.8, color: "red" },
]
let at = 0
for (const c of CLIPS) { c.start = at; at += c.len; c.end = at }
const CLIP = Object.fromEntries(CLIPS.map(c => [c.key, c]))
const TOTAL = at + .3
const LAND = CLIP.drop.start + FALL
const SESSION_DAYS = { 2: [2, 4], 3: [1, 3, 5], 5: [1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] }
const DAY = ["S", "M", "T", "W", "T", "F", "S"]
const COLORS = { blue: "#58C4DD", teal: "#5CD0B3", yellow: "#F4D345", green: "#83C167", red: "#FC6255", purple: "#9A72AC" }
const INK = "#ece9e2", MUTED = "#a9aeb5", FAINT = "#80868e", BG = "#0b0c0e"

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v
const lerp = (a, b, k) => a + (b - a) * k
const smooth = k => k * k * (3 - 2 * k)
const span = (p, a, b) => clamp((p - a) / (b - a), 0, 1)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c])
const shortDate = d => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
const fmt = n => (Math.round(n * 10) / 10).toFixed(1)

export default class extends Controller {
  static targets = ["code", "stage", "canvas", "track", "time", "run", "open"]
  static values = { poses: Object, prizes: Array, for: Array, slots: Array, days: Array, sessions: Array, classes: Array, drawUrl: String, hours: Number }

  connect() {
    this.a = { x: null, y: null, idea: "", audience: null, days: null, mins: null, when: null, prize: null, name: "" }
    this.done = new Set(["field"])
    this.t = 0
    this.hover = { x: 0, y: null, vx: 0, swing: 0, on: false }
    this.sparks = []
    this.images = {}
    for (const [pose, src] of Object.entries(this.posesValue)) { const img = new Image(); img.src = src; this.images[pose] = img }
    this.prizesValue.forEach(p => { const img = new Image(); img.src = p.image; this.images[p.id] = img })
    this.serif = getComputedStyle(document.documentElement).getPropertyValue("--serif").trim() || "Georgia, serif"
    this.mono = getComputedStyle(document.documentElement).getPropertyValue("--mono").trim() || "monospace"

    this.buildCode()
    this.ctx = this.canvasTarget.getContext("2d")
    this.resize = new ResizeObserver(() => this.size())
    this.resize.observe(this.stageTarget)
    this.size()
    this.particles()
    this.render()

    this.play(0, CLIP.field.end)
    this.last = performance.now()
    const loop = now => { this.frame(now); this.raf = requestAnimationFrame(loop) }
    this.raf = requestAnimationFrame(loop)
  }

  disconnect() {
    cancelAnimationFrame(this.raf)
    this.resize?.disconnect()
    clearInterval(this.holdTimer)
  }

  // ── The code ─────────────────────────────────────────────────────────────────────────────────────────────────

  buildCode() {
    const tok = (key, label) => `<button type="button" class="tok" data-key="${key}" aria-label="${label}"
      data-action="pointerdown->play#grab pointermove->play#drag pointerup->play#release keydown->play#nudge"></button>`
    const line = (n, step, html, cls = "") => `<div class="cl ${cls}" data-step="${step}"><span class="cl__n">${n}</span><span class="cl__src">${html}</span></div>`
    const k = s => `<span class="c-kw">${s}</span>`, f = s => `<span class="c-fn">${s}</span>`, I = "        "
    this.codeTarget.innerHTML = [
      line(1, "always", `${k("class")} ${f("FirstScene")}(Scene):`),
      line(2, "always", `    ${k("def")} <span class="c-def">construct</span>(self):`),
      line(3, "always", `${I}field = ${f("VectorField")}(${k("lambda")} x, y: (sin(y), sin(x)))`),
      line(4, "drop", `${I}pi = ${f("PiCreature")}().drop(at=(${tok("x", "π's x")}, ${tok("y", "π's y")}))`),
      line(5, "idea", `${I}idea = ${f("Text")}(<span class="c-str">"</span><input class="tok-input c-str" data-key="idea" maxlength="80" spellcheck="false" autocomplete="off" aria-label="What you want to animate" data-action="input->play#typed keydown->play#typedKey focus->play#render"><span class="c-str">"</span>)`),
      `<div class="suggest" data-suggest hidden></div>`,
      line(6, "idea:done", `${I}self.play(${f("Write")}(idea))`),
      line(7, "audience", `${I}audience = ${tok("audience", "Who it's for")}`),
      line(8, "plan", `${I}plan = ${f("Sessions")}(days=${tok("days", "Days a week")}, mins=${tok("mins", "Minutes a session")},`),
      line(9, "plan", `${I}                at=${tok("when", "When")})`),
      line(10, "reward", `${I}reward = ${f("Prize")}(${tok("prize", "Prize")})`),
      line(11, "plan:done", `${I}self.play(plan.plot())`),
      line(12, "sign", `${I}self.play(${f("Sign")}(<span class="c-str">"</span><input class="tok-input c-str" data-key="name" maxlength="40" spellcheck="false" autocomplete="given-name" aria-label="Your name" data-action="input->play#typed keydown->play#typedKey"><span class="c-str">"</span>))`),
      `<div class="play__sign" data-sign hidden>
        <button type="button" class="play__hold" data-action="pointerdown->play#holdStart pointerup->play#holdEnd pointerleave->play#holdEnd keydown->play#holdKey keyup->play#holdEnd">
          <span class="play__hold-fill"></span><span class="play__hold-label">hold ▶ to sign and run</span>
        </button>
      </div>`,
    ].join("")
    this.lines = [...this.codeTarget.querySelectorAll(".cl")]
    this.tokens = Object.fromEntries([...this.codeTarget.querySelectorAll("[data-key]")].map(el => [el.dataset.key, el]))
    this.suggest = this.codeTarget.querySelector("[data-suggest]")
    this.signBox = this.codeTarget.querySelector("[data-sign]")
    this.holdButton = this.signBox.querySelector("button")
  }

  get active() { return STEPS.find(s => !this.done.has(s)) ?? null }

  // What each scrubbable token can be. Numbers (π's spot) drag freely; the rest step through their options.
  options(key) {
    return {
      audience: this.forValue.map(f => f.label),
      days: this.daysValue,
      mins: this.sessionsValue,
      when: this.slotsValue,
      prize: this.prizesValue.map(p => p.name),
    }[key]
  }

  shown(key) {
    const v = this.a[key]
    if (key === "x" || key === "y") return v === null ? "?" : fmt(v)
    if (v === null) return "?"
    const o = this.options(key)[v]
    return typeof o === "string" ? `"${o}"` : String(o)
  }

  render() {
    const active = this.active, ai = active ? STEPS.indexOf(active) : STEPS.length
    for (const el of this.lines) {
      const [step, when] = el.dataset.step.split(":")
      const si = STEPS.indexOf(step)
      let state = "on"
      if (step !== "always") {
        if (when === "done") state = this.done.has(step) ? "on" : "off"
        else if (si === ai) state = "active"
        else if (si === ai + 1) state = "ghost"
        else if (si > ai) state = "off"
      }
      el.dataset.state = state
    }
    for (const [key, el] of Object.entries(this.tokens)) {
      if (el.tagName === "INPUT") { el.size = Math.max(1, el.value.length || 1); continue }
      el.textContent = this.shown(key)
      el.classList.toggle("tok--unset", this.a[key] === null)
      el.classList.toggle("tok--str", typeof this.options(key)?.[0] === "string")
    }
    const ideaInput = this.tokens.idea
    this.suggest.hidden = !(active === "idea" || (document.activeElement === ideaInput && !this.a.idea))
    if (!this.suggest.hidden && !this.suggest.childElementCount) this.renderSuggest()
    this.signBox.hidden = active !== "sign"
    this.holdButton.disabled = !this.a.name.trim()
    this.renderTrack()
  }

  // Your idea's completions: ideas nobody else has, from your math class (the pledge's idea drawer).
  renderSuggest() {
    const drawn = this.drawn ?? []
    this.suggest.innerHTML = `
      <div class="suggest__classes"><span class="suggest__lead">nobody else's, for</span>${this.classesValue.map(c =>
        `<button type="button" class="suggest__class" aria-pressed="${c.key === this.klass}" data-klass="${c.key}">${esc(c.label)}</button>`).join("")}</div>
      ${drawn.map((idea, i) => `<button type="button" class="suggest__idea" data-i="${i}">
        <span class="c-str">"${esc(idea.title)}"</span>${idea.line ? `<span class="suggest__line">${esc(idea.line)}</span>` : ""}</button>`).join("")}`
    this.suggest.querySelectorAll("[data-klass]").forEach(b => b.addEventListener("click", () => this.drawIdeas(b.dataset.klass)))
    this.suggest.querySelectorAll("[data-i]").forEach(b => b.addEventListener("click", () => {
      const idea = drawn[Number(b.dataset.i)]
      this.tokens.idea.value = idea.title
      this.a.idea = idea.title
      this.commit("idea")
    }))
  }

  async drawIdeas(klass) {
    this.klass = klass
    try {
      const response = await fetch(this.drawUrlValue, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": document.querySelector("meta[name=csrf-token]")?.content },
        body: JSON.stringify({ klass, except: (this.drawn ?? []).map(i => i.id) }),
      })
      this.drawn = response.status === 200 ? await response.json() : []
    } catch { this.drawn = [] }
    this.suggest.replaceChildren()
    this.render()
  }

  typed(event) {
    const key = event.target.dataset.key
    this.a[key] = event.target.value
    this.render()
  }

  typedKey(event) {
    if (event.key !== "Enter") return
    event.preventDefault()
    const key = event.target.dataset.key
    if (key === "idea" && this.a.idea.trim()) this.commit("idea")
  }

  // Scrubbing: drag a token sideways to step through its values (or slide a number); a click steps once.
  grab(event) {
    const key = event.currentTarget.dataset.key
    event.currentTarget.setPointerCapture(event.pointerId)
    this.scrub = { key, x: event.clientX, from: this.a[key], moved: false }
    audio.unlock()
  }

  drag(event) {
    const s = this.scrub
    if (!s || s.key !== event.currentTarget.dataset.key) return
    const dx = event.clientX - s.x
    if (!s.moved && Math.abs(dx) < 4) return
    s.moved = true
    if (s.key === "x" || s.key === "y") {
      const lim = s.key === "x" ? W_UNITS / 2 - .8 : H_UNITS / 2 - 1.2
      this.set(s.key, clamp((s.from ?? 0) + dx * .02, -lim, lim))
    } else {
      const n = this.options(s.key).length
      this.set(s.key, clamp((s.from ?? -1) + Math.round(dx / 18), 0, n - 1))
    }
  }

  release(event) {
    const s = this.scrub
    this.scrub = null
    if (!s) return
    if (!s.moved && !(s.key === "x" || s.key === "y")) {
      const n = this.options(s.key).length
      this.set(s.key, ((this.a[s.key] ?? -1) + 1) % n)
    }
    this.settle(s.key)
  }

  nudge(event) {
    const key = event.currentTarget.dataset.key, d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key]
    if (event.key === "Enter") { event.preventDefault(); return this.settle(key) }
    if (!d) return
    event.preventDefault()
    if (key === "x" || key === "y") return this.set(key, (this.a[key] ?? 0) + d * .1)
    const n = this.options(key).length
    this.set(key, clamp((this.a[key] ?? -1) + d, 0, n - 1))
    this.settle(key)
  }

  set(key, value) {
    if (this.a[key] === value) return
    this.a[key] = value
    if (key !== "x" && key !== "y") sfx.tick(value)
    this.render()
  }

  // A line is answered once all its values are set.
  settle(key) {
    if (key === "x" || key === "y") return this.done.has("drop") && this.play(CLIP.drop.start, CLIP.drop.end, this.sceneEnd)
    const step = { audience: "audience", days: "plan", mins: "plan", when: "plan", prize: "reward" }[key]
    const ready = { audience: ["audience"], plan: ["days", "mins", "when"], reward: ["prize"] }[step].every(k => this.a[k] !== null)
    if (ready && !this.done.has(step)) this.commit(step)
  }

  commit(step) {
    if (this.done.has(step)) return
    this.done.add(step)
    const clip = CLIP[step]
    if (step === "sign") return this.replay()
    this.play(clip.start, clip.end)
    this.render()
    const next = this.active
    if (next === "idea") this.tokens.idea.focus()
    else if (next === "sign") this.tokens.name.focus()
    else if (next) this.lines.find(l => l.dataset.step === next)?.querySelector(".tok")?.focus({ preventScroll: true })
  }

  // ── Signing: hold, like the pledge ───────────────────────────────────────────────────────────────────────────

  holdStart(event) {
    if (event.button > 0 || this.holdButton.disabled) return
    audio.unlock()
    const began = performance.now()
    clearInterval(this.holdTimer)
    this.holdTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - began) / 1100)
      this.holdButton.style.setProperty("--fill", k)
      if (k >= 1) { clearInterval(this.holdTimer); this.commit("sign") }
    }, 16)
  }

  holdEnd() {
    clearInterval(this.holdTimer)
    if (!this.done.has("sign")) this.holdButton.style.setProperty("--fill", 0)
  }

  holdKey(event) {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); this.holdStart(event) }
  }

  // ── Time ─────────────────────────────────────────────────────────────────────────────────────────────────────

  get sceneEnd() { return Math.max(CLIP.field.end, ...CLIPS.filter(c => this.done.has(c.key)).map(c => c.end)) }

  play(from, to, then = to) {
    this.t = from
    this.playEnd = to
    this.after = then
    this.playing = true
  }

  replay() {
    audio.unlock()
    this.openTarget.hidden = true
    this.play(0, this.sceneEnd)
    this.full = this.done.has("sign")
    this.render()
  }

  seek(event) {
    const r = this.trackTarget.getBoundingClientRect(), move = e => {
      this.playing = false
      this.t = clamp((e.clientX - r.left) / r.width * TOTAL, 0, this.sceneEnd)
    }
    move(event)
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up) }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  renderTrack() {
    const next = this.active, key = `${[...this.done].join()}|${next}`
    if (key === this.trackKey) return
    this.trackKey = key
    this.trackTarget.innerHTML = CLIPS.filter(c => this.done.has(c.key) || c.key === next).map(c =>
      `<span class="clip clip--${c.color} ${this.done.has(c.key) ? "" : "clip--next"}" style="left:${c.start / TOTAL * 100}%;width:${c.len / TOTAL * 100}%">${this.done.has(c.key) ? esc(c.label) : ""}</span>`).join("")
      + `<span class="play__head" data-head></span>`
    this.head = this.trackTarget.querySelector("[data-head]")
  }

  // Sounds for the moments the playhead crosses.
  cues(from, to) {
    const cross = time => from < time && time <= to
    const has = k => this.done.has(k)
    if (has("drop") && cross(CLIP.drop.start + .01)) sfx.fall(FALL)
    if (has("drop") && cross(LAND)) { sfx.land(); this.burst(this.a.x, this.a.y, 30) }
    if (has("idea") && cross(CLIP.idea.start + .01)) sfx.write(CLIP.idea.len)
    if (has("audience") && cross(CLIP.audience.start + .01)) sfx.ring(1)
    if (has("plan") && cross(CLIP.plan.start + .01)) sfx.reveal(CLIP.plan.len * .7)
    if (has("plan") && cross(CLIP.plan.start + CLIP.plan.len * .85)) sfx.ring(2)
    if (has("reward") && cross(CLIP.reward.start + .01)) sfx.arrive()
    if (has("sign") && cross(CLIP.sign.start + .01)) sfx.write(CLIP.sign.len)
    if (has("sign") && cross(CLIP.sign.end - .05)) { sfx.land(); const p = this.piSpot(this.t); this.burst(p.x, p.y + .6, 40) }
  }

  frame(now) {
    const dt = Math.min(.05, (now - this.last) / 1000)
    this.last = now
    this.clock = (this.clock ?? 0) + dt
    if (this.playing) {
      const from = this.t
      this.t = Math.min(this.playEnd, this.t + dt)
      this.cues(from, this.t)
      if (this.t >= this.playEnd) {
        this.playing = false
        this.t = this.after
        if (this.full) { this.full = false; this.openTarget.hidden = false; sfx.arrive() }
      }
    }
    const h = this.hover
    if (h.on) { const nx = lerp(h.drawX ?? h.x, h.x, 1 - Math.exp(-dt * 10)); h.vx = (nx - (h.drawX ?? nx)) / Math.max(dt, .001); h.drawX = nx } else h.vx *= Math.exp(-dt * 5)
    h.swing = lerp(h.swing, clamp(-h.vx * 4, -24, 24), 1 - Math.exp(-dt * 6))
    this.moveParticles(dt)
    this.moveSparks(dt)
    this.draw()
    if (this.head) this.head.style.left = `${this.t / TOTAL * 100}%`
    this.timeTarget.textContent = `0:${this.t.toFixed(1).padStart(4, "0")}`
  }

  // ── The stage ────────────────────────────────────────────────────────────────────────────────────────────────

  size() {
    const r = this.stageTarget.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1)
    this.W = r.width; this.H = r.height
    this.canvasTarget.width = Math.round(r.width * d)
    this.canvasTarget.height = Math.round(r.height * d)
    this.ctx.setTransform(d, 0, 0, d, 0, 0)
    this.s = this.W / W_UNITS
  }

  px(x, y) { return [this.W / 2 + x * this.s, this.H / 2 - y * this.s] }
  units(event) {
    const r = this.canvasTarget.getBoundingClientRect()
    return { x: (event.clientX - r.left - this.W / 2) / this.s, y: (this.H / 2 - (event.clientY - r.top)) / this.s }
  }

  aim(event) { const u = this.units(event); this.hover.x = u.x; this.hover.y = u.y; this.hover.on = true }
  unaim() { this.hover.on = false; this.hover.y = null }

  // Clicking the stage drops π there (or moves it, and the code follows).
  drop(event) {
    audio.unlock()
    const u = this.units(event)
    this.a.x = clamp(u.x, -W_UNITS / 2 + .8, W_UNITS / 2 - .8)
    this.a.y = clamp(u.y, -H_UNITS / 2 + .4, H_UNITS / 2 - 1.6)
    this.fromX = this.hover.drawX ?? this.a.x
    if (!this.done.has("drop")) this.commit("drop")
    else { this.play(CLIP.drop.start, CLIP.drop.end, this.sceneEnd); this.render() }
  }

  F(x, y) { return [Math.sin(y), Math.sin(x)] }

  particles() {
    const N = this.N = 320
    this.p = Array.from({ length: N }, () => this.spawn({}))
  }

  spawn(p) {
    p.x = (Math.random() - .5) * W_UNITS; p.y = (Math.random() - .5) * H_UNITS
    p.age = 0; p.life = 2 + Math.random() * 3
    return p
  }

  moveParticles(dt) {
    for (const p of this.p) {
      const [fx, fy] = this.F(p.x, p.y)
      p.x += fx * dt * .9; p.y += fy * dt * .9; p.age += dt
      if (p.age > p.life || Math.abs(p.x) > W_UNITS / 2 || Math.abs(p.y) > H_UNITS / 2) this.spawn(p)
    }
  }

  burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() ** 1.5 * 5
      this.sparks.push({ x, y: y + .3, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .8 + 1.5, life: 0, max: .5 + Math.random() * .8, r: 1.4 + Math.random() * 2.4, seed: Math.random() * 9, gold: Math.random() < .6 })
    }
  }

  moveSparks(dt) {
    const drag = Math.exp(-dt * 3)
    this.sparks = this.sparks.filter(p => {
      p.life += dt; p.vx *= drag; p.vy = p.vy * drag - 2.5 * dt
      p.x += p.vx * dt; p.y += p.vy * dt
      return p.life < p.max
    })
  }

  // How far into a line's clip the playhead is; a line being answered shows in full as you type or drag.
  progress(key) {
    if (this.done.has(key)) return clamp((this.t - CLIP[key].start) / CLIP[key].len, 0, 1)
    if (key !== this.active) return 0
    if (key === "idea") return this.a.idea.trim() ? 1 : 0
    if (key === "sign") return this.a.name.trim() ? 1 : 0
    if (key === "plan") return this.plan() ? 1 : 0
    if (key === "audience") return this.a.audience !== null ? 1 : 0
    if (key === "reward") return this.a.prize !== null ? 1 : 0
    return 0
  }

  // Your sessions from tomorrow, on the days you said, until a first video's hours are done.
  plan() {
    const { days, mins, when } = this.a
    if (days === null || mins === null || when === null) return null
    const minutes = this.sessionsValue[mins], slot = this.slotsValue[when]
    const weekdays = slot === "weekends" ? [0, 6] : SESSION_DAYS[this.daysValue[days]] ?? SESSION_DAYS[3]
    const need = Math.ceil(this.hoursValue * 60 / minutes), today = new Date(), sessions = []
    for (let d = 1; sessions.length < need && d < 60; d++) {
      const date = new Date(today); date.setDate(today.getDate() + d)
      if (weekdays.includes(date.getDay())) sessions.push({ d, date })
    }
    const ship = sessions.at(-1)
    return { minutes, sessions, ship, span: ship.d + 1, today }
  }

  // Where the plot sits, in units, and where π stands once it has hopped onto the ship date.
  plotBox(plan) {
    const left = -6.2, right = 6.2, y0 = -2.55, top = .95
    const dx = (right - left) / plan.span, hu = (top - y0) / this.hoursValue
    return { left, right, y0, top, dx, hu, X: d => left + d * dx, Y: h => y0 + h * hu }
  }

  piSpot(t) {
    const landed = { x: this.a.x ?? 0, y: this.a.y ?? 0 }
    const plan = this.done.has("plan") || this.active === "plan" ? this.plan() : null
    if (!plan) return landed
    const b = this.plotBox(plan), k = smooth(span(this.progressAt("plan", t), .82, 1))
    const target = { x: Math.min(b.X(plan.ship.d) + .75, W_UNITS / 2 - .7), y: b.y0 }
    return { x: lerp(landed.x, target.x, k), y: lerp(landed.y, target.y, k) + Math.sin(Math.PI * k) * 1.6, hop: k }
  }

  progressAt(key, t) {
    const saved = this.t
    this.t = t
    const p = this.progress(key)
    this.t = saved
    return p
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H, s = this.s
    if (!W) return
    ctx.globalCompositeOperation = "source-over"
    ctx.globalAlpha = 1
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, W, H)

    const fieldP = this.progress("field"), dropped = this.done.has("drop")
    const since = this.t - LAND, landed = dropped && since >= 0
    const reach = landed ? since * 9 : -1

    // The number plane.
    ctx.lineWidth = 1
    ctx.strokeStyle = `rgba(88,196,221,${.07 * fieldP})`
    ctx.beginPath()
    for (let x = -7; x <= 7; x++) { const [X] = this.px(x, 0); ctx.moveTo(X, 0); ctx.lineTo(X, H) }
    for (let y = -4; y <= 4; y++) { const [, Y] = this.px(0, y); ctx.moveTo(0, Y); ctx.lineTo(W, Y) }
    ctx.stroke()

    // The field: asleep (short, dim) until the first ripple from π's landing passes over it.
    ctx.lineCap = "round"
    ctx.lineWidth = clamp(s / 40, 1, 1.8)
    const busy = this.progress("idea") > 0 || this.progress("plan") > 0 ? .55 : 1
    for (let gx = -6.75; gx <= 6.8; gx += .5) for (let gy = -3.75; gy <= 3.8; gy += .5) {
      const d0 = Math.hypot(gx, gy), grow = smooth(span(fieldP, d0 / 9, d0 / 9 + .45))
      if (!grow) continue
      const [fx, fy] = this.F(gx, gy), mag = Math.hypot(fx, fy) + 1e-6
      const d = dropped ? Math.hypot(gx - this.a.x, gy - this.a.y) : 99
      const wake = landed ? smooth(clamp((reach - d) / 1.4, 0, 1)) : 0
      const ring = landed ? Math.exp(-(((d - reach) / .45) ** 2)) * Math.exp(-since * .6) : 0
      const len = .4 * (1 - Math.exp(-mag * 1.5)) * grow * (.6 + .4 * wake) * (1 + ring * .4)
      if (len < .04) continue
      const ux = fx / mag, uy = fy / mag, [cx, cy] = this.px(gx, gy)
      const hx = ux * len * s / 2, hy = -uy * len * s / 2, head = Math.min(5, len * s * .38)
      ctx.globalAlpha = clamp((.28 + .5 * wake) * busy + ring * .6, 0, 1)
      ctx.strokeStyle = ctx.fillStyle = ring > .35 ? "#ffffff" : mag > 1.05 ? COLORS.yellow : mag > .55 ? COLORS.teal : COLORS.blue
      ctx.beginPath(); ctx.moveTo(cx - hx, cy - hy); ctx.lineTo(cx + hx - ux * head * .7, cy + hy + uy * head * .7); ctx.stroke()
      const tx = cx + hx, ty = cy + hy
      ctx.beginPath(); ctx.moveTo(tx, ty)
      ctx.lineTo(tx - ux * head + uy * head * .55, ty + uy * head + ux * head * .55)
      ctx.lineTo(tx - ux * head - uy * head * .55, ty + uy * head - ux * head * .55)
      ctx.closePath(); ctx.fill()
    }
    ctx.globalAlpha = 1

    // Particles drifting with the flow.
    ctx.globalCompositeOperation = "lighter"
    ctx.strokeStyle = COLORS.teal
    ctx.lineWidth = 1.2
    ctx.globalAlpha = .28 * fieldP
    ctx.beginPath()
    for (const p of this.p) {
      const [x2, y2] = this.px(p.x, p.y), [fx, fy] = this.F(p.x, p.y)
      ctx.moveTo(x2 - fx * s * .1, y2 + fy * s * .1); ctx.lineTo(x2, y2)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"

    // Ripples where π landed.
    if (landed) for (let n = 0; n < 3; n++) {
      const tn = since - n * .25
      if (tn <= 0) break
      const a = .35 * Math.exp(-tn * 1.4) * (1 - n * .3)
      if (a < .01) continue
      const [cx, cy] = this.px(this.a.x, this.a.y)
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(cx, cy, tn * 9 * s * (1 - n * .12), 0, Math.PI * 2); ctx.stroke()
    }

    this.drawTitle()
    this.drawPlot()
    this.drawReward()
    this.drawSignature()
    this.drawPi()
    this.drawSparks()
  }

  text(str, x, y, { size = .5, color = INK, italic = false, align = "center", font = this.serif, alpha = 1 } = {}) {
    const ctx = this.ctx, [X, Y] = this.px(x, y)
    ctx.font = `${italic ? "italic " : ""}${size * this.s}px ${font}`
    ctx.textAlign = align; ctx.textBaseline = "middle"
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.shadowColor = BG; ctx.shadowBlur = 10
    ctx.fillText(str, X, Y)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  // manim's Write: the outline draws on from the left, then it fills in.
  write(str, x, y, p, { size, font, color = INK, italic = false }) {
    if (p <= 0 || !str) return
    const ctx = this.ctx
    ctx.font = `${italic ? "italic " : ""}${size * this.s}px ${font}`
    let fit = size
    const max = (W_UNITS - 1.4) * this.s, w = ctx.measureText(str).width
    if (w > max) fit = size * max / w
    ctx.font = `${italic ? "italic " : ""}${fit * this.s}px ${font}`
    const width = ctx.measureText(str).width, [X, Y] = this.px(x, y)
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    const drawn = span(p, 0, .65), fill = span(p, .55, 1)
    ctx.save()
    ctx.beginPath(); ctx.rect(X - width / 2 - 4, Y - fit * this.s, width * drawn + 8, fit * this.s * 2); ctx.clip()
    ctx.lineWidth = 1.1; ctx.strokeStyle = color
    ctx.strokeText(str, X, Y)
    ctx.restore()
    if (fill > 0) { ctx.globalAlpha = fill; ctx.fillStyle = color; ctx.shadowColor = BG; ctx.shadowBlur = 10; ctx.fillText(str, X, Y); ctx.shadowBlur = 0; ctx.globalAlpha = 1 }
    if (drawn > 0 && drawn < 1) {
      const pen = X - width / 2 + width * drawn, g = ctx.createRadialGradient(pen, Y, 0, pen, Y, fit * this.s)
      g.addColorStop(0, "rgba(244,211,69,.55)"); g.addColorStop(1, "rgba(244,211,69,0)")
      ctx.fillStyle = g; ctx.fillRect(pen - fit * this.s, Y - fit * this.s, fit * this.s * 2, fit * this.s * 2)
    }
  }

  drawTitle() {
    this.write(this.a.idea.trim(), 0, 3.05, this.progress("idea"), { size: .62, font: this.serif })
    const p = this.progress("audience")
    if (p > 0) this.text(`for ${this.forValue[this.a.audience].label}`, 0, 2.3 - (1 - smooth(p)) * .2, { size: .34, color: MUTED, italic: true, alpha: smooth(p) })
  }

  drawPlot() {
    const p = this.progress("plan"), plan = p > 0 && this.plan()
    if (!plan) return
    const ctx = this.ctx, b = this.plotBox(plan), s = this.s
    const axes = smooth(span(p, 0, .25)), steps = span(p, .25, .82), ship = smooth(span(p, .78, 1))

    ctx.lineWidth = 1.5; ctx.strokeStyle = INK
    const [ax, ay] = this.px(b.left, b.y0), [bx] = this.px(lerp(b.left, b.right, axes), b.y0), [, ty] = this.px(b.left, lerp(b.y0, b.top + .25, axes))
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.moveTo(ax, ay); ctx.lineTo(ax, ty); ctx.stroke()
    if (axes > .5) this.text("hours", b.left - .1, b.top + .5, { size: .2, color: FAINT, font: this.mono, align: "left", alpha: axes })

    // Day ticks, a letter each when there's room, with today and the ship date named.
    const room = b.dx > .42
    for (let d = 0; d <= plan.span - 1; d++) {
      const x = b.X(d)
      if (x > lerp(b.left, b.right, axes)) break
      const [X, Y] = this.px(x, b.y0)
      ctx.globalAlpha = .6; ctx.strokeStyle = INK; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y + 6); ctx.stroke(); ctx.globalAlpha = 1
      const date = new Date(plan.today); date.setDate(plan.today.getDate() + d)
      if (d === 0) this.text("today", x, b.y0 - .32, { size: .19, color: FAINT, font: this.mono })
      else if (room && d !== plan.ship.d) this.text(DAY[date.getDay()], x, b.y0 - .32, { size: .19, color: FAINT, font: this.mono })
    }

    // One good video's worth of hours.
    const goal = span(p, .15, .4)
    if (goal > 0) {
      const [gx, gy] = this.px(b.left, b.top), [gx2] = this.px(lerp(b.left, b.right, goal), b.top)
      ctx.setLineDash([6, 5]); ctx.strokeStyle = "rgba(92,208,179,.75)"; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx2, gy); ctx.stroke(); ctx.setLineDash([])
      this.text(`one good video = ${this.hoursValue} h`, b.left + .15, b.top + .25, { size: .24, color: COLORS.teal, italic: true, align: "left", alpha: goal })
    }

    // Your hours climbing, a step per session.
    const pts = [[b.X(0), b.Y(0)]]
    let h = 0
    for (const sess of plan.sessions) { pts.push([b.X(sess.d), b.Y(h)]); h += plan.minutes / 60; pts.push([b.X(sess.d), b.Y(h)]) }
    let total = 0
    const segs = pts.slice(1).map((q, i) => { const l = Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]); total += l; return l })
    let left = total * steps
    ctx.strokeStyle = COLORS.yellow; ctx.lineWidth = 2.5; ctx.lineJoin = "round"
    ctx.shadowColor = "rgba(244,211,69,.6)"; ctx.shadowBlur = 8
    ctx.beginPath(); ctx.moveTo(...this.px(...pts[0]))
    for (let i = 0; i < segs.length && left > 0; i++) {
      const k = Math.min(1, left / segs[i]); left -= segs[i]
      ctx.lineTo(...this.px(lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)))
    }
    ctx.stroke(); ctx.shadowBlur = 0
    plan.sessions.forEach((sess, i) => {
      if (steps * total < segs.slice(0, i * 2 + 1).reduce((a, c) => a + c, 0) - .001) return
      const [X, Y] = this.px(b.X(sess.d), b.y0)
      ctx.fillStyle = COLORS.yellow; ctx.beginPath(); ctx.arc(X, Y, Math.max(3, s * .07), 0, Math.PI * 2); ctx.fill()
    })

    if (ship > 0) {
      const x = b.X(plan.ship.d), [X, Y0] = this.px(x, b.y0), [, Y1] = this.px(x, b.top + .35)
      ctx.globalAlpha = ship; ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(244,211,69,.7)"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(X, Y0); ctx.lineTo(X, Y1); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1
      const right = x > 2.5
      this.text(`ships ${shortDate(plan.ship.date)}`, x + (right ? -.12 : .12), b.top + .55, { size: .3, color: COLORS.yellow, align: right ? "right" : "left", alpha: ship })
      this.text(DAY[plan.ship.date.getDay()], x, b.y0 - .32, { size: .19, color: COLORS.yellow, font: this.mono, alpha: ship })
    }
  }

  drawReward() {
    const p = this.progress("reward")
    if (p <= 0 || this.a.prize === null) return
    const prize = this.prizesValue[this.a.prize], img = this.images[prize.id], k = smooth(p)
    const ctx = this.ctx, size = .95 * this.s, [X, Y] = this.px(-6.05, .45 + (1 - k) * .2)
    ctx.globalAlpha = k
    ctx.save()
    ctx.beginPath(); ctx.roundRect(X, Y - size / 2, size, size, 6); ctx.clip()
    if (img?.complete && img.naturalWidth) {
      const r = Math.max(size / img.naturalWidth, size / img.naturalHeight), w = img.naturalWidth * r, h = img.naturalHeight * r
      ctx.drawImage(img, X + (size - w) / 2, Y - h / 2, w, h)
    } else { ctx.fillStyle = "#22252a"; ctx.fill() }
    ctx.restore()
    ctx.globalAlpha = 1
    this.text(`then: ${prize.name}`, -6.05 + 1.15, .6 + (1 - k) * .2, { size: .27, color: INK, align: "left", alpha: k })
    this.text(`about ${prize.videos}`, -6.05 + 1.15, .25 + (1 - k) * .2, { size: .2, color: FAINT, align: "left", font: this.mono, alpha: k })
  }

  drawSignature() {
    const name = this.a.name.trim(), p = this.progress("sign")
    if (!name || p <= 0) return
    const x = 4.4, y = -3.45
    this.write(name, x, y, p, { size: .48, font: "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', cursive", italic: true })
    const ctx = this.ctx, [X1, Y] = this.px(x - 1.5, y - .3), [X2] = this.px(x + 1.5, y - .3)
    ctx.globalAlpha = span(p, 0, .3); ctx.strokeStyle = "#3a3e45"; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(X1, Y); ctx.lineTo(X2, Y); ctx.stroke(); ctx.globalAlpha = 1
  }

  pose() {
    const t = this.t, has = k => this.done.has(k)
    if (!has("drop")) return "plain"
    if (t < LAND) return "surprised"
    const sign = this.progress("sign")
    if (sign > 0 && sign < 1) return ["wave_1", "wave_2", "wave_3", "wave_2"][Math.floor(this.clock * 7) % 4]
    if (sign >= 1 && has("sign")) return "hooray"
    const hop = this.piSpot(t).hop ?? 0
    if (hop > 0 && hop < 1) return "hooray"
    if (this.progress("idea") > 0 && this.progress("idea") < 1) return "speaking"
    if (t - LAND < 1.2) return "awe"
    return "happy"
  }

  drawPi() {
    const ctx = this.ctx, s = this.s, size = 1.3 * s, FEET = .79
    const img = this.images[this.pose()] ?? this.images.plain
    if (!img?.complete) return
    let x, y, rot = 0, sx = 1, sy = 1, thread = false
    if (!this.done.has("drop")) {
      // Hanging from a thread above the stage, following the pointer: there to be dropped.
      const h = this.hover
      x = clamp(h.drawX ?? 0, -W_UNITS / 2 + .8, W_UNITS / 2 - .8)
      y = H_UNITS / 2 - 1.55 + Math.sin(this.clock * 2) * .05
      rot = h.swing + Math.sin(this.clock * 1.6) * 3
      thread = true
      if (h.on && h.y !== null) this.reticle(h.x, h.y)
    } else if (this.t < LAND) {
      const f = span(this.t, CLIP.drop.start, LAND)
      x = lerp(this.fromX ?? this.a.x, this.a.x, smooth(f))
      y = lerp(H_UNITS / 2 - 1.55, this.a.y, f * f)
      sy = 1 + .16 * f; sx = 1 / Math.sqrt(sy)
      rot = -10 * (1 - f)
    } else {
      const spot = this.piSpot(this.t), since = this.t - LAND
      x = spot.x; y = spot.y
      const wob = 1 - .26 * Math.exp(-since * 6) * Math.cos(since * 15)
      sy = since < .05 ? lerp(1.16, .74, smooth(since / .05)) : wob; sx = 1 + (1 - sy) * .7
      if (!this.playing) y += Math.sin(this.clock * 2.2) * .04
      if (spot.hop > 0 && spot.hop < 1) rot = -Math.sin(Math.PI * spot.hop) * 10
    }
    const [X, Y] = this.px(x, y)
    if (thread) {
      ctx.strokeStyle = "rgba(236,233,226,.35)"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X + Math.sin(rot * Math.PI / 180) * size * .5, Y - size * FEET + size * .18); ctx.stroke()
    }
    const glow = ctx.createRadialGradient(X, Y - size * .35, 0, X, Y - size * .35, size * .9)
    glow.addColorStop(0, "rgba(244,211,69,.13)"); glow.addColorStop(1, "rgba(244,211,69,0)")
    ctx.fillStyle = glow; ctx.fillRect(X - size, Y - size * 1.3, size * 2, size * 2)
    ctx.save()
    ctx.translate(X, Y)
    ctx.rotate(rot * Math.PI / 180)
    ctx.scale(sx, sy)
    ctx.drawImage(img, -size / 2, -size * FEET, size, size)
    ctx.restore()
  }

  reticle(x, y) {
    const ctx = this.ctx, [X, Y] = this.px(x, y), r = this.s * .28
    ctx.strokeStyle = "rgba(244,211,69,.65)"; ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.ellipse(X, Y, r * 1.8, r * .5, 0, 0, Math.PI * 2); ctx.globalAlpha = .35; ctx.stroke(); ctx.globalAlpha = 1
  }

  drawSparks() {
    if (!this.sparks.length) return
    const ctx = this.ctx
    ctx.globalCompositeOperation = "lighter"
    for (const p of this.sparks) {
      const age = p.life / p.max, a = (1 - age) ** 1.5 * (.65 + .35 * Math.sin(this.clock * 28 + p.seed * 7))
      const [X, Y] = this.px(p.x, p.y), r = p.r * (1 + (1 - age) * .6)
      ctx.globalAlpha = a
      ctx.strokeStyle = ctx.fillStyle = p.gold ? "rgb(255,226,120)" : "rgb(190,240,255)"
      ctx.lineWidth = Math.max(.8, r * .35)
      ctx.beginPath(); ctx.moveTo(X - r * 2, Y); ctx.lineTo(X + r * 2, Y); ctx.moveTo(X, Y - r * 2); ctx.lineTo(X, Y + r * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(X, Y, r * .55, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"
  }
}
