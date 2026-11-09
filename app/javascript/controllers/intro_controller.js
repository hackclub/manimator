import { Controller } from "@hotwired/stimulus"

// The way into onboarding (onboarding/pledge.html.erb): π drops into a vector field like a stone into a pond. The
// field ripples out from where it lands, particles stream along the flow, and the pointer stirs it all (a drag, on
// touch). Then a last ripple washes the field away to show the page, and π hops over to its spot by the questions.
// Once a tab (sessionStorage), never with reduced motion; a click, tap or key skips it. Keep stirring and it waits for
// you, up to a point. ?intro plays it again, and ?intro=0.2 plays it at a fifth of the speed.
const SEEN_KEY = "manimator:intro"
const FALL_AT = .2
const LAND_AT = .85
const REVEAL_AT = 3
const LATEST_REVEAL = 7
const REVEAL_FOR = .9
const SKIP_FOR = .55
const FEET = .79 // where π's feet are, as a fraction of its image's height
const RINGS = 3
const TRAIL = 12
const BG = "#0e0f11"

const BLUE = [88, 196, 221], TEAL = [92, 208, 179], YELLOW = [244, 211, 69], WHITE = [255, 255, 255]
const ramp = v => { const [a, b, w] = v < .5 ? [BLUE, TEAL, v * 2] : [TEAL, YELLOW, (v - .5) * 2]; return a.map((c, i) => c + (b[i] - c) * w) }
const mix = (a, b, w) => a.map((c, i) => Math.round(c + (b[i] - c) * w))
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v
const easeOut = k => 1 - (1 - k) ** 3
const easeInOut = k => k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
const lerp = (a, b, k) => a + (b - a) * k

// Arrow colours by magnitude (blue → teal → yellow), each brightening toward white as a ripple passes.
const HUES = 12, GLOWS = 4
const ARROW_COLORS = Array.from({ length: HUES * GLOWS }, (_, i) =>
  `rgb(${mix(ramp(Math.floor(i / GLOWS) / (HUES - 1)), WHITE, (i % GLOWS) / (GLOWS - 1) * .8).join(",")})`)
const SPEEDS = 8
const PARTICLE_COLORS = Array.from({ length: SPEEDS }, (_, i) => `rgb(${mix(ramp(Math.min(1, i / (SPEEDS - 2))), WHITE, i === SPEEDS - 1 ? .35 : 0).join(",")})`)

export default class extends Controller {
  connect() {
    if (!this.shouldPlay()) return
    this.poses = JSON.parse(this.element.dataset.pledgePosesValue || "{}")
    this.mascot = this.element.querySelector(".mascot__pi")
    this.t = 0
    this.phase = 0
    this.landedAt = null
    this.revealAt = null
    this.lastStir = -1
    this.pointer = null
    this.vec = new Float32Array(3)
    this.build()
    this.size()
    this.element.dataset.intro = "playing"

    this.last = performance.now()
    this.frame(this.last)
    const loop = now => { this.frame(now); if (this.overlay) this.raf = requestAnimationFrame(loop) }
    this.raf = requestAnimationFrame(loop)
  }

  disconnect() {
    clearTimeout(this.waveTimer)
    this.finish(false)
  }

