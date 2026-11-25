import { Controller } from "@hotwired/stimulus"
import { capture, setPerson } from "analytics"
import { audio } from "audio"
import { sfx } from "sfx"
import { Pen, QUESTIONS } from "onboarding/sketches"
import { sceneFor } from "onboarding/scenes"
import { partsOf } from "editor/parts"

// Onboarding (/start, onboarding/story.html.erb), as a story. π drops into a vector field, and as the story goes on you
// meet friends, each a math symbol, who show you something and bring a tool along: ∫ the examples, { } the code, ∞ your
// buddy, Σ the board. The editor assembles itself around you as they arrive: the stage gets a frame, the code pane slides
// in, then the timeline, the rail of friends and the top bar. The questions are theirs to ask, as dialogue choices; at
// the end you sign, which signs you in with Hack Club and keeps a Pledge, and the friends hop into their rail slots as the
// editor finishes assembling. Every piece is at the editor's own size and the stage ends where the editor's canvas is,
// so the hand-over to /editor (a full page load: Python needs it) changes nothing on screen; a snapshot of the last
// frame stands in on the editor's stage until Python has drawn the first one.
//
// Click, Space or Enter moves the dialogue on; skip fast-forwards to the next question, the way a game skips a
// cutscene (you still answer everything, so the pledge still gets made). The script is run(): a plain list of beats.
const W_UNITS = 14.2, H_UNITS = 8
const CODE_KEY = "manimator:code"
const VIEW_KEY = "manimator:view"
const POSTER_KEY = "manimator:poster"
// The parts of your scene you opened in the story, so the editor opens with the same ones open (editor/parts.js).
const OPEN_PARTS_KEY = "manimator:open-parts"
// Your answers, kept in this tab while you're off signing in with Hack Club, so coming back to /start signs the pledge.
const SIGNING_KEY = "manimator:signing"
const K_SWEEP = 7.5 // seconds { } takes to sweep k before you get the slider
const BACK = Symbol("back") // what a question answers when ◂ back is pressed // the story's last frame, shown on the editor's stage until Python draws
const HOLD_MS = 1300
const CHOICE_ARM_MS = 450
const PI_FEET = .79
const ACTOR = 1.35 // a character's height, in units
const EPI_LOOP = 7  // seconds for ∫'s circles to draw π once
const REPLAY_VIDEO = .9 // seconds the prize replay spends on each video
const MORE = Symbol("more") // the prize step's "show me the rest" card, and the idea step's "show me the other four"
const STAGE_BG = "#0b0c0e"
// The portal to Hack Club Auth that π opens before signing in: its centre and radius on the stage, in units.
const PORTAL = { x: 0, y: 1.1, r: 2.4 }
// Hack Club Auth's Manimator page (drawAuthSide), in hackclub/auth's colours: its light and dark themes, with the
// manimator scenario's frame round the card. AUTH_HOLE is the radius of the hole in its background (1920 by 1080).
const AUTH_HOLE = 411
const AUTH_LIGHT = { page: "#faf7f0", card: ["#fafafa", "#f5f5f5"], rim: "rgba(40,42,52,.28)", ring: "rgba(250,247,240,.75)",
  shadow: "rgba(40,42,52,.18)", strong: "#1a1d23", sub: "#6b7280", text: "#373c44", muted: "#646b79",
  input: "rgb(251,251.5,252.25)", inputBorder: "#cfd5e2", inputText: "#23262c", placeholder: "#646b79",
  button: ["#ec3750", "#d92d46"], buttonBorder: "#c7243c", divider: "rgb(231,234,239.5)", link: "#ec3750",
  logoBox: "#ffffff", logoBorder: "#e5e7eb" }
const AUTH_DARK = { page: "#0b0c0e", card: ["#252932", "#1f2329"], rim: "rgba(236,233,226,.4)", ring: "rgba(11,12,14,.55)",
  shadow: "rgba(0,0,0,.65)", strong: "#f5f7fa", sub: "#9ca3af", text: "#c2c7d0", muted: "#7b8495",
  input: "rgb(28,33,43.5)", inputBorder: "#2a3140", inputText: "#e0e3e7", placeholder: "#8891a4",
  button: ["#f03d58", "#dd2f4a"], buttonBorder: "#c62642", divider: "#202632", link: "#f03d58",
  logoBox: "#181c25", logoBorder: "#374151" }
// π's digits, for the portal: its rim is rings of them, and more spiral down into it.
const PI_DIGITS = "3141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067982148086513282306647093844609550582231725359408128481117450284102701938521105559644622948954930381964428810975665933446128475648233786783165271201909145648566923460348610454326648213393607260249141273724587006606315588174881520920962829254091715364367892590360011330530548820466521384146951941511609433057270365759591953092186117381932611793105118548074462379962749567351885752724891227938183011949129833673362440656643086021394946395224737190702179860943702770539217176293176752384674818467669405132"
// manim's BLUE_C, TEAL_C, GREEN_C, YELLOW_C, GOLD_C, RED_C, as u goes 0 to 1.
const MANIM_RAMP = [[88, 196, 221], [92, 208, 179], [131, 193, 103], [244, 211, 69], [240, 172, 95], [252, 98, 85]]
const manimRamp = u => {
  const x = clamp(u, 0, .9999) * (MANIM_RAMP.length - 1), i = Math.floor(x), f = x - i, a = MANIM_RAMP[i], b = MANIM_RAMP[i + 1]
  return a.map((v, k) => Math.round(v + (b[k] - v) * f))
}
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
// π's number for a question's what-if: the one the sketch is drawn with and the scene's code starts from.
const guess = (q, n) => { const [mode, , , , , , own] = q.whatifs[n]; return (own?.code ?? q.code)[1](mode) }
const videos = n => n === 1 ? "your first video" : `${n} videos`

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

