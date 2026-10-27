import { Controller } from "@hotwired/stimulus"

const EASE = "cubic-bezier(.45,0,.2,1)"

// Example cards draw themselves the way manim's Create / Write would.
// Each SVG element is tagged with data-d:
//   s  = stroke draws on       sf = stroke, then fill fades in
//   t  = text outline, then fill    o  = fades in
export default class extends Controller {
  static targets = ["card"]

  connect() {
    this.observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      this.observer.disconnect()
      this.cardTargets.forEach((card, i) => setTimeout(() => this.draw(card), i * 180))
    }, { threshold: .25 })
    this.observer.observe(this.element)
  }

  disconnect() { this.observer?.disconnect() }

  replay(event) { this.draw(event.currentTarget) }

  draw(card) {
    // Leave a card alone once someone has played with it, and skip the show for reduced motion.
    if ("touched" in card.dataset || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    card.querySelectorAll("[data-d]").forEach((el, i) => {
      const kind = el.dataset.d, o = { duration: 900, delay: i * 110, easing: EASE, fill: "both" }
      if (kind === "s") el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], o)
      else if (kind === "sf") el.animate([{ strokeDashoffset: 1, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: 0, offset: .6 }, { strokeDashoffset: 0, fillOpacity: .3 }], o)
      else if (kind === "t") el.animate([{ strokeDashoffset: 600, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: 0, offset: .7 }, { strokeDashoffset: 0, fillOpacity: 1 }], { ...o, duration: 1700 })
      else el.animate([{ opacity: 0 }, { opacity: 1 }], { ...o, duration: 500, delay: 300 + i * 90 })
    })
  }
}