  shouldPlay() {
    if (!this.element.querySelector(".mascot__pi")) return false
    const param = new URLSearchParams(location.search).get("intro")
    this.speed = Number(param) > 0 ? Math.min(4, Number(param)) : 1
    if (param !== null) return true
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return false
      sessionStorage.setItem(SEEN_KEY, "1")
    } catch { /* storage unavailable: play it */ }
    return true
  }

  build() {
    const overlay = this.overlay = document.createElement("div")
    overlay.className = "intro"
    overlay.innerHTML = `<canvas class="intro__canvas" aria-hidden="true"></canvas>
      <img class="intro__pi" alt="" draggable="false">
      <p class="intro__formula" aria-hidden="true"><i>F</i>(<i>x</i>, <i>y</i>) = (sin <i>y</i>, sin <i>x</i>)</p>
      <button type="button" class="intro__skip">skip</button>`
    this.canvas = overlay.querySelector("canvas")
    this.ctx = this.canvas.getContext("2d")
    this.pi = overlay.querySelector(".intro__pi")
    this.formula = overlay.querySelector(".intro__formula")
    this.element.prepend(overlay)

    this.listeners = [
      [overlay, "pointerdown", e => { this.down = [e.clientX, e.clientY]; this.dragged = false; this.stir(e) }],
      [overlay, "pointermove", e => this.stir(e)],
      [overlay, "pointerup", () => { this.down = null }],
      [overlay, "pointerleave", e => { if (e.pointerType === "mouse") this.pointer = null }],
      [overlay, "pointercancel", () => { this.pointer = null; this.down = null }],
      [overlay, "click", () => { if (!this.dragged) this.skip() }],
      [overlay, "wheel", e => e.preventDefault(), { passive: false }],
      [window, "keydown", e => { if (!["Tab", "Shift", "Control", "Alt", "Meta"].includes(e.key)) this.skip() }],
      [window, "resize", () => this.size()],
      [document, "turbo:before-cache", () => this.finish(false)],
    ]
    this.listeners.forEach(([el, type, fn, options]) => el.addEventListener(type, fn, options))
  }

  size() {
    const W = innerWidth, H = innerHeight, d = Math.min(2, devicePixelRatio || 1)
    this.W = W; this.H = H
    this.canvas.width = Math.round(W * d)
    this.canvas.height = Math.round(H * d)
    this.ctx.setTransform(d, 0, 0, d, 0, 0)
    this.u = clamp(Math.min(W, H) / 8.5, 44, 92) // one unit of the plane, in px
    this.cx = W / 2
    this.cy = H * .5
    this.S = clamp(Math.min(W, H) * .2, 104, 176) // π's size, out in the field
    this.pi.style.width = `${this.S}px`
    this.flow = this.u * 2
    this.waveSpeed = Math.hypot(W, H) * .42
    this.waveWidth = this.u * .55
    this.maxR = Math.hypot(Math.max(this.cx, W - this.cx), Math.max(this.cy, H - this.cy))

    const sp = this.spacing = clamp(this.u * .42, 24, 34)
    const cols = Math.ceil(W / sp) + 1, rows = Math.ceil(H / sp) + 1
    const x0 = this.cx - Math.floor(cols / 2) * sp, y0 = this.cy - Math.floor(rows / 2) * sp
    this.arrows = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = x0 + c * sp, y = y0 + r * sp
      this.arrows.push({ x, y, delay: Math.hypot(x - this.cx, y - this.cy) / this.maxR * .5 + Math.random() * .06 })
    }
    this.geo = new Float32Array(this.arrows.length * 4)
    this.buckets = ARROW_COLORS.map(() => [])

    if (!this.px) this.particles()
  }

  // A third drift with the flow from the start, faintly; the rest burst out from where π lands.
  particles() {
    const N = this.N = this.W < 720 ? 650 : 1200
    this.ambient = Math.round(N * .3)
    this.px = new Float32Array(N); this.py = new Float32Array(N)
    this.vx = new Float32Array(N); this.vy = new Float32Array(N)
    this.trail = new Float32Array(N * TRAIL * 2)
    this.head = 0
    this.alive = new Uint8Array(N)
    for (let i = 0; i < this.ambient; i++) this.place(i, Math.random() * this.W, Math.random() * this.H)
    this.alive.fill(1, 0, this.ambient)
  }

  place(i, x, y) {
    this.px[i] = x; this.py[i] = y
    for (let k = 0; k < TRAIL; k++) { this.trail[(i * TRAIL + k) * 2] = x; this.trail[(i * TRAIL + k) * 2 + 1] = y }
  }

  splash() {
    const n = this.N - this.ambient
    for (let j = 0; j < n; j++) {
      const i = this.ambient + j, a = Math.random() * Math.PI * 2, r = (.15 + Math.random() * .35) * this.u
      const v = (2.5 + Math.random() ** 2 * 6) * this.u
      this.place(i, this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r * .9)
      this.vx[i] = Math.cos(a) * v; this.vy[i] = Math.sin(a) * v
      this.alive[i] = 1
    }
  }

  stir(event) {
    const now = performance.now(), p = this.pointer
    if (p) {
      const dt = Math.max(8, now - p.at) / 1000
      p.vx = p.vx * .5 + (event.clientX - p.x) / dt * .5
      p.vy = p.vy * .5 + (event.clientY - p.y) / dt * .5
      p.x = event.clientX; p.y = event.clientY; p.at = now
      if (Math.hypot(p.vx, p.vy) > 60 && !this.revealAt) this.lastStir = this.t
    } else {
      this.pointer = { x: event.clientX, y: event.clientY, vx: 0, vy: 0, at: now }
    }
    if (this.down && Math.hypot(event.clientX - this.down[0], event.clientY - this.down[1]) > 12) this.dragged = true
  }

  skip() {
    if (this.revealAt === null) this.reveal(SKIP_FOR)
  }

  // F(x, y) = (sin y, sin x) on a plane centred on the screen, plus the ripples from where π landed and the pull of
  // the pointer. Writes the screen-space vector (in units) and how strongly a ripple is passing into this.vec.
  field(x, y) {
    const X = (x - this.cx) / this.u, Y = (this.cy - y) / this.u
    let fx = Math.sin(Y + this.phase), fy = -Math.sin(X - this.phase * .7), glow = 0
    if (this.landedAt !== null) {
      const dx = x - this.cx, dy = y - this.cy, d = Math.hypot(dx, dy) + .01, since = this.t - this.landedAt
      let s = 0
      for (let n = 0; n < RINGS; n++) {
        const tn = since - n * .26
        if (tn <= 0) break
        const q = (d - tn * this.waveSpeed * (1 - n * .12)) / this.waveWidth
        if (q > -3 && q < 3) s += Math.exp(-q * q) * Math.cos(q * 2.3) * Math.exp(-tn * .55) * (1 - n * .3)
      }
      fx += dx / d * s * 2.6; fy += dy / d * s * 2.6; glow = Math.abs(s)
    }
    const p = this.pointer
    if (p) {
      const dx = x - p.x, dy = y - p.y, sigma = this.u * 1.6, g = Math.exp(-(dx * dx + dy * dy) / (sigma * sigma))
      if (g > .01) {
        const swirl = .9 + Math.min(2, Math.hypot(p.vx, p.vy) / 500)
        fx += (p.vx / this.flow * .5 - dy / sigma * swirl) * g
        fy += (p.vy / this.flow * .5 + dx / sigma * swirl) * g
        glow = Math.max(glow, g * Math.min(1, Math.hypot(p.vx, p.vy) / 900))
      }
    }
    this.vec[0] = fx; this.vec[1] = fy; this.vec[2] = glow
  }

  reveal(duration) {
    const r = this.mascot.getBoundingClientRect()
    this.revealAt = this.t
    this.revealFor = duration
    this.from = { x: this.piX, y: this.piY, scale: this.piScale }
    this.to = { x: r.left + r.width / 2, y: r.top + r.height * FEET, scale: r.width / this.S }
    this.setPose("happy")
    this.overlay.querySelector(".intro__skip").hidden = true
  }

  frame(now) {
    const dt = Math.min(.05, Math.max(0, now - this.last) / 1000) * this.speed
    this.last = now
    this.t += dt
    this.phase += dt * .1
    const p = this.pointer
    if (p) { const k = Math.exp(-dt * 5); p.vx *= k; p.vy *= k }

    if (this.landedAt === null && this.revealAt === null && this.t >= LAND_AT) {
      this.landedAt = LAND_AT
      this.splash()
      this.setPose("hooray")
    }
    if (this.revealAt === null && this.t >= Math.max(REVEAL_AT, Math.min(LATEST_REVEAL, this.lastStir + 1))) this.reveal(REVEAL_FOR)
    const k = this.revealAt === null ? 0 : clamp((this.t - this.revealAt) / this.revealFor, 0, 1)

    this.movePi(k)
    this.moveParticles(dt, k)
    this.draw(k)
    if (k >= 1) this.finish(true)
  }

  movePi(k) {
    let x = this.cx, y, rot = 0, sx = 1, sy = 1, scale = 1
    if (this.landedAt === null) {
      const f = clamp((this.t - FALL_AT) / (LAND_AT - FALL_AT), 0, 1)
      y = lerp(-this.S * .3, this.cy, f * f)
      rot = -12 * (1 - f) + Math.sin(this.t * 11) * 4 * (1 - f)
      sy = 1 + .1 * f * f; sx = 1 / Math.sqrt(sy)
      if (this.pose !== "surprised" && this.revealAt === null) this.setPose("surprised")
    } else {
      const since = this.t - this.landedAt
      sy = 1 - .3 * Math.exp(-since * 6) * Math.cos(since * 17); sx = 1 + (1 - sy) * .7
      y = this.cy - Math.sin(Math.min(since, .5) * Math.PI * 2) * this.u * .1 * Math.exp(-since * 3) + Math.sin(since * 2.2) * this.u * .04 * (1 - Math.exp(-since * 2))
      if (since > .6 && this.pose === "hooray" && this.revealAt === null) this.setPose("awe")
    }
    if (this.revealAt !== null) {
      const e = easeInOut(k)
      x = lerp(this.from.x, this.to.x, e)
      y = lerp(this.from.y, this.to.y, e) - Math.sin(Math.PI * e) * Math.min(this.H * .14, 120)
      scale = lerp(this.from.scale, this.to.scale, e)
      rot = lerp(rot, 0, e) - Math.sin(Math.PI * e) * 8
      sx = lerp(sx, 1, e); sy = lerp(sy, 1, e)
      if (k > .7 && this.pose !== "home") { this.pi.src = this.mascot.currentSrc || this.mascot.src; this.pose = "home" }
    }
    this.piX = x; this.piY = y; this.piScale = scale
    this.pi.style.transform = `translate(${x - this.S / 2}px, ${y - this.S * FEET}px) rotate(${rot}deg) scale(${sx * scale}, ${sy * scale})`
  }

  moveParticles(dt, k) {
    if (!dt) return
    const N = this.N, relax = 1 - Math.exp(-dt * 2.4), gather = k > 0 ? k * k * 40 : 0
    const W = this.W, H = this.H, gx = this.piX, gy = this.piY - this.S * this.piScale * .35
    this.head = (this.head + 1) % TRAIL
    for (let i = 0; i < N; i++) {
      if (!this.alive[i]) continue
      this.field(this.px[i], this.py[i])
      let vx = this.vx[i] + (this.vec[0] * this.flow - this.vx[i]) * relax
      let vy = this.vy[i] + (this.vec[1] * this.flow - this.vy[i]) * relax
      if (gather) { vx += (gx - this.px[i]) * gather * dt; vy += (gy - this.py[i]) * gather * dt; vx *= 1 - k * .08; vy *= 1 - k * .08 }
      this.vx[i] = vx; this.vy[i] = vy
      const x = this.px[i] + vx * dt, y = this.py[i] + vy * dt
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) {
        this.place(i, Math.random() * W, Math.random() * H)
        continue
      }
      this.px[i] = x; this.py[i] = y
      this.trail[(i * TRAIL + this.head) * 2] = x
      this.trail[(i * TRAIL + this.head) * 2 + 1] = y
    }
  }

  draw(k) {
    const ctx = this.ctx, W = this.W, H = this.H, u = this.u, t = this.t
    ctx.globalCompositeOperation = "source-over"
    ctx.globalAlpha = 1
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, W, H)

    // A faint number plane underneath, as in manim.
    const plane = clamp(t / .5, 0, 1)
    ctx.lineWidth = 1
    ctx.strokeStyle = `rgba(88,196,221,${.07 * plane})`
    ctx.beginPath()
    for (let x = this.cx % u; x < W; x += u) { ctx.moveTo(x, 0); ctx.lineTo(x, H) }
    for (let y = this.cy % u; y < H; y += u) { ctx.moveTo(0, y); ctx.lineTo(W, y) }
    ctx.stroke()
    ctx.strokeStyle = `rgba(236,233,226,${.14 * plane})`
    ctx.beginPath(); ctx.moveTo(0, this.cy); ctx.lineTo(W, this.cy); ctx.moveTo(this.cx, 0); ctx.lineTo(this.cx, H); ctx.stroke()

    this.drawArrows()

    // Where π will land, glowing as it gets close; then the rings it sends out.
    if (this.landedAt === null) {
      const f = clamp((t - FALL_AT) / (LAND_AT - FALL_AT), 0, 1) ** 3
      const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, u * 1.4)
      g.addColorStop(0, `rgba(244,211,69,${.22 * f})`); g.addColorStop(1, "rgba(244,211,69,0)")
      ctx.fillStyle = g; ctx.fillRect(this.cx - u * 1.5, this.cy - u * 1.5, u * 3, u * 3)
    } else {
      const since = t - this.landedAt
      ctx.lineWidth = 1.5
      for (let n = 0; n < RINGS; n++) {
        const tn = since - n * .26
        if (tn <= 0) break
        const a = .35 * Math.exp(-tn * 1.4) * (1 - n * .3)
        if (a < .01) continue
        ctx.strokeStyle = `rgba(255,255,255,${a})`
        ctx.beginPath(); ctx.arc(this.cx, this.cy, tn * this.waveSpeed * (1 - n * .12), 0, Math.PI * 2); ctx.stroke()
      }
      if (since < .35) {
        const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, u * 2.2)
        g.addColorStop(0, `rgba(255,255,255,${.35 * (1 - since / .35)})`); g.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = g; ctx.fillRect(this.cx - u * 2.2, this.cy - u * 2.2, u * 4.4, u * 4.4)
      }
    }

    this.drawParticles(k)

    // The reveal: a last ripple from the middle that takes the field with it.
    if (k > 0) {
      const edge = u * 2, r = lerp(k, k * k * (3 - 2 * k), .6) * (this.maxR + edge * 1.2)
      ctx.globalCompositeOperation = "destination-out"
      const g = ctx.createRadialGradient(this.cx, this.cy, Math.max(0, r - edge), this.cx, this.cy, Math.max(.1, r))
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(this.cx, this.cy, Math.max(.1, r), 0, Math.PI * 2); ctx.fill()
      ctx.globalCompositeOperation = "source-over"
      ctx.lineWidth = 2
      ctx.strokeStyle = `rgba(92,208,179,${.55 * (1 - k)})`
      ctx.beginPath(); ctx.arc(this.cx, this.cy, Math.max(.1, r - edge * .55), 0, Math.PI * 2); ctx.stroke()
    }

    const since = this.landedAt === null ? 0 : t - this.landedAt
    this.formula.style.opacity = clamp((since - .4) / .5, 0, 1) * clamp(1 - k * 2.5, 0, 1)
  }

  drawArrows() {
    const ctx = this.ctx, sp = this.spacing, t = this.t, geo = this.geo, buckets = this.buckets
    buckets.forEach(b => { b.length = 0 })
    this.arrows.forEach((a, i) => {
      const grow = easeOut(clamp((t - .05 - a.delay) / .4, 0, 1))
      if (!grow) return
      this.field(a.x, a.y)
      const fx = this.vec[0], fy = this.vec[1], glow = this.vec[2], mag = Math.hypot(fx, fy) + 1e-6
      const len = Math.min(sp * 1.15, sp * .8 * (1 - Math.exp(-mag * 1.5)) * (1 + glow * .35)) * grow
      if (len < 1.5) return
      geo[i * 4] = a.x; geo[i * 4 + 1] = a.y; geo[i * 4 + 2] = fx / mag * len; geo[i * 4 + 3] = fy / mag * len
      const hue = Math.min(HUES - 1, Math.round(clamp(mag / 1.45, 0, 1) * (HUES - 1)))
      buckets[hue * GLOWS + Math.min(GLOWS - 1, Math.round(glow * 2.6))].push(i)
    })
    ctx.lineWidth = clamp(sp / 20, 1.2, 1.7)
    ctx.lineCap = "round"
    // Once π lands the arrows step back a little and let the flow show, except where a ripple is passing.
    const dim = this.landedAt === null ? 0 : .3 * clamp((t - this.landedAt - .4) / 1.2, 0, 1)
    buckets.forEach((list, b) => {
      if (!list.length) return
      ctx.globalAlpha = 1 - dim * (1 - (b % GLOWS) / (GLOWS - 1))
      ctx.strokeStyle = ctx.fillStyle = ARROW_COLORS[b]
      ctx.beginPath()
      for (const i of list) {
        const x = geo[i * 4], y = geo[i * 4 + 1], dx = geo[i * 4 + 2], dy = geo[i * 4 + 3], len = Math.hypot(dx, dy)
        const h = Math.min(6, len * .38), ux = dx / len, uy = dy / len
        ctx.moveTo(x - dx / 2, y - dy / 2); ctx.lineTo(x + dx / 2 - ux * h * .7, y + dy / 2 - uy * h * .7)
      }
      ctx.stroke()
      ctx.beginPath()
      for (const i of list) {
        const x = geo[i * 4], y = geo[i * 4 + 1], dx = geo[i * 4 + 2], dy = geo[i * 4 + 3], len = Math.hypot(dx, dy)
        const h = Math.min(6, len * .38), ux = dx / len, uy = dy / len, tx = x + dx / 2, ty = y + dy / 2
        ctx.moveTo(tx, ty)
        ctx.lineTo(tx - ux * h - uy * h * .55, ty - uy * h + ux * h * .55)
        ctx.lineTo(tx - ux * h + uy * h * .55, ty - uy * h - ux * h * .55)
        ctx.closePath()
      }
      ctx.fill()
    })
    ctx.globalAlpha = 1
  }

  drawParticles(k) {
    const ctx = this.ctx, N = this.N, head = this.head, tr = this.trail, fast = this.flow * 3.2
    const groups = [[0, this.ambient, .45 * clamp((this.t - .2) / .6, 0, 1)], [this.ambient, N, .75]]
    ctx.lineWidth = 1.4
    ctx.lineJoin = "round"
    ctx.globalCompositeOperation = "lighter"
    for (const [from, to, alpha] of groups) {
      ctx.globalAlpha = alpha * (1 - k * k)
      if (ctx.globalAlpha < .01) continue
      for (let s = 0; s < SPEEDS; s++) {
        ctx.strokeStyle = PARTICLE_COLORS[s]
        ctx.beginPath()
        for (let i = from; i < to; i++) {
          if (!this.alive[i]) continue
          const speed = Math.min(SPEEDS - 1, Math.floor(Math.hypot(this.vx[i], this.vy[i]) / fast * (SPEEDS - 1)))
          if (speed !== s) continue
          for (let j = 0; j < TRAIL; j++) {
            const at = (i * TRAIL + (head + 1 + j) % TRAIL) * 2
            j ? ctx.lineTo(tr[at], tr[at + 1]) : ctx.moveTo(tr[at], tr[at + 1])
          }
        }
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"
  }

  setPose(name) {
    if (this.pose === name || !this.poses[name]) return
    this.pose = name
    this.pi.src = this.poses[name]
  }

  // Hands π over to the page's own, which waves (unless something else has changed its pose by then).
  finish(played) {
    if (!this.overlay) return
    cancelAnimationFrame(this.raf)
    this.listeners.forEach(([el, type, fn]) => el.removeEventListener(type, fn))
    this.overlay.remove()
    this.overlay = null
    delete this.element.dataset.intro
    if (!played) return
    const bubble = this.element.querySelector(".mascot__bubble")
    bubble?.classList.remove("mascot__bubble--pop")
    void bubble?.offsetWidth
    bubble?.classList.add("mascot__bubble--pop")
    this.wave()
  }

  wave() {
    const img = this.mascot, rest = img.getAttribute("src")
    const frames = ["wave_1", "wave_2", "wave_3", "wave_2", "wave_3", "wave_2", "wave_1"].map(pose => this.poses[pose]).filter(Boolean)
    let i = 0
    const next = () => {
      if (i > 0 && img.getAttribute("src") !== frames[i - 1]) return // the page has moved on
      if (i === frames.length) { img.src = rest; return }
      img.src = frames[i++]
      this.waveTimer = setTimeout(next, 150)
    }
    next()
  }
}
