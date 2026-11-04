import { Controller } from "@hotwired/stimulus"

const VIEW_KEY = "manimator:view"
const VIEWS = ["home", "code", "buddy", "board", "examples"]

// The app shell: the rail switches between home and the editor's side panels.
export default class extends Controller {
  static targets = ["date", "nudge", "tab"]

  connect() {
    let view = "home"
    try { view = localStorage.getItem(VIEW_KEY) ?? view } catch { /* storage unavailable */ }
    this.set(VIEWS.includes(view) ? view : "home")
    const now = new Date()
    const day = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
    const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase()
    this.dateTargets.forEach(el => el.textContent = `${day} · ${date}`)
  }

  show({ params: { view } }) {
    if (view) this.set(view)
  }

  set(view) {
    this.element.dataset.view = view
    for (const el of this.element.querySelectorAll(".app__rail-item")) el.classList.toggle("app__rail-item--on", el.dataset.view === view)
    try { localStorage.setItem(VIEW_KEY, view) } catch { /* storage unavailable */ }
    this.dispatch("changed", { detail: { view } })
  }

  nudge() {
    this.nudgeTargets.forEach(el => { el.textContent = "nudged ✓"; el.disabled = true })
  }

  pickTab(e) {
    this.tabTargets.forEach(el => el.classList.toggle("board__tab--on", el === e.currentTarget))
  }
}
