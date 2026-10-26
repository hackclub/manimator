import { Controller } from "@hotwired/stimulus"

// Hero field: ~2400 short strokes that drift in a flow field and settle into
// the shape of the "Manimator" wordmark. The pointer stirs them; a click scatters them.
export default class extends Controller {
  static targets = ["canvas", "title"]

  connect() {
    this.particles = Array.from({ length: 2400 }, () => ({ x: Math.random() * 1440, y: Math.random() * 900, vx: 0, vy: 0, ti: 0, w: -.3 - Math.random() * 1.4 }))
    this.targetsPts = []
    this.cursor = null
    this.visible = true
    this.hovering = false

    this.size()
    this.resizeObserver = new ResizeObserver(() => this.size())
    this.resizeObserver.observe(this.element)
    this.visibilityObserver = new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting })
    this.visibilityObserver.observe(this.element)

    document.fonts?.ready.then(() => { this.buildTimer = setTimeout(() => this.build(), 300) })
    document.fonts?.load("italic 200px 'Computer Modern Serif'").then(() => this.build(), () => {})

    const loop = now => { if (this.visible) this.tick(now / 1000); this.raf = requestAnimationFrame(loop) }
    this.raf = requestAnimationFrame(loop)
  }

  disconnect() {
    cancelAnimationFrame(this.raf)
    clearTimeout(this.buildTimer)
    this.resizeObserver?.disconnect()
    this.visibilityObserver?.disconnect()
  }

  // Touch has no hover, so a drag starts stirring from where the finger lands.
  press(event) {
    if (!this.width || event.pointerType !== "touch") return
    this.cursor = this.point(event)
  }

  move(event) {
    if (!this.width) return
    this.cursor = this.point(event)
    if (!this.hovering) { this.hovering = true; this.dispatch("hover", { detail: { on: true } }) }
  }

  leave() {
    this.cursor = null
    this.hovering = false
    this.dispatch("hover", { detail: { on: false } })
  }

  scatter(event) {
    if (event.target.closest("a, button, img")) return
    this.particles.forEach(p => {
      p.w = -.2 - Math.random() * 1.1
      const a = Math.random() * 6.283, v = 4 + Math.random() * 10
      p.vx += Math.cos(a) * v
      p.vy += Math.sin(a) * v
    })
    this.dispatch("scatter")
  }

  size() {
    const W = this.element.clientWidth, H = this.element.clientHeight
    if (!W || !H || (W === this.width && H === this.height)) return
    const first = !this.width
    this.width = W; this.height = H
    const d = Math.min(2, window.devicePixelRatio || 1)
    this.canvasTarget.width = Math.round(W * d)
    this.canvasTarget.height = Math.round(H * d)
    this.canvasTarget.getContext("2d").setTransform(d, 0, 0, d, 0, 0)
    if (first) this.particles.forEach(p => { p.x = Math.random() * W; p.y = Math.random() * H })
    this.build()
  }

  // Rasterise the wordmark offscreen and sample its filled pixels as particle homes.
  build() {
    if (!this.width) return
    const W = this.width, H = this.height
    const cr = this.canvasTarget.getBoundingClientRect(), k = cr.width / W || 1, r = this.titleTarget.getBoundingClientRect()
    const fs = parseFloat(getComputedStyle(this.titleTarget).fontSize) || 200
    const cx = (r.left + r.width / 2 - cr.left) / k, cy = (r.top + r.height / 2 - cr.top) / k
    const off = document.createElement("canvas"); off.width = W; off.height = H
    const g = off.getContext("2d")
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"
    g.font = `italic ${fs}px 'Computer Modern Serif', 'Latin Modern Roman', Georgia, serif`
    g.fillText("Manimator", cx, cy)
    const data = g.getImageData(0, 0, W, H).data, step = Math.max(2, Math.round(fs / 80)), pts = []
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 140) pts.push([x, y])
    if (!pts.length) return
    this.targetsPts = pts
    this.count = Math.max(700, Math.min(W < 720 ? 1300 : 2400, Math.round(pts.length * .9)))
    this.particles.forEach(p => { p.ti = Math.floor(Math.random() * pts.length) })
  }

  tick(t) {
    if (!this.targetsPts.length) return
    const ctx = this.canvasTarget.getContext("2d"), W = this.width, H = this.height, cur = this.cursor, dt = 1 / 60
    ctx.fillStyle = "rgba(14,15,17,.16)"; ctx.fillRect(0, 0, W, H)
    ctx.lineWidth = 1.7; ctx.lineCap = "round"
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]
      p.w = Math.min(1, p.w + dt * .5)
      const w = p.w <= 0 ? 0 : p.w * p.w, tg = this.targetsPts[p.ti] || this.targetsPts[0]
      const fx = .9 + .35 * Math.sin(p.y / 140 + t * .6) + .3 * Math.sin(p.x / 90 + t)
      const fy = .45 * Math.cos(p.x / 160 - t * .5) + .3 * Math.cos(p.y / 70 - t * .8)
      p.vx = p.vx * .86 + fx * (1 - w) * .5 + (tg[0] - p.x) * .02 * w + fx * .05 * w
      p.vy = p.vy * .86 + fy * (1 - w) * .5 + (tg[1] - p.y) * .02 * w + fy * .05 * w
      if (cur) {
        const dx = p.x - cur[0], dy = p.y - cur[1], r2 = dx * dx + dy * dy
        if (r2 < 25600) { const r = Math.sqrt(r2) + 1, f = (1 - r / 160) * 2.4; p.vx += (dx / r - dy / r * 1.4) * f; p.vy += (dy / r + dx / r * 1.4) * f }
      }
      let ox = p.x, oy = p.y
      p.x += p.vx; p.y += p.vy
      if (p.x > W + 20) { p.x = -10; ox = p.x; oy = p.y } else if (p.x < -40) { p.x = W + 10; ox = p.x; oy = p.y }
      if (p.y > H + 30) { p.y = -10; ox = p.x; oy = p.y } else if (p.y < -30) { p.y = H + 10; ox = p.x; oy = p.y }
      const m = Math.hypot(p.vx, p.vy)
      ctx.strokeStyle = m < .5 ? "rgba(236,233,226,.95)" : this.color(m * .6)
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(p.x + .01, p.y); ctx.stroke()
    }
  }

  // Speed ramps blue → yellow → red.
  color(m) {
    const u = Math.min(1, m / 3), A = [88, 196, 221], B = [244, 211, 69], C = [252, 98, 85]
    const [p, q, w] = u < .5 ? [A, B, u * 2] : [B, C, (u - .5) * 2], L = (a, b) => Math.round(a + (b - a) * w)
    return `rgba(${L(p[0], q[0])},${L(p[1], q[1])},${L(p[2], q[2])},.85)`
  }

  point(event) {
    const r = this.canvasTarget.getBoundingClientRect(), k = r.width / (this.width || r.width)
    return [(event.clientX - r.left) / k, (event.clientY - r.top) / k]
  }
}
