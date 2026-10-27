import { Controller } from "@hotwired/stimulus"

// A heading that writes itself in when it scrolls into view, like manim's Write():
// the outline is traced left to right, then the fill comes in.
export default class extends Controller {
  connect() {
    this.element.classList.add("write")
    this.observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      this.observer.disconnect()
      this.element.classList.add("is-written")
    }, { threshold: .4 })
    // Watch the parent: the heading itself is fully clipped until it writes in, and
    // IntersectionObserver treats a clipped element as never visible.
    this.observer.observe(this.element.parentElement)
  }

  disconnect() { this.observer?.disconnect() }
}
