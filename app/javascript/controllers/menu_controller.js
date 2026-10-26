import { Controller } from "@hotwired/stimulus"

// Full-screen nav shown behind the "menu" button on narrow screens.
export default class extends Controller {
  static targets = ["panel", "toggle"]

  open() { this.toggle(true) }
  close() { this.toggle(false) }

  disconnect() { this.toggle(false) }

  toggle(open) {
    if (!this.hasPanelTarget) return
    this.panelTarget.hidden = !open
    document.documentElement.classList.toggle("menu-open", open)
    if (this.hasToggleTarget) this.toggleTarget.setAttribute("aria-expanded", String(open))
  }
}
