import { Controller } from "@hotwired/stimulus"

// The "there's more below" cue at the bottom of the hero; it fades once you start scrolling.
export default class extends Controller {
  connect() {
    this.update = () => this.element.classList.toggle("is-gone", window.scrollY > 40)
    window.addEventListener("scroll", this.update, { passive: true })
    this.update()
  }

  disconnect() { window.removeEventListener("scroll", this.update) }
}
