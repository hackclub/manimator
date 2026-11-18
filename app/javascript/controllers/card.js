import { Controller } from "@hotwired/stimulus"

const NS = "http://www.w3.org/2000/svg"

export const C = {
  blue: "#58C4DD", yellow: "#F4D345", green: "#83C167", red: "#FC6255",
  purple: "#9A72AC", teal: "#5CD0B3", ink: "#ece9e2", faint: "#80868e", line: "#3a3e45"
}
export const SERIF = "Computer Modern Serif, Georgia, serif"

export const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
// 0 until p reaches a, 1 once it passes b, a straight line between.
export const ramp = (p, a, b) => clamp((p - a) / (b - a))

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

// The frame shown to people who've asked for reduced motion: far enough along that the idea has landed.
const REST = .65

// Shared plumbing for the example cards. Each card is a scene that moves with the page's scrolling and
// only then: a scene is a function of where its card sits in the window, so it stops when the scrolling does.
// A subclass implements:
//   build()   create the scene's elements in this.layer
//   draw(p)   set them for p, which is 0 as the card's top edge meets the bottom of the window and 1 as its
//             bottom edge leaves the top; the card is centered at .5
export default class extends Controller {
  connect() {
    this.svg = this.element.querySelector("svg")
    this.svg.querySelector(".live")?.remove()
    this.layer = el(this.svg, "g", { class: "live" })
    this.build()
    this.sync()
    if (calm()) return

    this.visible = false
    this.seen = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.sync() })
    this.seen.observe(this.element)
    this.onScroll = () => {
      if (!this.visible || this.queued) return
      this.queued = true
      this.raf = requestAnimationFrame(() => { this.queued = false; this.sync() })
    }
    addEventListener("scroll", this.onScroll, { passive: true })
    addEventListener("resize", this.onScroll)
  }

  disconnect() {
    removeEventListener("scroll", this.onScroll)
    removeEventListener("resize", this.onScroll)
    cancelAnimationFrame(this.raf)
    this.seen?.disconnect()
    this.layer?.remove()
  }

  sync() { this.draw(calm() ? REST : this.progress()) }

  progress() {
    const r = this.element.getBoundingClientRect()
    return clamp((innerHeight - r.top) / (innerHeight + r.height))
  }
}
