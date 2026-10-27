import { Controller } from "@hotwired/stimulus"

// Dev-only: flips where the hero shows the start date, and keeps the pick in ?date= so it survives reloads.
export default class extends Controller {
  static targets = ["option"]

  connect() {
    this.hero = document.getElementById("hero")
    this.show(new URLSearchParams(location.search).get("date") || this.hero.dataset.dateVariant)
  }

  pick(event) {
    const variant = event.currentTarget.dataset.variant
    const url = new URL(location.href)
    url.searchParams.set("date", variant)
    history.replaceState(null, "", url)
    this.show(variant)
  }

  show(variant) {
    this.hero.dataset.dateVariant = variant
    this.optionTargets.forEach(b => b.setAttribute("aria-pressed", b.dataset.variant === variant))
  }
}
