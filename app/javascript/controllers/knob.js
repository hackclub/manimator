import { Controller } from "@hotwired/stimulus"

const NS = "http://www.w3.org/2000/svg"

export const C = {
  blue: "#58C4DD", yellow: "#F4D345", green: "#83C167", red: "#FC6255",
  purple: "#9A72AC", teal: "#5CD0B3", ink: "#ece9e2", faint: "#80868e", line: "#3a3e45"
}
export const SERIF = "Computer Modern Serif, Georgia, serif"

export const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// 2 decimals with a real minus sign, and no "−0.00".
export const fmt = (x, d = 2) => (Math.abs(x) < .5 * 10 ** -d ? 0 : x).toFixed(d).replace("-", "−")

export function set(node, attrs) {
  for (const k in attrs) node.setAttribute(k, attrs[k])
  return node
}

export function el(parent, tag, attrs = {}, text) {
  const node = set(document.createElementNS(NS, tag), attrs)
  if (text != null) node.textContent = text
  parent.append(node)
  return node
}

// Stroke attributes the sketch controller's draw-on expects.
export const drawn = { "pathLength": 1, "stroke-dasharray": 1 }

// Shared plumbing for the playable example cards: one draggable handle per card,
// driven by pointer, touch or arrow keys. A subclass implements:
//   build()        draw the scene into this.layer and call this.knob(label)
//   drag(p)        set state from a point in viewBox units
//   nudge(dx, dy)  step state for arrow keys (Home/End pass ±99, so clamp)
//   render()       redraw from state, place the knob and call this.aria(...)
export default class extends Controller {
  connect() {
    this.svg = this.element.querySelector("svg")
    this.svg.querySelector(".live")?.remove()
    this.layer = el(this.svg, "g", { class: "live" })
    this.build()
    this.render()
    this.demoTimers = []
    // Show that the handle moves: a few steps out and back once the card has drawn itself in,
    // and again when you hover a card you haven't touched yet.
    this.observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      this.observer.disconnect()
      this.demoTimers.push(setTimeout(() => this.demo(), 1700))
    }, { threshold: .6 })
    this.observer.observe(this.element)
    this.onHover = () => this.demoTimers.push(setTimeout(() => this.demo(), 900))
    this.element.addEventListener("mouseenter", this.onHover)
  }

  disconnect() {
    this.layer?.remove()
    this.observer?.disconnect()
    this.element.removeEventListener("mouseenter", this.onHover)
    this.demoTimers.forEach(clearTimeout)
  }

  // Steps the real state up to three times one way and back the same number, like someone nudging it,
  // so it ends where it began. At the top of its range it goes the other way.
  demo() {
    if (calm() || this.demoing || "touched" in this.element.dataset) return
    if (performance.now() - (this.lastDemo ?? -Infinity) < 4000) return
    this.demoing = true
    this.element.dataset.demo = ""
    const value = () => this.handle.getAttribute("aria-valuenow")
    let dir = 1, moved = 0, back = 0
    const step = () => {
      if ("touched" in this.element.dataset) return this.endDemo()
      if (moved < 3 && back === 0) {
        const before = value()
        this.nudge(dir, 0); this.render()
        if (value() !== before) moved++
        else if (moved === 0 && dir === 1) dir = -1
        else back = moved || -1
      } else if (back > 0) {
        this.nudge(-dir, 0); this.render()
        if (--back === 0) return this.endDemo()
      } else return this.endDemo()
      if (moved === 3 && back === 0) back = 3
      this.demoTimers.push(setTimeout(step, 160))
    }
    step()
  }

  endDemo() {
    this.demoing = false
    this.lastDemo = performance.now()
    delete this.element.dataset.demo
  }

  // A yellow dot with a halo, inside a much larger invisible hit area.
  knob(label) {
    const g = this.handle = el(this.layer, "g", { class: "knob", tabindex: 0, role: "slider", "aria-label": label, "data-d": "o" })
    el(g, "circle", { class: "knob__hit", r: 25 })
    el(g, "circle", { class: "knob__pulse", r: 10 })
    el(g, "circle", { class: "knob__ring", r: 10 })
    el(g, "circle", { class: "knob__dot", r: 5 })
    g.addEventListener("pointerdown", e => this.down(e))
    g.addEventListener("pointermove", e => this.move(e))
    ;["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => g.addEventListener(ev, () => this.release()))
    g.addEventListener("keydown", e => this.key(e))
    // iOS can ignore touch-action on SVG, so block the scroll at the source too
    g.addEventListener("touchstart", e => e.preventDefault(), { passive: false })
    return g
  }

  place(x, y) { this.handle.setAttribute("transform", `translate(${x},${y})`) }

  aria(now, min, max, text) {
    set(this.handle, { "aria-valuenow": now, "aria-valuemin": min, "aria-valuemax": max, "aria-valuetext": text })
  }

  down(e) {
    if (e.button !== 0) return
    e.preventDefault()
    this.handle.focus({ preventScroll: true })
    this.pointer = e.pointerId
    this.handle.setPointerCapture(e.pointerId)
    this.element.dataset.dragging = ""
    this.start()
    this.follow(e)
  }

  move(e) { if (e.pointerId === this.pointer) this.follow(e) }

  release() {
    this.pointer = null
    delete this.element.dataset.dragging
  }

  follow(e) {
    this.drag(new DOMPoint(e.clientX, e.clientY).matrixTransform(this.svg.getScreenCTM().inverse()))
    this.render()
  }

  key(e) {
    const step = { ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowLeft: [-1, 0], ArrowDown: [0, -1], Home: [-99, -99], End: [99, 99] }[e.key]
    if (!step) return
    e.preventDefault()
    this.start()
    this.nudge(...step)
    this.render()
  }

  // The first touch stops the draw-on replay for good, so it never fights a drag.
  start() {
    if ("touched" in this.element.dataset) return
    this.element.dataset.touched = ""
    this.svg.getAnimations({ subtree: true }).forEach(a => a.cancel())
  }

  // A quick manim-style Create for something that just appeared.
  pop(node) {
    if (calm() || !("touched" in this.element.dataset)) return
    node.animate([{ strokeDashoffset: 1, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: node.getAttribute("fill-opacity") ?? 1 }], { duration: 320, easing: "cubic-bezier(.45,0,.2,1)" })
  }
}
