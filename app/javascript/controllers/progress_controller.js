import { Controller } from "@hotwired/stimulus"

// How far down the page you are, drawn along the top edge.
export default class extends Controller {
  static targets = ["fill"]

  connect() {
    this.update = () => {
      if (this.raf) return
      this.raf = requestAnimationFrame(() => {
        this.raf = null
        const max = document.documentElement.scrollHeight - window.innerHeight
        const f = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
        this.fillTarget.style.transform = `scaleX(${f})`
      })
    }
    window.addEventListener("scroll", this.update, { passive: true })
    window.addEventListener("resize", this.update)
    this.update()
  }

  disconnect() {
    window.removeEventListener("scroll", this.update)
    window.removeEventListener("resize", this.update)
    cancelAnimationFrame(this.raf)
  }
}