// The scene you met π in: the field, as manim code. The code pane shows the same lines as they come in. Each line is
// [id, text]; ids are what light() points at. Once you have an idea, the scene is π's sketch of it (onboarding/scenes.js).
function sceneLines(k = 1) {
  return [
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
}

// Just enough Python colouring for these lines, in the editor's colours.
const TOKEN = /(#.*$)|(f?"(?:[^"\\]|\\.)*")|\b(from|import|class|def|lambda|if|else|for|in|not|and|or|return)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Z][A-Za-z]+)\b|\b(self|construct|flow)\b/g
function highlight(line) {
  let out = "", at = 0
  for (const m of line.matchAll(TOKEN)) {
    const cls = m[1] ? "c-faint" : m[2] ? "c-str" : m[3] ? "c-kw" : m[4] ? "c-num" : m[5] ? "c-fn" : "c-def"
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
  static targets = ["canvas", "front", "bar", "rail", "code", "timeline", "cast", "dialog", "portrait", "name", "text", "choices", "next", "skip", "back", "signIn", "loginHint", "world"]
  static values = { poses: Object, authImages: Object, prizes: Array, slots: Object, days: Array, sessions: Object,
    pledgeUrl: String, scenesUrl: String, editorUrl: String, visitUrl: String, hours: Number,
    signedIn: Boolean, name: String, whoamiUrl: String, alert: String, progress: Object, emailArm: String }

  connect() {
    this.clock = 0
    this.startedAt = performance.now()
    this.show = { bar: false, rail: false, code: false, timeline: false, dialog: false, frame: false }
    this.rect = { x: 0, y: 0, w: innerWidth, h: innerHeight }
    this.scene = { field: 0, epi: 0, sketch: 0, k: 1 }
    this.screens = new Map() // the idea step's cards, each canvas and the clip playing on it
    this.touch = matchMedia("(hover: none)").matches
    // A build, a game, a classroom and a sport lead, so the first four aren't all for one kind of person.
    this.order = QUESTIONS.map((q, i) => [[0, 1, 3, 5].includes(i) ? i : 6 + Math.random(), q]).sort((a, b) => a[0] - b[0]).map(([, q]) => q)
    this.offset = 0
    this.want = { field: 1, epi: 0 }
    this.actors = {}
    this.met = new Set()
    this.answers = {}
    this.sparks = []
    this.pointer = null
    this.ctx = this.canvasTarget.getContext("2d")
    this.fctx = this.frontTarget.getContext("2d")
    this.serif = getComputedStyle(document.documentElement).getPropertyValue("--serif").trim() || "Georgia, serif"
    this.mono = getComputedStyle(document.documentElement).getPropertyValue("--mono").trim() || "ui-monospace, monospace"
    this.images = {}
    for (const [pose, src] of Object.entries(this.posesValue)) { const img = new Image(); img.src = src; this.images[pose] = img }
    // Hack Club Auth's Manimator page, drawn as you dive through the portal (drawAuthSide): its own pictures, from
    // hackclub/auth, fetched when the browser gets to them.
    this.authImages = {}
    for (const [name, src] of Object.entries(this.authImagesValue)) { const img = new Image(); img.src = src; this.authImages[name] = img }

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
    // Choices that have only just appeared under the cursor ignore clicks for a moment (CHOICE_ARM_MS): a click meant to
    // move the dialogue on shouldn't pick an answer, or a prize.
    this.onEarly = e => { if (performance.now() - (this.choicesAt ?? 0) < CHOICE_ARM_MS) { e.stopPropagation(); e.preventDefault() } }
    this.choicesTarget.addEventListener("click", this.onEarly, true)
    this.onPart = e => this.togglePart(e)
    this.codeTarget.addEventListener("click", this.onPart)
    this.onLeave = () => this.abandoned()
    addEventListener("pagehide", this.onLeave)
    // Back from Hack Club Auth with the browser's back button, the page comes out of the cache mid-dive, covered by
    // the portal: start over, and resume() picks up your answers.
    this.onShow = e => { if (e.persisted && this.signingIn) location.reload() }
    addEventListener("pageshow", this.onShow)
    this.size()

    this.last = performance.now()
    const loop = now => { this.frame(now); this.raf = requestAnimationFrame(loop) }
    this.raf = requestAnimationFrame(loop)

    const decoded = Promise.all(Object.values(this.images).map(img => img.decode().catch(() => {})))
    const signing = takeSigning()
    this.whoamiDone = this.signedInValue ? Promise.resolve() : this.whoami()
    // Which email-ask test group you're in (OnboardingVisit::EMAIL_ARMS), on every event from here on.
    if (this.emailArmValue) window.posthog?.register?.({ email_arm: this.emailArmValue })
    const progress = !signing && this.hasProgressValue && this.progressValue?.answers ? this.progressValue : null
    Promise.race([decoded, wait(800)]).then(() => signing ? this.resume(signing) : progress ? this.resumeVisit(progress) : this.run())
  }

  disconnect() {
    this.gone = true
    cancelAnimationFrame(this.raf)
    removeEventListener("resize", this.onResize)
    removeEventListener("keydown", this.onKey)
    removeEventListener("pointermove", this.onMove)
    removeEventListener("pagehide", this.onLeave)
    removeEventListener("pageshow", this.onShow)
    this.codeTarget.removeEventListener("click", this.onPart)
    this.choicesTarget.removeEventListener("click", this.onEarly, true)
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
    // While you choose your idea, the stage sits wholly above the dialogue, since π's sketch fills all of it.
    const dialog = this.show.dialog ? (this.choosing ? this.dialogTarget.offsetHeight : Math.min(this.dialogTarget.offsetHeight, 150)) + 24 : 0
    const bottom = px("--tl") + dialog + pad
    return { x: left, y: top, w: Math.max(100, W - left - pad), h: Math.max(80, H - top - bottom) }
  }

  // A friend as FriendsHelper drew them in the rail, for the stage and the dialogue.
  friend(id) { return this.railTarget.querySelector(`[data-friend="${id}"] .friend`).outerHTML }

  meet(id, { quiet } = {}) {
    if (this.met.has(id)) return
    this.met.add(id)
    if (!this.show.rail) this.reveal("rail")
    const slot = this.railTarget.querySelector(`[data-friend="${id}"]`)
    slot.classList.add("story__slot--met")
    if (quiet) return
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

  // The code pane: what you're looking at, as manim code. Lines light up as someone talks about them. Once it's your
  // scene, which is a lot of code to start with, it's folded into its named parts (editor/parts.js), and the pane
  // says so: open any part, or all of it.
  renderCode() {
    const lines = this.lines(), parts = partsOf(lines.map(([, text]) => text))
    const row = ([id, text], i) => {
      const html = id === "k" ? `        k = <span class="c-num" data-k>${this.scene.k.toFixed(1)}</span>` : highlight(text)
      return `<div class="sl ${id && id === this.lit ? "sl--lit" : ""} ${id === "number" ? "sl--new" : ""}"><span class="sl__n">${i + 1}</span><span>${html || " "}</span></div>`
    }
    this.codeTarget.classList.toggle("story__code--parts", parts.length > 0)
    if (!parts.length) {
      this.codeTarget.innerHTML = lines.map(row).join("")
    } else {
      this.openParts ??= new Set()
      const all = parts.every(p => this.openParts.has(p.name))
      let html = lines.slice(0, parts[0].heading).map(row).join("")
      for (const p of parts) {
        const open = this.openParts.has(p.name)
        html += `<button type="button" class="sl-part ${open ? "sl-part--open" : ""}" data-part="${esc(p.name)}" aria-expanded="${open}">
          <span class="sl__n">${p.heading + 1}</span><span class="sl-part__name">${highlight(lines[p.heading][1].trim())}</span><span class="sl-part__count">${open ? "fold" : `${p.lines} lines`}</span></button>`
        if (open) html += lines.slice(p.start, p.end + 1).map((line, j) => row(line, p.start + j)).join("")
      }
      html += `<div class="sl-fold"><span>Folded so it isn't a wall. Nothing's hidden for good.</span>
        <button type="button" class="sl-fold__all" data-all>${all ? "Fold it back up" : `Show all ${lines.length} lines`}</button></div>`
      this.codeTarget.innerHTML = html
    }
    this.kEl = this.codeTarget.querySelector("[data-k]")
  }

  // Opening or folding a part of your scene, or all of them.
  togglePart(event) {
    const part = event.target.closest("[data-part]"), all = event.target.closest("[data-all]")
    if (!part && !all) return
    this.openParts ??= new Set()
    if (part) {
      const name = part.dataset.part
      this.openParts.has(name) ? this.openParts.delete(name) : this.openParts.add(name)
    } else {
      const names = partsOf(this.lines().map(([, text]) => text)).map(p => p.name)
      const open = !names.every(n => this.openParts.has(n))
      names.forEach(n => open ? this.openParts.add(n) : this.openParts.delete(n))
    }
    sfx.tick(part ? 2 : 4)
    capture("onboarding_code_part_toggled", { variant: "story", part: part?.dataset.part ?? "all" })
    this.renderCode()
  }

  light(id) { this.lit = id; this.renderCode() }

  // The scene's lines: the field you met π in, until you have an idea; then π's sketch of it, in manim.
  lines() {
    const { qi, wi, idea } = this.answers, q = QUESTIONS[qi]
    return q?.whatifs[wi] ? sceneFor(q, wi, undefined, idea).lines : sceneLines(this.scene.k)
  }

  get code() { return this.lines().map(([, text]) => text).join("\n") + "\n" }

  renderTimeline() {
    this.timelineTarget.innerHTML = `<span class="story__clip story__clip--blue" style="left:0;width:30%">field</span>
      ${this.answers.idea ? `<span class="story__clip story__clip--teal" style="left:31%;width:34%">${esc(this.answers.idea)}</span>` : ""}
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
    // On the stage only (walking in from its edge, never over the code), except at the end, when everyone hops into
    // the rail. Over π's sketch, whoever isn't talking steps back so the sketch can be seen.
    this.castTarget.style.clipPath = this.show.frame && !this.final
      ? `inset(${r.y}px ${innerWidth - r.x - r.w}px ${innerHeight - r.y - r.h}px ${r.x}px round 10px)` : ""
    const dim = !!this.sketch && !this.final && !this.cage
    for (const a of Object.values(this.actors)) {
      if (a.home) continue
      a.el.classList.toggle("story__actor--back", dim && a.id !== this.speaker)
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

  // pick(el, done) lays out a question of its own in the choices and calls done with the answer.
  // linger(ms) holds the line that long once it's out and moves on by itself, no click.
  async say(who, text, { pose, choices, input, hold, slider, pick, until, rush, back, linger } = {}) {
    if (this.gone) return new Promise(() => {})
    this.speaker = who
    if (!this.show.dialog) this.reveal("dialog")
    if (pose) this.setPose(pose)
    const f = FRIENDS[who]
    this.portraitTarget.innerHTML = who === "pi" ? `<img src="${this.posesValue[pose ?? this.actors.pi?.pose ?? "plain"]}" alt="">` : this.friend(who)
    this.nameTarget.textContent = f.name
    this.nameTarget.style.color = f.color
    this.choicesTarget.replaceChildren()
    this.choicesTarget.className = "story__choices"
    this.screens.clear()
    this.nextTarget.hidden = true
    this.dialogTarget.classList.remove("story__dialog--pop"); void this.dialogTarget.offsetWidth; this.dialogTarget.classList.add("story__dialog--pop")
    const decision = !!(choices || input || hold || slider || pick)
    if (decision) this.skipping = false
    this.skipTarget.hidden = decision
    this.backTarget.hidden = true
    const speaker = this.actors[who]
    if (speaker) speaker.talk = true
    await this.type(text, f.note)
    // Click = skip: once the line is out, a click ends a big moment (∫'s drawing, k's sweep, the prize replay), and
    // `rush` jumps what's on the stage to where it would have ended. A click while it's still typing only finishes
    // the line, as everywhere else, so clicking to read faster never skips the moment itself.
    let rushed = false
    this.rush = until ? () => { rushed = true; this.rush = null; rush?.() } : null
    if (speaker) speaker.talk = false
    if (!decision && this.skipping) return
    // A big moment holds until it has played out, or you click.
    if (until) await this.dwell(until, () => rushed)
    this.rush = null
    if (!decision && this.skipping) return
    if (decision) {
      // ◂ back answers the question with BACK, and whoever asked steps back.
      this.choicesAt = performance.now()
      const answer = choices ? this.offer(choices) : input ? this.ask(input) : slider ? this.slide(slider)
        : pick ? new Promise(done => pick(this.choicesTarget, done)) : this.holdToSign(hold)
      this.backTarget.hidden = !back
      const result = await Promise.race([answer, new Promise(r => { this.goBack = back ? () => r(BACK) : null })])
      this.goBack = null
      this.backTarget.hidden = true
      if (result === BACK) { cancelAnimationFrame(this.holdRaf); this.choicesTarget.replaceChildren() }
      return result
    }
    if (linger) return this.pause(linger)
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
    this.choicesTarget.classList.toggle("story__choices--list", choices.some(c => c.sub && !c.image && !c.peek))
    // A long row of cards (the whole prize shelf) scrolls sideways instead of piling up over the stage.
    this.choicesTarget.classList.toggle("story__choices--shelf", choices.filter(c => c.image).length > 6)
    return new Promise(resolve => {
      this.choicesTarget.innerHTML = choices.map((c, i) => {
        const button = `<button type="button" class="story__choice ${c.image ? "story__choice--card" : ""} ${c.peek ? "story__choice--card story__choice--more" : ""}" data-i="${i}">
          ${c.image ? `<img src="${c.image}" alt="">` : ""}${c.peek ? `<span class="story__peek">${c.peek.map(src => `<img src="${src}" alt="">`).join("")}</span>` : ""}<span class="story__choice-label">${esc(c.label)}</span>${c.sub ? `<span class="story__choice-sub">${esc(c.sub)}</span>` : ""}</button>`
        // A link can't sit inside a button, so it goes under it: where an idea comes from, to read up on.
        return c.link ? `<div class="story__choice-wrap" style="--i:${i}">${button}<a class="story__choice-link" href="${esc(c.link.href)}" target="_blank" rel="noopener">${esc(c.link.label)} ↗</a></div>` : button
      }).join("")
      this.choicesTarget.querySelectorAll("a").forEach(a => a.addEventListener("click", e => e.stopPropagation()))
      const buttons = [...this.choicesTarget.querySelectorAll("button")]
      buttons.forEach((b, i) => b.addEventListener("click", e => {
        e.stopPropagation()
        sfx.tick(i)
        this.choicesTarget.replaceChildren()
        resolve(choices[i].value ?? choices[i].label)
      }))
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

  // hold is the button's label, or { label, note } for a line under it saying what holding means.
  holdToSign(hold) {
    const { label, note, hc } = typeof hold === "string" ? { label: hold } : hold
    return new Promise(resolve => {
      this.choicesTarget.innerHTML = `<div class="story__holding"><button type="button" class="story__hold${hc ? " story__hold--hc" : ""}"><span class="story__hold-fill"></span><span class="story__hold-label">${esc(label)}</span></button>
        ${note ? `<p class="story__fine">${esc(note)}</p>` : ""}</div>`
      const b = this.choicesTarget.querySelector("button"), fill = b.querySelector(".story__hold-fill")
      let held = false, k = 0, last = 0
      const tick = now => {
        const dt = now - last; last = now
        k = clamp(k + (held ? dt / HOLD_MS : -dt / 350), 0, 1)
        this.holdK = k
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
    if (event.key === "Escape" && this.goBack) return this.back(event)
    if (event.key !== " " && event.key !== "Enter") return
    if (event.target.closest?.("input, textarea, select")) return
    // A choice you moved to with the keyboard is yours to press. Anything else that kept focus after a click (the
    // music, a part of the code, skip) doesn't swallow Space: it lets go of focus and the story moves on.
    const button = event.target.closest?.("button, a")
    if (button && this.choicesTarget.contains(button)) return
    button?.blur()
    event.preventDefault()
    audio.unlock()
    this.next()
  }

  next() {
    if (this.skipTyping) return this.skipTyping()
    if (this.rush) return this.rush()
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

  // Each beat is a step, logged so drop-off can be read beat by beat, in PostHog and in our own OnboardingVisit.
  step(name) {
    this.beat = name
    capture("onboarding_step_viewed", { variant: "story", step: name, seconds: this.seconds })
    this.save()
  }

  // Where you are and what you've answered so far (OnboardingVisit), so we can see where people stop and set you back
  // there if you come back. Where you came from goes along the first time.
  save(extra = {}) {
    if (!this.visitUrlValue) return
    const visit = { step: this.beat, question_index: this.at ?? null, answers: this.answers, k: this.scene.k, ...extra }
    if (!this.sentSource) {
      this.sentSource = true
      const params = new URLSearchParams(location.search)
      visit.referrer = document.referrer
      visit.utm = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"].filter(k => params.has(k)).map(k => [k, params.get(k)]))
    }
    return this.send(this.visitUrlValue, { visit }, "PATCH").catch(() => {})
  }

  get seconds() { return Math.round((performance.now() - this.startedAt) / 100) / 10 }

  abandoned() {
    if (this.signed || this.left || this.signingIn || this.restarting) return
    this.left = true
    capture("onboarding_abandoned", { variant: "story", step: this.beat, seconds: this.seconds })
  }

  dwell(until, rushed = () => false) {
    return new Promise(resolve => {
      const check = () => (this.skipping || this.clock >= until || this.gone || rushed()) ? resolve() : requestAnimationFrame(check)
      check()
    })
  }

  back(event) {
    event?.stopPropagation()
    if (!this.goBack) return
    capture("onboarding_back", { variant: "story", step: this.beat, seconds: this.seconds })
    sfx.tick(0)
    this.goBack()
  }

  // k, wherever it shows: the field, the code, the readout; a soft tick each time it crosses a tenth.
  setK(k) {
    const tenth = Math.round(k * 10)
    if (tenth !== this.kTenth) {
      if (this.kTenth !== undefined && !this.skipping) sfx.tick(Math.round((k - .2) / 2.8 * 7))
      this.kTenth = tenth
    }
    this.scene.k = k
    if (this.kEl) this.kEl.textContent = k.toFixed(1)
  }

  slide({ min, max, step }) {
    this.kFrom = undefined
    return new Promise(resolve => {
      this.choicesTarget.innerHTML = `<div class="story__slider">
        <span class="story__slider-k"><i>k</i> = <b>${this.scene.k.toFixed(1)}</b></span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${this.scene.k.toFixed(1)}" aria-label="k">
        <button type="button" class="story__choice">Next →</button></div>`
      const range = this.choicesTarget.querySelector("input"), out = this.choicesTarget.querySelector("b")
      const next = this.choicesTarget.querySelector("button")
      range.addEventListener("input", () => {
        this.setK(Number(range.value))
        out.textContent = this.scene.k.toFixed(1)
        this.choicesTarget.querySelector(".story__slider").classList.add("story__slider--moved")
      })
      next.addEventListener("click", e => { e.stopPropagation(); sfx.tick(4); this.choicesTarget.replaceChildren(); resolve(this.scene.k) })
      range.focus({ preventScroll: true })
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
    await this.askEmail("hello")

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
    const cheer = () => { clearTimeout(cheering); this.setPose("hooray"); if (this.actors.pi) this.actors.pi.cheerAt = this.clock }
    const cheering = setTimeout(cheer, EPI_LOOP * 1000)
    // Click and π is drawn at once: the circles jump to the end of their turn.
    await this.say("int", "I'm ∫! I collect scenes. Watch: circles riding on circles can draw anything. Even π.",
      { until: this.clock + EPI_LOOP + .6, rush: () => { this.epiStart = Math.min(this.epiStart, this.clock - EPI_LOOP); cheer() } })

    // { } and the code: the field comes back, with what made it.
    this.step("code")
    this.enter("code", { from: -1 })
    await this.pause(1100)
    this.meet("code")
    this.want = { field: 1, epi: 0 }
    this.renderCode()
    this.reveal("code")
    this.light("field")
    await this.say("code", "Psst, I'm { }. These few lines made that whole field.")
    // k, on purpose: it's pointed at, swept slowly with a readout on the stage, then handed to you on a slider.
    this.light("k")
    this.showK = true
    this.kFrom = this.clock + 1.2
    await this.say("code", "See k? It's one number. Watch the field as it changes.",
      { until: this.kFrom + K_SWEEP + .4, rush: () => { if (this.kFrom !== undefined) this.kFrom = this.clock - K_SWEEP - .01 } })
    this.answers.k = await this.say("code", "Your turn. Drag it!", { slider: { min: .2, max: 3, step: .1 } })
    this.showK = false
    this.light(null)

    await this.questions()
    await this.finish()
  }

  // The questions, one step each, so ◂ back can take you to the one before. Starts at `i` (5 is signing).
  async questions(i = 0) {
    const steps = [() => this.askIdea(), () => this.askWhen(), () => this.askDays(), () => this.askMinutes(), () => this.askPrize(), () => this.askSign()]
    while (i < steps.length) {
      // Which question you're on, so coming back to /start can pick up here (resumeVisit). Kept with your answers
      // so far, since the asks that share a beat (∞'s three) don't each send one.
      if (this.at !== i) { this.at = i; if (i > 0) this.save() }
      if (await steps[i]() !== BACK) { i++; continue }
      i = Math.max(0, i - 1)
      if (i === 2 && this.answers.when === "weekends") i = 1 // weekends never asked how many days
    }
  }

  async finish() {
    this.signed = true
    this.step("signed")
    this.cheer()
    this.reveal("bar")
    this.burst(0, 1, 60)
    sfx.land()
    await this.say("pi", "We're free, and it's official! Let's go make it move.", { pose: "hooray", linger: 1600 })
    await this.handOff()
  }

  // Your idea: π's sketch of it plays on the stage from here on.
  async askIdea() {
    this.step("idea")
    if (this.answers.idea) {
      for (const k of ["idea", "qi", "wi", "question", "whatif"]) delete this.answers[k]
      this.openParts = new Set()
      this.sketch = null
      this.renderCode()
      this.renderTimeline()
    }
    this.choose(true)
    const idea = await this.pickIdea()
    this.choose(false)
    Object.assign(this.answers, idea)
    capture("onboarding_idea_picked", { variant: "story", question: idea.question, whatif: idea.whatif })
    this.light("number") // the line with π's number on it: yours to change
    this.reveal("timeline")
    this.renderTimeline()
    await this.pause(1800)
    this.light(null)
    // Your scene is a lot of code, folded into parts; { } says so, once, instead of hiding it quietly.
    if (!this.toldParts) {
      this.toldParts = true
      const lines = this.lines(), parts = partsOf(lines.map(([, text]) => text))
      if (parts.length) await this.say("code", `Your video is ${lines.length} lines of code. That's a lot to start with, so I folded it into ${parts.length} parts. Click one to open it.`)
    }
    await this.askEmail("idea")
  }

  // While you choose, the cast steps out of the way of the sketch, and the stage sits above the dialogue.
  choose(on) {
    this.choosing = on
    this.element.toggleAttribute("data-choosing", on)
  }

  // π asks for your email, unless we already know it (you're signed in, or Hack Club Auth's whoami told us). Where it
  // asks is a test (OnboardingVisit::EMAIL_ARMS): right after you say hi, or once you've picked your idea, when it has
  // something of yours to keep. Coming back without one, π asks first thing. There's no skipping it.
  async askEmail(where) {
    if (where !== "resume" && where !== this.emailArmValue && this.emailArmValue) return
    if (!this.emailArmValue && where === "idea") return // no test group: ask after hi, as before
    await Promise.race([this.whoamiDone, wait(1500)])
    if (this.signedInValue || this.email) return
    this.step("email")
    capture("email_ask_shown", { variant: "story", email_arm: this.emailArmValue, where })
    const idea = this.answers.idea
    const ask = where === "idea" && idea
      ? `I love “${idea}”. Where should I send it? I'll keep it safe, and keep your place if you need a break.`
      : "Before we go exploring: what's your email? Everything we make together stays yours, and I'll keep your place if you need a break."
    const email = await this.say("pi", ask, { pose: "happy", pick: (el, done) => this.emailForm(el, done) })
    this.email = email
    setPerson({ email })
    capture("email_given", { variant: "story", email_arm: this.emailArmValue, where })
    this.save({ email, email_source: "asked" })
    await this.say("pi", where === "hello" || !idea ? "Got it! Now, let me show you around." : "Got it! It's safe with me.", { pose: "happy" })
  }

  emailForm(el, done) {
    el.innerHTML = `<div class="story__email"><form class="story__ask">
        <input class="story__input" type="email" maxlength="254" spellcheck="false" autocomplete="email" placeholder="kartikey@hackclub.com" required>
        <button class="story__choice" disabled>Let's go</button></form>
      <p class="story__fine">PS: we don't sell your data and won't spam you. <a href="https://hackclub.com/privacy-and-terms" target="_blank" rel="noopener">Privacy policy</a></p></div>`
    const form = el.querySelector("form"), input = form.querySelector("input"), ok = form.querySelector("button")
    input.addEventListener("input", () => { ok.disabled = !input.checkValidity() })
    form.addEventListener("submit", e => { e.preventDefault(); if (input.checkValidity()) { sfx.tick(3); done(input.value.trim()) } })
    el.addEventListener("click", e => e.stopPropagation())
    input.focus({ preventScroll: true })
  }

  // Something that's bugged you, then a what-if π blurts out: your first scene. The video takes π's name for it, and
  // π's numbers, which are one line each at the top of the scene for you to change in the editor. ◂ back steps back.
  async pickIdea() {
    for (;;) {
      const q = await this.pickQuestion()
      const n = await this.pickWhatIf(q)
      if (n === BACK) continue
      const [mode, whatif, mystery] = q.whatifs[n]
      this.perform(q.clip(mode, { v: guess(q, n) }))
      this.tagName = q.name
      await this.say("pi", `“${q.name}”, then. ${mystery}`, { pose: "awe" })
      if (await this.newcomer()) await this.explain("personal_project", "pi", "At Hack Club we'd call this a personal project: something you make because you want it to exist. Those are the best kind.", { pose: "happy" })
      return { idea: q.name, qi: QUESTIONS.indexOf(q), wi: n, question: q.title, whatif: `What if ${whatif}` }
    }
  }

  async pickQuestion() {
    for (let again = false; ; again = true) {
      const shown = [0, 1, 2, 3].map(i => this.order[(this.offset + i) % this.order.length])
      shown.forEach(q => { q.plain ??= q.clip() })
      this.tagName = null
      this.perform(shown[0].plain)
      const q = await this.say("pi", again ? "Which one, then?" : "That's Manimator: write a little, and math moves. Now you. Pick something that's actually bugged you, and I'll draw your first scene.",
        { pose: again ? "speaking" : "happy", pick: (el, done) => this.questionCards(el, shown, done) })
      if (q !== MORE) return q
      this.offset = (this.offset + 4) % this.order.length
    }
  }

  // Cards that each play their sketch; pointing at one plays it on the stage too. With no pointer to hover with, the
  // first tap plays a card on the stage and the second chooses it.
  questionCards(el, shown, done) {
    el.className = "pick__choices pick__choices--four"
    el.innerHTML = shown.map((q, i) => `<button type="button" class="pick__card" style="--i:${i}"><canvas></canvas>
      <span class="pick__card-title">${esc(q.title)}</span><span class="pick__card-go">Choose this</span></button>`).join("") +
      `<div class="pick__row"><button type="button" class="story__choice" data-more>Show me the other four</button></div>`
    const buttons = [...el.querySelectorAll(".pick__card")]
    buttons.forEach((button, i) => {
      const q = shown[i]
      this.screens.set(button.querySelector("canvas"), { clip: q.plain, t0: performance.now() })
      const show = () => {
        buttons.forEach(b => b.classList.toggle("pick__card--on", b === button))
        if (this.sketch?.clip !== q.plain) this.perform(q.plain)
      }
      button.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") show() })
      button.addEventListener("focus", show)
      button.addEventListener("click", () => { if (this.touch && !button.classList.contains("pick__card--on")) return show(); sfx.tick(i); done(q) })
    })
    if (this.touch) buttons[0]?.classList.add("pick__card--on")
    el.querySelector("[data-more]").addEventListener("click", () => { sfx.tick(5); done(MORE) })
  }

  // π blurts "what if…", three cards turn over one after another, and you take one. Pointing at a card plays its
  // sketch on the stage, so you're choosing with your eyes open.
  pickWhatIf(q) {
    this.perform(q.plain)
    return this.say("pi", "Ooh, I like that one. Wait. Wait wait wait. What if…", { pose: "thinking", back: true, pick: (el, done) => {
      const order = q.whatifs.map((w, n) => n).sort(() => Math.random() - .5)
      el.className = "pick__choices"
      el.innerHTML = `<div class="pick__pulls pick__pulls--open">${order.map((n, i) => `<button type="button" class="pick__pull" style="--i:${i}">
        <span class="pick__pull-back">π</span><span class="pick__pull-face">What if ${esc(q.whatifs[n][1])}</span></button>`).join("")}</div>`
      el.querySelectorAll(".pick__pull").forEach((card, i) => {
        const n = order[i], clip = q.clip(q.whatifs[n][0], {})
        setTimeout(() => { card.classList.add("pick__pull--up"); sfx.tick(i + 2) }, 250 + i * 280)
        const show = () => { if (this.sketch?.clip !== clip) this.perform(clip) }
        card.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") show() })
        card.addEventListener("focus", show)
        card.addEventListener("click", () => { sfx.tick(i); done(n) })
      })
    } })
  }

  // The sketch on the stage, from its beginning.
  perform(clip) { this.sketch = { clip, t0: this.clock } }

  // π's sketch of the idea in answers, as you left it.
  showIdea({ qi, wi }) {
    const q = QUESTIONS[qi]
    if (!q?.whatifs[wi]) return
    this.perform(q.clip(q.whatifs[wi][0], { v: guess(q, wi) }))
    this.tagName = this.answers.idea
  }

  async askWhen() {
    this.step("buddy")
    if (!this.actors.inf) {
      this.enter("inf")
      await this.pause(800)
      await this.say("inf", "Hi hi! I'm ∞. Nobody ships alone, so I'll keep you company.")
      this.meet("inf")
      if (await this.newcomer()) await this.explain("ship", "inf", "“Shipping” is what makers call putting what you made out in the real world, to find out if it works. Here, that's people watching your video.")
    }
    const slots = Object.keys(this.slotsValue)
    const when = await this.say("inf", "When do you usually have time?", { choices: slots.map(s => ({ label: s })), back: true })
    if (when === BACK) return BACK
    this.answers.when = when
    if (when === "weekends") this.answers.days = 2
  }

  async askDays() {
    if (this.answers.when === "weekends") return
    const days = await this.say("inf", "How many days a week?",
      { choices: this.daysValue.map(d => ({ label: d === 7 ? "every day" : `${d} days`, value: d })), back: true })
    if (days === BACK) return BACK
    this.answers.days = days
  }

  async askMinutes() {
    const minutes = await this.say("inf", "And for how long each time?",
      { choices: Object.entries(this.sessionsValue).map(([m, label]) => ({ label, value: m })), back: true })
    if (minutes === BACK) return BACK
    this.answers.minutes = Number(minutes)
    this.answers.shipBy = this.shipBy()
    await this.say("inf", `At that pace your video is done by ${shortDate(this.answers.shipBy)}. I'll check in ${this.answers.when === "weekends" ? "on weekends" : `around ${clockTime(this.slotsValue[this.answers.when])}`}.`)
  }

  // Σ and the board: the one prize you're working toward. ∫ draws the area under your curve on the stage, split into
  // videos, with the prizes standing on the video lines they take. Hovering a prize fills the area up to it; picking
  // one replays it a video at a time, then pours it into the prize and empties, since your next prize starts over.
  // The postcard is the one thing on top: it's made an hour into video 1 and mailed with whatever you pick, so a
  // small card stands at that hour and every fill passes it. ∫ says so before you pick, never after.
  async askPrize() {
    this.step("prize")
    if (!this.actors.sig) {
      this.enter("sig", { from: -1 })
      await this.pause(800)
      await this.say("sig", "And I'm Σ. I add up your hours.")
      this.meet("sig")
    }
    this.loadPrizes()
    const featured = this.prizesValue.filter(p => p.featured), rest = this.prizesValue.filter(p => !p.featured)
    this.curve = { start: this.clock, focus: this.answers.prize ?? featured[featured.length > 2 ? 2 : 0].id, all: false }
    this.showCurve = true
    this.want = { field: .25, epi: 0 }
    let shown = []
    const preview = e => { const b = e.target.closest?.("button[data-i]"); const p = shown[b?.dataset.i]; if (p) this.curve.focus = p.id }
    this.choicesTarget.addEventListener("pointerover", preview)
    this.choicesTarget.addEventListener("focusin", preview)
    if (await this.newcomer()) await this.explain("ysws", "int", "Here's Hack Club's deal: you ship, we ship. You ship a video, and we ship you something real, in the mail.")
    let prizeId
    for (;;) {
      const all = this.curve.all
      shown = this.prizesValue.filter(p => all || p.featured || p.id === this.answers.prize)
      const choices = shown.map(p => ({ label: p.name, sub: p.with_every_prize ? `on its own, ${videos(p.videos)}` : videos(p.videos), image: p.image, value: p.id }))
      if (!all) choices.push({ label: `${rest.length} more`, sub: "shirts, a mug, a tie…", peek: rest.slice(0, 3).map(p => p.image), value: MORE })
      prizeId = await this.say("int", all ? "The whole shelf. Pick the one you want." : "Every video you ship fills in a piece of this. One hour in, we make a postcard of your frame, and it's mailed free with whatever prize you earn. Pick the one prize you're working toward.",
        { choices, back: true })
      if (prizeId !== MORE) break
      this.curve.all = true
    }
    this.choicesTarget.removeEventListener("pointerover", preview)
    this.choicesTarget.removeEventListener("focusin", preview)
    if (prizeId === BACK) { this.showCurve = false; this.want = { field: 1, epi: 0 }; return BACK }
    this.answers.prize = prizeId
    const prize = this.prizesValue.find(p => p.id === prizeId)
    Object.assign(this.curve, { focus: prizeId, pickedAt: this.clock, shipped: 0, popped: false, cardAt: undefined, drainAt: undefined })
    this.scene.fill = 0
    const by = shortDate(this.shipBy(prize.videos * this.hoursValue))
    await this.say("int", prize.with_every_prize ? `Just the postcard, then. It's made one hour in, and on its own it's your prize for one video. Ship by ${by} and it's in the mail.`
      : `The ${prize.name}: ${videos(prize.videos)}, so ${by} at your pace. Your postcard is mailed with it, free. Your hours go to this one, and your next prize starts from zero.`,
      { until: this.clock + prize.videos * REPLAY_VIDEO + 1 })
    this.curve.drainAt = this.clock
    await this.pause(900)
    this.showCurve = false
    this.want = { field: 1, epi: 0 }
  }

  loadPrizes() {
    this.prizeImages ??= Object.fromEntries(this.prizesValue.map(p => { const img = new Image(); img.src = p.image; return [p.id, img] }))
  }

  // The end: the plane snaps shut on everyone, and holding the button breaks them out. Signed in already, that's all
  // it is. Otherwise the way out is a portal to Hack Club (throughPortal), holding opens it, and out you go to sign in.
  async askSign() {
    this.step("sign")
    const prize = this.prizesValue.find(p => p.id === this.answers.prize)
    const reward = prize.with_every_prize ? `Then the ${prize.name.toLowerCase()} is yours.` : `Every video counts toward the ${prize.name}, and your postcard comes with it.`
    await this.say("pi", `So: "${this.answers.idea}". Your first video by ${shortDate(this.answers.shipBy)}. ${reward}`, { pose: "speaking" })
    this.trap()
    const name = this.nameValue || this.whoName
    const held = this.signedInValue
      ? await this.say("pi", `Oh no. The plane snapped shut on us! Hold the button${name ? `, ${name},` : ""} and break us out.`,
        { pose: "erm", hold: "Hold to free them", back: true })
      : await this.throughPortal(name)
    if (held === BACK) { this.cage = null; this.portal = null; return BACK }
    await this.breakFree()
    return this.signHere()
  }

  // Not signed in: the way out of the cage is a portal to Hack Club. Through it, π shows what Hack Club is (photos
  // from hackclub.com, then #treasure-cove), what the account is for, and exactly what signing in will ask, and
  // holding the button opens it all the way. Most newcomers sent to Hack Club Auth never come back signed in, so
  // nobody should land there wondering where they are, or whether any of this is real.
  async throughPortal(name) {
    await this.say("pi", "Oh no. The plane snapped shut on us!", { pose: "erm" })
    this.step("portal")
    this.portal = { openAt: this.clock, show: "photos", showAt: this.clock, suckAt: this.clock + .6 } // your sketch goes first
    sfx.land()
    await this.say("pi", "Wait, there's a crack in it. It's a portal to Hack Club, the people who make Manimator.", { pose: "awe" })
    if (this.hackClubber) {
      await this.say("pi", `You're already in Hack Club${name ? `, ${name}` : ""}, so this is quick: sign in over there and you're straight back here.`, { pose: "happy" })
    } else {
      await this.say("pi", "Hack Club is thousands of teenagers who make things together: games, hardware, videos like yours. They meet at hackathons all over the world, and every day on Slack.", { pose: "happy" })
      await this.say("pi", "Going through makes you a free Hack Club account. It's one account for Manimator and every other Hack Club program, and it gets you into the Slack.", { pose: "speaking" })
      this.showThrough("treasure")
      await this.say("pi", "And the prizes really show up. This is #treasure-cove, where people post what came in the mail this week.", { pose: "hooray" })
      this.showThrough("auth")
      await this.say("pi", "On the other side, you type your email, Hack Club emails you a 6-digit code, and you type it in. New there? They'll ask your name and birthday too.", { pose: "speaking" })
    }
    this.showThrough("auth")
    const lead = this.hackClubber ? "" : "Then you're straight back here with us, so keep this tab open. "
    return this.say("pi", `${lead}Hold the button${name ? `, ${name},` : ""} to open the portal and break us out!`,
      { pose: "erm", hold: { label: "Hold to open the portal", hc: true }, back: true })
  }

  showThrough(show) { if (this.portal) Object.assign(this.portal, { show, showAt: this.clock }) }



  // Bars drop around the whole cast, and everyone looks worried.
  trap() {
    this.cage = { at: this.clock, bars: null }
    this.holdK = 0
    this.lineUp()
    sfx.land()
    capture("onboarding_trapped", { variant: "story" })
  }

  // The bars fly apart, sparks everywhere, everyone cheers.
  async breakFree() {
    const cage = this.cage
    if (!cage) return
    cage.broke = this.clock
    for (const a of Object.values(this.actors)) this.burst(a.x, -2.2, 18)
    this.cheer()
    sfx.land()
    capture("onboarding_freed", { variant: "story" })
    await wait(1100)
  }

  // The cages, drawn in front of the cast: one per friend, falling into place, the bars bowing apart as you hold (as
  // if the friend inside is pushing), shaking when they're about to go, and flying off when they do.
  drawCage(dt) {
    const ctx = this.fctx, r = this.rect, s = this.s, cage = this.cage
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    if (!cage || this.final || !s) return
    const half = .52, bottom = -3.12, top = -1.32, BARS = 5
    cage.bars ??= Object.values(this.actors).flatMap(a => Array.from({ length: BARS }, (_, i) => ({
      who: a.id, u: -1 + 2 * i / (BARS - 1), dx: 0, dy: 0, spin: 0, vx: 0, vy: 0, vs: 0 })))
    const drop = clamp((this.clock - cage.at) / .4, 0, 1) ** 2, lift = (1 - drop) * 4.5
    const k = cage.broke === undefined ? (this.holdK ?? 0) : 1, gone = cage.broke === undefined ? 0 : (this.clock - cage.broke) / .9
    if (gone >= 1) { this.cage = null; return }
    ctx.save()
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.clip()
    ctx.globalAlpha = 1 - smooth(clamp(gone, 0, 1))
    ctx.lineCap = "round"
    ctx.strokeStyle = `rgb(${Math.round(lerp(236, 244, k))},${Math.round(lerp(233, 211, k))},${Math.round(lerp(226, 69, k))})`
    ctx.shadowColor = "rgba(244,211,69,.7)"; ctx.shadowBlur = 14 * k
    const shake = k ** 3 * .04
    // The lids and floors: a short rail above and below each friend, until they break.
    if (cage.broke === undefined) {
      ctx.lineWidth = Math.max(2, s * .055)
      ctx.beginPath()
      for (const a of Object.values(this.actors)) {
        for (const y of [top, bottom]) {
          const [ax, ay] = this.px(a.x - half - .08, y + lift), [bx] = this.px(a.x + half + .08, y + lift)
          ctx.moveTo(ax, ay); ctx.lineTo(bx, ay)
        }
      }
      ctx.stroke()
    }
    ctx.lineWidth = Math.max(1.5, s * .04)
    cage.bars.forEach((bar, i) => {
      const a = this.actors[bar.who]
      if (!a) return
      // The outer bars bow out the most, the middle one hardly: someone inside is pushing.
      const bow = k * .2 * bar.u + Math.sin(this.clock * 55 + i * 1.7) * shake
      if (cage.broke !== undefined) {
        if (!bar.vx && !bar.vy) { bar.vx = (bar.u || Math.random() - .5) * (3 + Math.random() * 2); bar.vy = 2.5 + Math.random() * 3; bar.vs = (Math.random() - .5) * 10 }
        bar.vy -= 9 * dt; bar.dx += bar.vx * dt; bar.dy += bar.vy * dt; bar.spin += bar.vs * dt
      }
      const len = top - bottom, [cx, cy] = this.px(a.x + bar.u * half + bar.dx, (top + bottom) / 2 + lift + bar.dy)
      ctx.save()
      ctx.translate(cx, cy); ctx.rotate(bar.spin)
      ctx.beginPath(); ctx.moveTo(0, -len / 2 * s); ctx.quadraticCurveTo(bow * s * 2, 0, 0, len / 2 * s); ctx.stroke()
      ctx.restore()
    })
    ctx.restore()
  }

  // Signing the pledge is signing in, as hackclub/wrong-tool does it. Signed in, it signs right here; otherwise your
  // answers wait in this tab while Hack Club Auth signs you in, and back on /start, resume() signs it.
  async signHere() {
    if (!this.signedInValue) return this.signIn()
    await this.sign()
  }

  async signIn() {
    try {
      sessionStorage.setItem(SIGNING_KEY, JSON.stringify({ answers: this.answers, k: this.scene.k }))
    } catch { /* storage unavailable: you'll come back to the start of the story */ }
    await this.dive()
    this.step("sign_in")
    this.signingIn = true
    if (typeof this.email === "string") this.loginHintTarget.value = this.email // asked for, or from whoami, on this page
    this.signInTarget.submit()
    return new Promise(() => {}) // the page is leaving
  }

  // Out through the portal: it grows over the whole screen, Hack Club's sign-in card comes up the middle (drawDive),
  // and the browser follows.
  async dive() {
    this.portal ??= { openAt: this.clock - 9, show: "auth" }
    this.portal.diveAt = this.clock
    this.reveal("dialog", false)
    sfx.launch()
    await wait(1400)
  }

  // Back from Hack Club Auth, signed in: the portal is still open, π hops out of it, and it closes behind them.
  async portalBack() {
    const pi = this.actors.pi
    this.portal = { openAt: this.clock - 9, show: "none" }
    this.holdK = 1
    const to = [pi.x, pi.y]
    pi.falling = true; pi.x = PORTAL.x; pi.y = PORTAL.y - .9; pi.sx = pi.sy = .15
    await wait(700)
    sfx.land()
    const from = this.clock
    await new Promise(resolve => {
      const hop = () => {
        const f = clamp((this.clock - from) / .8, 0, 1), e = smooth(f)
        pi.x = lerp(PORTAL.x, to[0], e); pi.y = lerp(PORTAL.y - .9, to[1], e) + Math.sin(f * Math.PI) * 1.4
        pi.sx = pi.sy = lerp(.15, 1, Math.min(1, f * 1.5))
        if (f < 1) return requestAnimationFrame(hop)
        pi.falling = false
        resolve()
      }
      hop()
    })
    this.burst(to[0], to[1] + .7, 24)
    this.cheer()
    this.portal.closeAt = this.clock + .5
    await this.say("pi", "You're back! Your account works for all of Hack Club now. Let's make it move.", { pose: "hooray" })
    this.portal = null
  }

  // New to Hack Club: not signed in here, and Hack Club Auth's whoami had no email for you. Only newcomers get the
  // jargon (shipping, Hack Club itself) explained; people already in Hack Club know it.
  async newcomer() {
    await Promise.race([this.whoamiDone, wait(1500)])
    return !this.signedInValue && !this.hackClubber
  }

  // A newcomer's explanation of one term, once each, even if ◂ back comes past it again.
  async explain(term, who, text, options = {}) {
    this.explained ??= new Set()
    if (this.explained.has(term)) return
    this.explained.add(term)
    capture("onboarding_jargon_explained", { variant: "story", term })
    await this.say(who, text, options)
  }

  // Signed in to Hack Club but not to us yet? Hack Club Auth's whoami (hackclub/auth#279) tells us your first name, so
  // π can ask you to sign by name, and your email, kept on your OnboardingVisit so we can bring you back if you wander
  // off, and π doesn't have to ask for it. Anything else (not signed in there, or this site's origin not allowed)
  // leaves both out.
  async whoami() {
    if (!this.whoamiUrlValue) return
    try {
      const response = await fetch(this.whoamiUrlValue, { credentials: "include" })
      const { signed_in: signedIn, first_name: firstName, email } = await response.json()
      if (!signedIn) return
      const name = (firstName || "").trim().slice(0, 40)
      if (name) this.whoName = name
      if (email) {
        this.hackClubber = true // already has a Hack Club account: no explaining what shipping or Hack Club is
        this.email = email
        setPerson({ email })
        this.save({ email, email_source: "whoami", first_name: name })
      }
    } catch { /* not on a hackclub.com subdomain, or not allowed: no name */ }
  }

  // Back from Hack Club Auth: the story's last moment, set straight back up (everyone met, the editor around the
  // stage, your title on it). Signed in, the pledge signs; if signing in didn't work, π asks you to try again.
  async resume({ answers, k }) {
    Object.assign(this.answers, answers, { shipBy: new Date(answers.shipBy) })
    this.setK(k ?? this.answers.k ?? 1)
    this.want = { field: 1, epi: 0 }
    for (const id of RAIL) {
      const a = this.enter(id)
      a.x = a.tx
      this.meet(id, { quiet: true })
    }
    this.setPose("happy")
    for (const part of ["frame", "code", "timeline"]) this.reveal(part)
    this.renderCode()
    this.renderTimeline()
    this.showIdea(this.answers)
    if (this.signedInValue) {
      this.step("signed_in")
      await this.portalBack()
      if (await this.signHere() === BACK) await this.questions(4)
    } else {
      this.step("sign_in_failed")
      await this.say("pi", this.alertValue ? `${this.alertValue} Want to try again?` : "Welcome back! Your pledge is right where you left it.", { pose: "erm" })
      await this.questions(5)
    }
    await this.finish()
  }

  // Back on /start without having signed (OnboardingVisit#progress): everyone you'd met, the editor as far as it had
  // come, and π asks whether to pick up at the question you left or start over. A question whose earlier answers
  // didn't make it back is asked again from the last one that did.
  async resumeVisit({ at, answers, k, email }) {
    if (email) this.email = true // we have it: π won't ask again
    Object.assign(this.answers, answers)
    if (answers.shipBy) this.answers.shipBy = new Date(answers.shipBy)
    if (at >= 5 && !this.answers.prize) at = 4
    if (at >= 4 && !(this.answers.minutes && this.answers.shipBy)) at = 1
    if (at >= 1 && !this.answers.idea) at = 0
    this.setK(k ?? this.answers.k ?? 1)
    this.want = { field: 1, epi: 0 }
    const met = ["pi", "code", "int", ...(at >= 1 ? ["inf"] : []), ...(at >= 5 ? ["sig"] : [])]
    for (const id of met) {
      const a = this.enter(id)
      a.x = a.tx
      this.meet(id, { quiet: true })
    }
    for (const part of ["frame", "code"]) this.reveal(part)
    if (this.answers.idea) { this.reveal("timeline"); this.renderTimeline(); this.showIdea(this.answers) }
    this.renderCode()
    this.step("resumed")
    capture("onboarding_resumed", { variant: "story", at })
    const where = this.answers.idea ? `“${this.answers.idea}” is right where you left it.` : "I kept your spot."
    const choice = await this.say("pi", `You're back! ${where}`, { pose: "hooray",
      choices: [{ label: "Pick up where I left off", value: "go" }, { label: "Start over", value: "over" }] })
    if (choice === "over") {
      capture("onboarding_restarted", { variant: "story", at })
      await this.save({ restart: true })
      this.restarting = true
      return location.reload()
    }
    await this.askEmail("resume")
    await this.questions(at)
    await this.finish()
  }

  // When your sessions add up to this many hours (a first video by default), at the pace you picked.
  shipBy(hours = this.hoursValue) {
    const date = new Date()
    date.setDate(date.getDate() + this.sessionDay(this.sessions(hours)))
    return date
  }

  sessions(hours) { return Math.ceil(hours * 60 / this.answers.minutes) }

  // How many days from today your nth session lands.
  sessionDay(n) { return Math.max(n - 1, Math.ceil(n / this.answers.days * 7)) }

  // Keeps your Pledge, and leaves your idea in the editor.
  async sign() {
    const a = this.answers
    try {
      await this.post(this.pledgeUrlValue, { pledge: {
        idea: a.idea, prize: a.prize, build_time: a.when, days_per_week: a.days,
        session_minutes: a.minutes, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ship_by: a.shipBy.toISOString().slice(0, 10),
      } })
    } catch { /* offline */ }
    capture("onboarding_pledge_signed", { variant: "story", idea: a.idea, question: a.question, whatif: a.whatif, prize: a.prize, when: a.when, days: a.days, minutes: a.minutes })
    // Your scene, saved now, so the editor opens this one even if you have others. Offline, it waits in localStorage
    // instead, which the editor turns into a scene when you have none yet.
    try {
      const response = await this.post(this.scenesUrlValue, { scene: { code: this.code } })
      if (response.ok) this.sceneId = (await response.json()).id
    } catch { /* offline */ }
    try {
      if (!this.sceneId) localStorage.setItem(CODE_KEY, this.code)
      localStorage.setItem(VIEW_KEY, "code")
      localStorage.setItem(OPEN_PARTS_KEY, JSON.stringify([...(this.openParts ?? [])]))
    } catch { /* storage unavailable */ }
  }

  post(url, body = {}) { return this.send(url, body) }

  // Where you are (save) goes keepalive, so what's sent as you close the tab still arrives.
  send(url, body = {}, method = "POST") {
    return fetch(url, {
      method, keepalive: method === "PATCH",
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
    for (const [canvas, ctx] of [[this.canvasTarget, this.ctx], [this.frontTarget, this.fctx]]) {
      canvas.width = Math.round(innerWidth * d)
      canvas.height = Math.round(innerHeight * d)
      ctx.setTransform(d, 0, 0, d, 0, 0)
    }
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
    if (this.vortex) {
      const dx = x - PORTAL.x, dy = y - PORTAL.y, r = Math.hypot(dx, dy) + 1e-6
      const w = this.vortex * Math.exp(-Math.max(0, r - PORTAL.r) / 1.6) * 2.4
      fx += (-dy / r * 1.6 - dx / r * .8) * w; fy += (dx / r * 1.6 - dy / r * .8) * w
    }
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
    this.scene.kShow = ease(this.scene.kShow ?? 0, this.showK ? 1 : 0, dt, 5)
    this.scene.curve = ease(this.scene.curve ?? 0, this.showCurve ? 1 : 0, dt, 4)
    if (this.curve) this.scene.fill = ease(this.scene.fill ?? 0, this.fillTarget(), dt, this.curve.pickedAt === undefined ? 5 : 9)
    this.scene.epi = ease(this.scene.epi, this.want.epi, dt, 3)
    // Opened a crack, then all the way as you hold the button.
    this.vortex = this.portalOpen() * lerp(.64, 1, smooth(this.holdK ?? 0))
    // π's sketch: full while you choose and at the end, dimmed while the others talk over it, nearly gone under Σ's curve.
    this.scene.sketch = ease(this.scene.sketch, !this.sketch ? 0 : this.choosing || this.final ? 1 : this.showCurve ? 0 : this.cage ? .12 : .45, dt, 4)
    this.scene.idea = ease(this.scene.idea ?? 0, this.sketch ? 1 : 0, dt, 4) // once there's a sketch, the field is gone for good
    if (this.kFrom !== undefined) {
      const u = this.clock - this.kFrom, keys = [[0, 1], [2, 2.4], [4.4, .5], [6.2, 1.5], [K_SWEEP, 1]]
      let k = 1
      for (let i = 0; i < keys.length - 1; i++) if (u >= keys[i][0] && u < keys[i + 1][0]) k = lerp(keys[i][1], keys[i + 1][1], smooth((u - keys[i][0]) / (keys[i + 1][0] - keys[i][0])))
      if (u > 0) this.setK(k)
      if (u > K_SWEEP) this.kFrom = undefined
    }
    const p = this.pointer
    if (p) { const k = Math.exp(-dt * 5); p.vx *= k; p.vy *= k }

    for (const q of this.p) {
      const [fx, fy] = this.F(q.x, q.y)
      q.x += fx * dt * .9; q.y += fy * dt * .9; q.age += dt
      if (q.age > q.life || Math.abs(q.x) > 8 || Math.abs(q.y) > 5 || (this.vortex && Math.hypot(q.x - PORTAL.x, q.y - PORTAL.y) < PORTAL.r * this.vortex)) this.spawn(q)
    }
    const drag = Math.exp(-dt * 3)
    this.sparks = this.sparks.filter(q => { q.life += dt; q.vx *= drag; q.vy = q.vy * drag - 2.5 * dt; q.x += q.vx * dt; q.y += q.vy * dt; return q.life < q.max })

    this.moveActors(dt)
    this.draw()
    this.placeWorld()
    this.drawCage(dt)
    this.drawRim()
    this.drawDive()
    this.drawScreens(now)
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
    ctx.fillStyle = STAGE_BG; ctx.fillRect(r.x, r.y, r.w, r.h)
    if (this.scene.sketch > .01) this.drawSketch(this.scene.sketch)

    const ux = r.w / 2 / s, uy = r.h / 2 / s, field = Math.max(this.scene.field * (1 - this.scene.idea), this.vortex ?? 0)
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
      if (this.vortex && Math.hypot(gx - PORTAL.x, gy - PORTAL.y) < PORTAL.r * this.vortex + .2) continue
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

    if (this.vortex) this.drawPortal()
    if (this.scene.epi > .01) this.drawEpicycles(this.scene.epi)
    if (this.scene.kShow > .01) this.drawK(this.scene.kShow)
    if (this.scene.curve > .01 && this.curve) this.drawCurve(this.scene.curve)
    if (this.tagName && this.scene.sketch > .01) this.drawTag(this.tagName, this.scene.sketch)
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

  // k's value, big in the corner of the stage while it's the thing to watch.
  drawK(alpha) {
    const ctx = this.ctx, s = this.s, size = .62 * s, [X, Y] = this.px(-W_UNITS / 2 + .5, H_UNITS / 2 - .7)
    const pad = size * .45, label = ` = ${this.scene.k.toFixed(1)}`
    ctx.font = `italic ${size}px ${this.serif}`
    const kw = ctx.measureText("k").width
    ctx.font = `${size}px ${this.serif}`
    const w = kw + ctx.measureText(label).width
    ctx.globalAlpha = alpha * .85
    ctx.fillStyle = "#0b0c0e"
    ctx.beginPath(); ctx.roundRect(X - pad, Y - size * .8, w + pad * 2, size * 1.6, 10); ctx.fill()
    ctx.globalAlpha = alpha
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = "#F4D345"
    ctx.font = `italic ${size}px ${this.serif}`; ctx.fillText("k", X, Y)
    ctx.font = `${size}px ${this.serif}`; ctx.fillText(label, X + kw, Y)
    ctx.globalAlpha = 1
  }

  // How much of the area is filled, in hours: up to the prize you're looking at, or, once you've picked, a video at a
  // time (each one ticks off as it ships), then back to nothing.
  fillTarget() {
    const c = this.curve, hpv = this.hoursValue, prize = this.prizesValue.find(p => p.id === c.focus)
    if (!prize) return 0
    if (c.drainAt !== undefined) return 0
    if (c.pickedAt === undefined) return prize.videos * hpv
    const v = Math.min(prize.videos, (this.clock - c.pickedAt) / REPLAY_VIDEO), done = Math.floor(v + 1e-6)
    if (done > c.shipped) { c.shipped = done; sfx.tick(Math.min(done, 7)) }
    const card = this.postcard()
    if (card && c.cardAt === undefined && v * hpv >= card.made_at_hours) { c.cardAt = this.clock; this.burst(...this.cardSpot(card), 14) }
    if (done >= prize.videos && !c.popped) { c.popped = true; c.popAt = this.clock; this.burst(...this.pinAt(prize), 50); sfx.land() }
    return (Math.floor(v) + smooth(v % 1)) * hpv
  }

  // The curve's frame, in stage units: x is time (hours), split into videos.
  curveFrame() {
    const hpv = this.hoursValue, most = Math.max(...this.prizesValue.map(p => p.videos)), H = most * hpv
    const x0 = -5.6, x1 = 5.6, base = -.15
    return { hpv, most, base, x0, x1, X: h => x0 + (x1 - x0) * h / H, Y: h => base + .95 + .3 * Math.sin(h / H * 8.5 + .6) }
  }

  // The postcard, and where its small card stands: just above the curve, at the hour it's made.
  postcard() { return this.prizesValue.find(p => p.with_every_prize) }
  cardSpot(card) {
    const { X, Y } = this.curveFrame()
    return [X(card.made_at_hours), Y(card.made_at_hours) + .34]
  }

  // The prizes standing on the curve: the featured ones, plus whichever you're looking at or picked. The whole shelf
  // lives in the dialog; on the stage it would just be a pile.
  onStage() {
    const c = this.curve
    return this.prizesValue.filter(p => p.featured || p.id === c.focus || p.id === this.answers.prize)
  }

  // Where a prize's photo stands: above its video line, fanned out from the others that share it.
  pinAt(prize) {
    const { hpv, X, Y } = this.curveFrame(), c = this.curve
    const mates = this.onStage().filter(p => p.videos === prize.videos)
    const k = Math.max(0, mates.indexOf(prize)), spread = Math.min(.8, 1.4 / Math.max(1, mates.length - 1))
    return [X(prize.videos * hpv) + (k - (mates.length - 1) / 2) * spread, Y(prize.videos * hpv) + .62]
  }

  drawCurve(alpha) {
    const ctx = this.ctx, s = this.s, c = this.curve, { hpv, most, base, x0, x1, X, Y } = this.curveFrame()
    const focus = this.prizesValue.find(p => p.id === c.focus), fill = this.scene.fill ?? 0
    const grow = smooth(clamp((this.clock - c.start) / 1.1, 0, 1)), H = most * hpv
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.lineCap = "round"

    // The video lines, faint, and their names under the axis. Shipped ones turn yellow.
    ctx.font = `${.19 * s}px ${this.mono}`; ctx.textAlign = "center"; ctx.textBaseline = "top"
    for (let v = 1; v <= most; v++) {
      const [LX, LY] = this.px(X(v * hpv), base), [, TY] = this.px(0, Y(v * hpv) + .1)
      ctx.strokeStyle = "rgba(236,233,226,.14)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6])
      ctx.beginPath(); ctx.moveTo(LX, LY); ctx.lineTo(LX, TY); ctx.stroke(); ctx.setLineDash([])
      const shipped = c.pickedAt !== undefined && c.drainAt === undefined && v <= (c.shipped ?? 0)
      ctx.fillStyle = shipped ? "#F4D345" : v <= (focus?.videos ?? 0) ? "#a9aeb5" : "#4b5058"
      ctx.globalAlpha = alpha * grow
      ctx.fillText(shipped ? `video ${v} ✓` : `video ${v}`, this.px(X((v - .5) * hpv), 0)[0], LY + .14 * s)
      ctx.globalAlpha = alpha
    }

    // The area under the curve, filled up to now.
    if (fill > .01) {
      ctx.beginPath(); ctx.moveTo(...this.px(X(0), base))
      for (let h = 0; h <= fill; h += H / 240) ctx.lineTo(...this.px(X(h), Y(h)))
      ctx.lineTo(...this.px(X(fill), Y(fill))); ctx.lineTo(...this.px(X(fill), base)); ctx.closePath()
      ctx.fillStyle = "rgba(244,211,69,.3)"; ctx.fill()
      ctx.strokeStyle = "#F4D345"; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(...this.px(X(fill), base)); ctx.lineTo(...this.px(X(fill), Y(fill))); ctx.stroke()
    }

    // The axis and the curve, drawn on the way manim's Create does.
    ctx.strokeStyle = "rgba(236,233,226,.8)"; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(...this.px(x0 - .15, base)); ctx.lineTo(...this.px(x0 - .15 + (x1 - x0 + .3) * grow, base)); ctx.stroke()
    ctx.strokeStyle = "#58C4DD"; ctx.lineWidth = 3
    ctx.beginPath()
    for (let h = 0; h <= H * grow; h += H / 240) { const [PX, PY] = this.px(X(h), Y(h)); h ? ctx.lineTo(PX, PY) : ctx.moveTo(PX, PY) }
    ctx.stroke()

    // The postcard's hour, inside video 1: a small card on a stem, lit once the fill has passed it. It stays lit when
    // the area empties, since the postcard is yours whatever comes next.
    const card = this.postcard()
    if (card) {
      const made = card.made_at_hours, got = c.cardAt !== undefined || (c.pickedAt === undefined && fill >= made)
      const [CX, CY] = this.px(...this.cardSpot(card)), [, SY] = this.px(0, Y(made)), img = this.prizeImages[card.id]
      const pop = c.cardAt !== undefined ? 1 + .3 * Math.exp(-(this.clock - c.cardAt) * 5) * Math.sin((this.clock - c.cardAt) * 18) : 1
      const w = .34 * s * pop * grow, h = w * .68
      ctx.globalAlpha = alpha * grow * (got ? 1 : .5)
      ctx.strokeStyle = got ? "#F4D345" : "#4b5058"; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(CX, SY); ctx.lineTo(CX, CY + h / 2); ctx.stroke()
      ctx.save(); ctx.translate(CX, CY); ctx.rotate(-.1)
      ctx.fillStyle = "#f3efe4"; ctx.fillRect(-w / 2, -h / 2, w, h)
      if (img?.complete && img.naturalWidth) ctx.drawImage(img, -w / 2, -h / 2, w, h)
      ctx.strokeRect(-w / 2, -h / 2, w, h)
      ctx.restore()
      ctx.font = `${.15 * s}px ${this.mono}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom"
      ctx.fillStyle = got ? "#F4D345" : "#a9aeb5"
      ctx.fillText(made === 1 ? "1 hour" : `${made} hours`, CX, CY - h / 2 - .08 * s)
      ctx.globalAlpha = alpha
    }

    // The prizes, standing on their video lines. The one you're looking at is big; the rest wait.
    const shown = this.onStage()
    const order = [...shown.filter(p => p.id !== c.focus), ...shown.filter(p => p.id === c.focus)]
    for (const p of order) {
      const on = p.id === c.focus, [PX, PY] = this.px(...this.pinAt(p)), img = this.prizeImages[p.id]
      const pop = on && c.popAt !== undefined ? 1 + .25 * Math.exp(-(this.clock - c.popAt) * 4) * Math.sin((this.clock - c.popAt) * 18) : 1
      const r = (on ? .36 : .22) * s * pop * grow, bob = on ? Math.sin(this.clock * 2.4) * .04 * s : 0
      ctx.globalAlpha = alpha * (on ? 1 : .5)
      if (on) { ctx.shadowColor = "rgba(244,211,69,.55)"; ctx.shadowBlur = c.popped ? 28 : 14 }
      ctx.fillStyle = "#f3efe4"; ctx.beginPath(); ctx.arc(PX, PY - bob, r, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
      ctx.save(); ctx.beginPath(); ctx.arc(PX, PY - bob, r, 0, Math.PI * 2); ctx.clip()
      if (img?.complete && img.naturalWidth) ctx.drawImage(img, PX - r, PY - bob - r, r * 2, r * 2)
      ctx.restore()
      ctx.strokeStyle = on ? "#F4D345" : "#3a3e45"; ctx.lineWidth = on ? 2.5 : 1.5
      ctx.beginPath(); ctx.arc(PX, PY - bob, r, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.restore()
  }

  // π's sketch of your idea, filling the stage. Each loop fades in and out, so the jump back to the start isn't a cut.
  drawSketch(alpha) {
    const ctx = this.ctx, r = this.rect, { clip, t0 } = this.sketch, t = (this.clock - t0) % clip.dur
    ctx.save()
    const suck = this.portal?.suckAt === undefined ? 0 : smooth(clamp((this.clock - this.portal.suckAt) / 1.8, 0, 1))
    if (suck) {
      const [X, Y] = this.px(PORTAL.x, PORTAL.y)
      ctx.translate(X, Y); ctx.rotate(suck * 2.6); ctx.scale(1 - suck, 1 - suck); ctx.translate(-X, -Y)
      alpha *= 1 - suck
    }
    ctx.translate(r.x, r.y)
    clip.draw(new Pen(ctx, r.w, r.h), t)
    const fade = clip.seamless ? 0 : Math.max(1 - smooth(clamp(t / .35, 0, 1)), smooth(clamp((t - clip.dur + .35) / .35, 0, 1)))
    ctx.globalAlpha = 1 - (1 - fade) * alpha; ctx.fillStyle = STAGE_BG; ctx.fillRect(0, 0, r.w, r.h)
    ctx.restore()
  }

  // What the video is called, pinned to the stage's top corner.
  drawTag(name, alpha) {
    const ctx = this.ctx, r = this.rect, size = clamp(r.w / 60, 11, 15)
    ctx.font = `${size}px ${this.serif}`
    const w = ctx.measureText(name).width + size * 1.6, h = size * 2, x = r.x + r.w - w - 12, y = r.y + 10
    ctx.globalAlpha = alpha
    ctx.fillStyle = "rgba(8,9,10,.8)"; ctx.strokeStyle = "#F4D345"; ctx.lineWidth = 1
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = "#F4D345"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(name, x + w / 2, y + h / 2 + 1)
    ctx.globalAlpha = 1
  }

  // How open the portal to Hack Club Auth is, 0 to 1 (throughPortal, portalBack).
  portalOpen() {
    const p = this.portal
    if (!p) return 0
    const open = smooth(clamp((this.clock - p.openAt) / 1.6, 0, 1))
    return p.closeAt === undefined ? open : open * (1 - smooth(clamp((this.clock - p.closeAt) / .9, 0, 1)))
  }

  // The portal, on the stage under the cast: a dark well with π's digits spiralling down into it, shrinking and
  // warming (through manim's colours) as they fall towards the light in the middle. The rings of digits round its rim
  // are in front (drawRim), and Hack Club's world is over the stage (placeWorld).
  drawPortal() {
    const ctx = this.ctx, [X, Y] = this.px(PORTAL.x, PORTAL.y), R = PORTAL.r * this.s * this.vortex, k = R / 118
    if (R < 2) return
    ctx.save()
    ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.clip()
    const well = ctx.createRadialGradient(X, Y, 0, X, Y, R)
    well.addColorStop(0, "#fff7ed"); well.addColorStop(.25, "#2a2440"); well.addColorStop(1, "#07080a")
    ctx.fillStyle = well; ctx.fillRect(X - R, Y - R, 2 * R, 2 * R)
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    const fall = this.clock * (.06 + .12 * (this.holdK ?? 0))
    for (let i = 0; i < 140; i++) {
      const u = (i / 140 + fall) % 1, r = R * (1 - u) * .95, a = i * .52 + u * 9
      ctx.fillStyle = rgba(manimRamp(u), .35 + .6 * (1 - u))
      ctx.font = `${(6 + 12 * (1 - u)) * k}px ${this.serif}`
      ctx.fillText(PI_DIGITS[(i * 7) % PI_DIGITS.length], X + Math.cos(a) * r, Y + Math.sin(a) * r)
    }
    ctx.restore()
  }

  // Hack Club's world over the stage: the stage's box, its unit, the portal's centre, and which part π is on, so CSS
  // can fly each print, polaroid and note out of the portal to its place.
  placeWorld() {
    const el = this.worldTarget, p = this.portal, show = p && p.diveAt === undefined && p.show !== "none" ? p.show : null
    if ((el.dataset.show ?? null) !== show) { if (show) el.dataset.show = show; else delete el.dataset.show }
    el.toggleAttribute("data-holding", (this.holdK ?? 0) > .02 && !!show)
    if (!show && !el.style.width) return
    const r = this.rect
    el.style.transform = `translate(${r.x}px, ${r.y}px)`
    el.style.width = `${r.w}px`; el.style.height = `${r.h}px`
    el.style.setProperty("--u", `${this.s}px`)
    el.style.setProperty("--pcx", PORTAL.x); el.style.setProperty("--pcy", PORTAL.y)
  }

  // The portal's rim, in front of everything on the stage: a white circle, and round it π's digits in two rings
  // turning opposite ways, faster as you hold.
  drawRim() {
    if (!this.vortex || this.portal?.diveAt !== undefined || !this.s) return
    const ctx = this.fctx, r = this.rect, [X, Y] = this.px(PORTAL.x, PORTAL.y), R = PORTAL.r * this.s * this.vortex, k = R / 118
    const spin = this.clock + 3 * (this.holdK ?? 0) * this.clock
    ctx.save()
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.clip()
    ctx.globalAlpha = smooth(clamp(this.portalOpen(), 0, 1))
    ctx.strokeStyle = "#ece9e2"; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.stroke()
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    const ring = (radius, size, speed, color, from) => {
      const step = size * .62 / radius, n = Math.floor(Math.PI * 2 / step)
      ctx.font = `${size}px ${this.serif}`; ctx.fillStyle = color
      for (let i = 0; i < n; i++) {
        const a = i * step + spin * speed
        ctx.save(); ctx.translate(X + Math.cos(a) * radius, Y + Math.sin(a) * radius); ctx.rotate(a + Math.PI / 2)
        ctx.fillText(PI_DIGITS[(from + i) % PI_DIGITS.length], 0, 0); ctx.restore()
      }
    }
    ring(R + 16 * k, 19 * k, .22, "#F4D345", 0)
    ring(R + 40 * k, 14 * k, -.14, "rgba(88,196,221,.8)", 120)
    ctx.restore()
  }

  // Through the portal, after the countdown: the hole grows over the whole screen, editor and all, and Hack Club
  // Auth's own page for Manimator comes up through it. It starts small enough that its background's ring of π's digits
  // sits on this portal's rim, and ends at full size where the browser is about to put the real page, so the jump to
  // Hack Club Auth feels like arriving where the portal led.
  drawDive() {
    const p = this.portal
    if (p?.diveAt === undefined) return
    const ctx = this.fctx, W = innerWidth, H = innerHeight, d = smooth(clamp((this.clock - p.diveAt) / 1.1, 0, 1))
    const [X, Y] = this.px(PORTAL.x, PORTAL.y), R = lerp(PORTAL.r * this.s, Math.hypot(W, H), d * d)
    const k0 = PORTAL.r * this.s / (AUTH_HOLE * Math.max(W / 1920, H / 1080))
    ctx.save()
    ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.clip()
    this.drawAuthSide(ctx, lerp(X, W / 2, d), lerp(Y, H / 2, d), k0 * (1 / k0) ** d)
    ctx.restore()
    if (d < 1) {
      ctx.save()
      ctx.strokeStyle = "#ece9e2"; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    }
  }

  // Hack Club Auth's welcome page as it looks for Manimator (hackclub/auth's AuthWelcome with the manimator
  // onboarding scenario), laid out for this window and drawn with its centre at (cx, cy), scaled by k: the portal
  // behind it, Hack Club's logo × π's, the card in its manim frame, "You made it through the portal" in Computer
  // Modern, the email box (with your email already in, if we have it: it goes along as login_hint), Continue →, and
  // the footer. Light or dark the way Hack Club Auth picks it, from your system's setting.
  drawAuthSide(ctx, cx, cy, k) {
    const W = innerWidth, H = innerHeight, dark = matchMedia("(prefers-color-scheme: dark)").matches
    const c = dark ? AUTH_DARK : AUTH_LIGHT, img = this.authImages, sans = "Inter, system-ui, sans-serif"
    const email = (typeof this.email === "string" ? this.email : this.loginHintTarget.value) || null
    ctx.fillStyle = c.page
    ctx.fillRect(0, 0, W, H)
    ctx.save()
    ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2)

    const bg = img[dark ? "bg-dark" : "bg-light"]
    if (bg?.naturalWidth) {
      const s = Math.max(W / bg.naturalWidth, H / bg.naturalHeight), w = bg.naturalWidth * s, h = bg.naturalHeight * s
      ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h)
    }

    // The card's lines, wrapped to its width the way the browser would.
    const cw = Math.min(610, W - 32), inner = cw - 82
    const wrap = (text, font) => {
      ctx.font = font
      const lines = [""]
      for (const word of text.split(" ")) {
        const line = lines.at(-1) ? `${lines.at(-1)} ${word}` : word
        if (lines.at(-1) && ctx.measureText(line).width > inner) lines.push(word); else lines[lines.length - 1] = line
      }
      return lines
    }
    const h1Font = `400 29.6px "Computer Modern Serif", Georgia, serif`, subFont = `15.2px ${sans}`, helpFont = `13.33px ${sans}`
    const h1 = wrap("You made it through the portal", h1Font)
    const sub = wrap("Enter your email and we'll send you a code. π's holding the portal open.", subFont)
    const help = wrap("This'll be the email you use across Hack Club. We recommend using your personal email. If you already have a Hack Club account, just put your existing email in here :-)", helpFont)
    const yInput = 41 + h1.length * 33.3 + 12 + sub.length * 22.8 + 47, yHelp = yInput + 38 + 24
    const yButton = yHelp + help.length * 16.67 + 33, yFooter = yButton + 38 + 63, ch = yFooter + 153
    const top = Math.max(32, (H - (56 + ch)) / 2 + 15), L = (W - cw) / 2, T = top + 56

    // Hack Club × π
    const logo = (image, x, framed) => {
      ctx.save()
      ctx.beginPath(); ctx.roundRect(x, top, 36, 36, 8)
      if (framed) { ctx.fillStyle = c.logoBox; ctx.fill(); ctx.strokeStyle = c.logoBorder; ctx.lineWidth = 1; ctx.stroke() }
      ctx.clip()
      if (image?.naturalWidth) ctx.drawImage(image, x + (framed ? 1 : 0), top + (framed ? 1 : 0), framed ? 34 : 36, framed ? 34 : 36)
      ctx.restore()
    }
    logo(img.hc, W / 2 - 49, false)
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.globalAlpha = .5; ctx.fillStyle = c.text; ctx.font = `500 15.2px ${sans}`
    ctx.fillText("×", W / 2, top + 18)
    ctx.globalAlpha = 1
    logo(img.pi, W / 2 + 13, true)

    // The card, in the manimator scenario's frame: a thin rim, and a band of paper (or night) round it.
    ctx.save()
    ctx.shadowColor = c.shadow; ctx.shadowBlur = 90; ctx.shadowOffsetY = 30
    ctx.fillStyle = c.ring
    ctx.beginPath(); ctx.roundRect(L - 8, T - 8, cw + 16, ch + 16, 24); ctx.fill()
    ctx.restore()
    const face = ctx.createLinearGradient(L, T, L + cw * .26, T + ch)
    face.addColorStop(0, c.card[0]); face.addColorStop(1, c.card[1])
    ctx.fillStyle = face; ctx.strokeStyle = c.rim; ctx.lineWidth = 1
    ctx.beginPath(); ctx.roundRect(L + .5, T + .5, cw - 1, ch - 1, 16); ctx.fill(); ctx.stroke()

    ctx.fillStyle = c.strong; ctx.font = h1Font
    h1.forEach((line, i) => ctx.fillText(line, W / 2, T + 41 + 16.6 + i * 33.3))
    ctx.fillStyle = c.sub; ctx.font = subFont
    const ySub = T + 41 + h1.length * 33.3 + 12
    sub.forEach((line, i) => ctx.fillText(line, W / 2, ySub + 11.4 + i * 22.8))

    // The email box, then the help under it.
    ctx.fillStyle = c.input; ctx.strokeStyle = c.inputBorder
    ctx.beginPath(); ctx.roundRect(L + 41.5, T + yInput + .5, inner - 1, 37, 10); ctx.fill(); ctx.stroke()
    ctx.save()
    ctx.beginPath(); ctx.rect(L + 58, T + yInput, inner - 34, 38); ctx.clip()
    ctx.textAlign = "left"; ctx.fillStyle = email ? c.inputText : c.placeholder; ctx.font = `16px ${sans}`
    ctx.fillText(email ?? "orpheus@dino.mail", L + 58, T + yInput + 19)
    ctx.restore()
    ctx.textAlign = "left"; ctx.fillStyle = c.text; ctx.font = helpFont
    help.forEach((line, i) => ctx.fillText(line, L + 41, T + yHelp + 8.3 + i * 16.67))

    // Continue →, in Hack Club's red.
    const red = ctx.createLinearGradient(0, T + yButton, 0, T + yButton + 38)
    red.addColorStop(0, c.button[0]); red.addColorStop(1, c.button[1])
    ctx.fillStyle = red; ctx.strokeStyle = c.buttonBorder
    ctx.beginPath(); ctx.roundRect(L + 41.5, T + yButton + .5, inner - 1, 37, 10); ctx.fill(); ctx.stroke()
    ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = `600 16px ${sans}`
    ctx.fillText("Continue →", W / 2, T + yButton + 19)

    // The footer: who to email if it goes wrong, and the links.
    ctx.fillStyle = c.divider
    ctx.fillRect(L + 41, T + yFooter, inner, 1)
    const run = (parts, y, font) => {
      ctx.font = font
      let x = W / 2 - parts.reduce((sum, [text]) => sum + ctx.measureText(text).width, 0) / 2
      ctx.textAlign = "left"
      for (const [text, color] of parts) { ctx.fillStyle = color; ctx.fillText(text, x, y); x += ctx.measureText(text).width }
    }
    run([["If you're having trouble logging in, please email ", c.muted], ["auth@hackclub.com", c.link], [".", c.muted]], T + yFooter + 50, `14.4px ${sans}`)
    run([["Privacy", c.link], [" • ", c.muted], ["Terms", c.link], [" • ", c.muted], ["Contact", c.link]], T + yFooter + 76, `500 14.4px ${sans}`)
    ctx.restore()
  }

  // The idea step's cards, each playing its own sketch.
  drawScreens(now) {
    const ratio = Math.min(2, devicePixelRatio || 1)
    for (const [canvas, { clip, t0 }] of this.screens) {
      const w = Math.round(canvas.clientWidth * ratio), h = Math.round(canvas.clientHeight * ratio)
      if (!w || !h) continue
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
      const ctx = canvas.getContext("2d"), t = (now - t0) / 1000 % clip.dur
      ctx.clearRect(0, 0, w, h)
      clip.draw(new Pen(ctx, w, h), t)
      const fade = clip.seamless ? 0 : Math.max(1 - smooth(clamp(t / .35, 0, 1)), smooth(clamp((t - clip.dur + .35) / .35, 0, 1)))
      if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = "#08090a"; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1 }
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

// Your answers if you've just come back from signing in with Hack Club (see signIn()), once.
function takeSigning() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SIGNING_KEY))
    sessionStorage.removeItem(SIGNING_KEY)
    return saved?.answers?.idea && saved.answers.prize ? saved : null
  } catch { return null }
}
