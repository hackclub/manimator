import { Controller } from "@hotwired/stimulus"

const ANIMS = ["Write", "FadeIn", "Create", "GrowFromCenter", "SpinInFromNothing"]
const HOLD = 1.2 // seconds the finished frame stays up before an animation replays
const SHIP = 7 // length of the "ship it" loop
const INK = "#ece9e2"

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
// manim's default rate function eases in and out; smoothstep is close enough here
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t) }
const span = (t, a, b) => smooth((t - a) / (b - a))
// Overshoots a little before settling, for things that pop
const pop = t => { t = clamp(t); const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2 }
const RED = "#FC6255", YELLOW = "#F4D345"

// The little scene beside "How it works". It follows whichever step is in the
// middle of the screen: step 1 shows your idea, step 2 plays it with the
// animation and run_time picked in the code, step 3 ships it and mails something back.
export default class extends Controller {
  static targets = ["canvas", "caption", "step", "idea", "anim", "runTime"]
  static values = { whoamiUrl: String }

  connect() {
    this.phase = 0
    this.anim = 0
    this.runTime = Math.PI
    this.start = performance.now()
    this.visible = false
    this.name = "you"
    this.fitIdea()
    this.askWhoami()

    this.resizeObserver = new ResizeObserver(() => this.size())
    this.resizeObserver.observe(this.canvasTarget)
    this.size()

    this.stepObserver = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) this.setPhase(this.stepTargets.indexOf(e.target))
    }), { rootMargin: "-45% 0px -45% 0px" })
    this.stepTargets.forEach(s => this.stepObserver.observe(s))
    this.viewObserver = new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting })
    this.viewObserver.observe(this.canvasTarget)

    const loop = now => { if (this.visible) this.draw((now - this.start) / 1000); this.raf = requestAnimationFrame(loop) }
    this.raf = requestAnimationFrame(loop)
  }

  disconnect() {
    cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
    this.stepObserver?.disconnect()
    this.viewObserver?.disconnect()
  }

  // Hack Club Auth's whoami, as hackclub/wrong-tool asks it: the first name of whoever's signed in there, so
  // the heart can be for them. Off a hackclub.com subdomain (or not signed in) it says nothing and it stays "you".
  async askWhoami() {
    if (!this.whoamiUrlValue) return
    try {
      const response = await fetch(this.whoamiUrlValue, { credentials: "include" })
      const { signed_in: signedIn, first_name: firstName } = await response.json()
      const name = (firstName || "").trim().slice(0, 24)
      if (signedIn && name) this.name = name
    } catch {}
  }

  setPhase(i) {
    if (i < 0 || i === this.phase) return
    this.phase = i
    this.start = performance.now()
  }

  restart() { this.start = performance.now() }

  // Controls in the code
  retype() { this.fitIdea(); this.setPhase(0) }
  showIdea() { this.setPhase(0) }

  nextAnim() {
    this.anim = (this.anim + 1) % ANIMS.length
    this.animTarget.textContent = ANIMS[this.anim]
    this.animTarget.setAttribute("aria-label", `Animation: ${ANIMS[this.anim]}. Click for another`)
    this.phase = 1
    this.restart()
  }

  dragStart(event) {
    const el = this.runTimeTarget, x0 = event.clientX, v0 = this.runTime
    el.setPointerCapture(event.pointerId)
    const move = e => this.setRunTime(v0 + (e.clientX - x0) * .03)
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up) }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)
  }

  nudge(event) {
    const d = { ArrowRight: .1, ArrowUp: .1, ArrowLeft: -.1, ArrowDown: -.1 }[event.key]
    if (!d) return
    event.preventDefault()
    this.setRunTime(this.runTime + d)
  }

  // Snaps to π when you pass near it, so PI is easy to get back to.
  setRunTime(v) {
    v = clamp(v, .3, 10)
    if (Math.abs(v - Math.PI) < .08) v = Math.PI
    this.runTime = v
    const label = v === Math.PI ? "PI" : v.toFixed(1)
    this.runTimeTarget.textContent = label
    this.phase = 1
    this.restart()
  }

  fitIdea() {
    const el = this.ideaTarget
    el.style.width = `${Math.max(4, el.value.length + .5)}ch`
  }

  get idea() { return this.ideaTarget.value.trim() || " " }

  size() {
    const c = this.canvasTarget, r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1)
    if (!r.width) return
    c.width = Math.round(r.width * d)
    c.height = Math.round(r.height * d)
    this.W = r.width
    this.H = r.height
    c.getContext("2d").setTransform(d, 0, 0, d, 0, 0)
  }

  draw(t) {
    if (!this.W) return
    const g = this.canvasTarget.getContext("2d")
    g.clearRect(0, 0, this.W, this.H)
    if (this.phase === 0) this.drawIdea(g, t)
    else if (this.phase === 1) this.drawPlay(g, t)
    else this.drawShip(g, t)
  }

  // Text sized to fit, centered on (x, y).
  font(g, scale = 1) {
    let size = this.H * .2 * scale
    g.font = `${size}px 'Computer Modern Serif', 'Latin Modern Roman', Georgia, serif`
    const w = g.measureText(this.idea).width, max = this.W * .84 * scale
    if (w > max) { size *= max / w; g.font = `${size}px 'Computer Modern Serif', 'Latin Modern Roman', Georgia, serif` }
    g.textAlign = "center"
    g.textBaseline = "middle"
    return size
  }

  text(g, { alpha = 1, stroke = 0, scale = 1 } = {}) {
    const size = this.font(g, scale)
    g.globalAlpha = alpha
    g.fillStyle = INK
    g.fillText(this.idea, 0, 0)
    if (stroke) { g.globalAlpha = stroke; g.lineWidth = Math.max(1, size / 60); g.strokeStyle = INK; g.strokeText(this.idea, 0, 0) }
    g.globalAlpha = 1
  }

  drawIdea(g, t) {
    g.save()
    g.translate(this.W / 2, this.H / 2)
    this.text(g, { alpha: span(t, 0, .35) })
    g.restore()
    this.caption("idea")
  }

  drawPlay(g, t) {
    const local = t % (this.runTime + HOLD), p = clamp(local / this.runTime), name = ANIMS[this.anim]
    g.save()
    g.translate(this.W / 2, this.H / 2)
    this.animate(g, name, smooth(p))
    g.restore()
    this.caption(`${name}(idea)  ·  ${Math.min(local, this.runTime).toFixed(2)} / ${this.runTime.toFixed(2)} s`)
  }

  animate(g, name, p) {
    const W = this.W, H = this.H
    if (name === "FadeIn") {
      g.translate(0, (1 - p) * H * .06)
      return this.text(g, { alpha: p })
    }
    if (name === "GrowFromCenter") {
      g.scale(Math.max(p, .001), Math.max(p, .001))
      return this.text(g)
    }
    if (name === "SpinInFromNothing") {
      g.rotate((1 - p) * Math.PI)
      g.scale(Math.max(p, .001), Math.max(p, .001))
      return this.text(g)
    }
    // Write traces the outline left to right, then fills; Create traces top to bottom.
    const trace = clamp(p / .7), fill = clamp((p - .55) / .45)
    g.save()
    g.beginPath()
    if (name === "Create") g.rect(-W / 2, -H / 2, W, H * trace)
    else g.rect(-W / 2, -H / 2, W * (.08 + .84 * trace) + (trace === 1 ? W : 0), H)
    g.clip()
    this.text(g, { alpha: 0, stroke: 1 })
    g.restore()
    this.text(g, { alpha: fill })
  }

  // The finished frame shrinks into a video card and slides off; a parcel slides
  // back in, wiggles, pops its lid, and a heart floats out.
  drawShip(g, t) {
    const W = this.W, H = this.H, u = t % SHIP
    const fade = 1 - span(u, SHIP - .45, SHIP)
    g.globalAlpha = fade
    if (u < 2.2) this.card(g, span(u, .4, 1.2), span(u, 1.4, 2.1))
    else {
      const s = H * .4, x = W / 2 + (1 - pop((u - 2.3) / .8)) * W * .75, base = H * .9
      const wiggle = u > 3.2 && u < 3.7 ? Math.sin((u - 3.2) * 38) * (1 - (u - 3.2) / .5) * .06 : 0
      const lid = span(u, 3.75, 4.25)
      if (u > 4) this.heartOut(g, x, base - s * .7, s, u - 4)
      this.parcel(g, x, base, s, { wiggle, lid })
      if (u > 4.6) this.typeFor(g, u - 4.6)
    }
    g.globalAlpha = 1
    this.caption(u < 1.4 ? "rendering" : u < 2.3 ? "shipped" : "something’s coming back")
  }

  // "for <name>" types itself out above the heart, one letter at a time, with a blinking caret while it does.
  typeFor(g, t) {
    const full = `for ${this.name}`, shown = full.slice(0, Math.floor(t / .07))
    const size = Math.min(this.H * .13, this.W * .8 / Math.max(6, full.length * .5))
    g.save()
    g.font = `italic ${size}px 'Computer Modern Serif', 'Latin Modern Roman', Georgia, serif`
    g.textAlign = "left"; g.textBaseline = "middle"
    const x = this.W / 2 - g.measureText(full).width / 2, y = this.H * .14
    g.fillStyle = INK
    g.fillText(shown, x, y)
    if (shown.length < full.length || Math.floor(t * 2) % 2 === 0) {
      const cx = x + g.measureText(shown).width + size * .08
      g.fillRect(cx, y - size * .42, Math.max(1.5, size * .05), size * .84)
    }
    g.restore()
  }

  // The rendered frame as a video card: it shrinks, then slides off to the right.
  card(g, shrink, out) {
    const W = this.W, H = this.H, s = 1 - shrink * .55, a = g.globalAlpha
    g.save()
    g.translate(W / 2 + out * W * .8, H / 2)
    g.scale(s, s)
    g.globalAlpha = a * shrink
    g.fillStyle = "#121417"; g.strokeStyle = "#3a3e45"; g.lineWidth = 2 / s
    this.roundRect(g, -W / 2, -H / 2, W, H, 16 / s); g.fill(); g.stroke()
    this.text(g, { alpha: a })
    if (shrink > .9) {
      const bh = H * .14
      g.globalAlpha = a * (shrink - .9) * 10
      g.fillStyle = "rgba(14,15,17,.85)"
      this.roundRect(g, -W / 2 + W * .04, H / 2 - H * .06 - bh, W * .22, bh, bh / 2); g.fill()
      g.fillStyle = INK
      g.font = `${bh * .55}px 'Computer Modern Serif', Georgia, serif`
      g.textAlign = "center"; g.textBaseline = "middle"
      g.fillText(`▶ 0:${String(Math.max(1, Math.round(this.runTime))).padStart(2, "0")}`, -W / 2 + W * .15, H / 2 - H * .06 - bh / 2)
    }
    g.restore()
  }

  // A yellow gift box sitting on (x, y), s wide. `lid` lifts and tips the lid off.
  parcel(g, x, y, s, { wiggle = 0, lid = 0 }) {
    const bw = s, bh = s * .62, lw = s * 1.1, lh = s * .2
    g.save()
    g.translate(x, y)
    g.rotate(wiggle)
    // box
    g.fillStyle = YELLOW
    this.roundRect(g, -bw / 2, -bh, bw, bh, s * .05); g.fill()
    g.fillStyle = "rgba(0,0,0,.12)"
    g.fillRect(-bw / 2, -bh, bw, s * .05)
    g.fillStyle = "#c49a1c"
    g.fillRect(-s * .07, -bh, s * .14, bh)
    // lid: rises, drifts right, and tips over as it comes off
    g.save()
    g.translate(lid * s * .75, -bh - Math.sin(lid * Math.PI * .8) * s * .5)
    g.rotate(lid * .7)
    g.globalAlpha *= 1 - span(lid, .88, 1)
    g.fillStyle = "#f7dd6b"
    this.roundRect(g, -lw / 2, -lh, lw, lh, s * .05); g.fill()
    g.fillStyle = "#c49a1c"
    g.fillRect(-s * .07, -lh, s * .14, lh)
    // bow
    g.fillStyle = RED
    for (const d of [-1, 1]) {
      g.beginPath()
      g.ellipse(d * s * .12, -lh - s * .06, s * .12, s * .07, d * -.5, 0, Math.PI * 2)
      g.fill()
    }
    g.beginPath(); g.arc(0, -lh - s * .05, s * .045, 0, Math.PI * 2); g.fill()
    g.restore()
    g.restore()
  }

  // The heart pops out of the open box, floats up, then beats; a few sparkles twinkle round it.
  heartOut(g, x, y, s, t) {
    const grow = pop(t / .5), rise = span(t, 0, 1)
    const beat = t > 1 ? 1 + .08 * Math.max(0, Math.sin((t - 1) * 7)) ** 6 : 1
    const hy = y - rise * s * .55 + Math.sin(t * 2.4) * s * .015
    this.heart(g, x, hy, s * .5 * grow * beat)
    if (t > .8) {
      const tw = o => Math.max(0, Math.sin((t - .8) * 3 + o)) * clamp((t - .8) * 2)
      this.sparkle(g, x - s * .5, hy - s * .15, s * .09 * tw(0), YELLOW)
      this.sparkle(g, x + s * .48, hy - s * .25, s * .07 * tw(1.7), "#fff")
      this.sparkle(g, x + s * .38, hy + s * .2, s * .06 * tw(3.4), YELLOW)
    }
  }

  heart(g, x, y, size) {
    if (size <= 0) return
    g.save()
    g.translate(x, y)
    g.scale(size / 2, size / 2)
    g.beginPath()
    g.moveTo(0, .7)
    g.bezierCurveTo(-1.6, -.2, -.9, -1.3, 0, -.55)
    g.bezierCurveTo(.9, -1.3, 1.6, -.2, 0, .7)
    g.fillStyle = RED
    g.fill()
    g.beginPath()
    g.ellipse(-.42, -.52, .16, .1, -.6, 0, Math.PI * 2)
    g.fillStyle = "rgba(255,255,255,.55)"
    g.fill()
    g.restore()
  }

  // A soft four-pointed twinkle.
  sparkle(g, x, y, r, color) {
    if (r <= .2) return
    g.save()
    g.translate(x, y)
    g.fillStyle = color
    g.beginPath()
    g.moveTo(0, -r); g.quadraticCurveTo(0, 0, r, 0); g.quadraticCurveTo(0, 0, 0, r)
    g.quadraticCurveTo(0, 0, -r, 0); g.quadraticCurveTo(0, 0, 0, -r)
    g.fill()
    g.restore()
  }

  roundRect(g, x, y, w, h, r) {
    g.beginPath()
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
  }

  caption(text) {
    if (this.lastCaption === text) return
    this.lastCaption = text
    this.captionTarget.textContent = text
  }
}
