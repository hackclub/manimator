import { Controller } from "@hotwired/stimulus"

// How often the editor beats, and how long after your last key, pointer or scroll it stops
const EVERY = 30_000
const IDLE_AFTER = 120_000
const SIGNS = ["keydown", "pointermove", "pointerdown", "wheel", "scroll"]

// Counts your time in the editor. While the tab's showing and you've typed, moved the pointer or scrolled in the last
// two minutes, it tells the server you're still here every 30 seconds; the server does the counting
// (HeartbeatsController). Whatever comes back (today's seconds, the goal, your streak) goes out on window as
// heartbeat:tick, for anything that shows it.
export default class extends Controller {
  static values = { url: { type: String, default: "/heartbeat" } }

  connect() {
    this.activeAt = 0
    this.noteActivity = () => { this.activeAt = Date.now() }
    // Capturing, so a scroll inside a panel or a key the editor swallows still counts
    SIGNS.forEach(sign => window.addEventListener(sign, this.noteActivity, { capture: true, passive: true }))
    this.timer = setInterval(() => this.beat(), EVERY)
    this.ask()
  }

  disconnect() {
    clearInterval(this.timer)
    SIGNS.forEach(sign => window.removeEventListener(sign, this.noteActivity, { capture: true }))
  }

  get working() {
    return document.visibilityState === "visible" && Date.now() - this.activeAt < IDLE_AFTER
  }

  get timezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "" } catch { return "" }
  }

  // Where you stand, without counting anything
  ask() {
    return this.tick(fetch(`${this.urlValue}?timezone=${encodeURIComponent(this.timezone)}`, { headers: { Accept: "application/json" } }))
  }

  beat() {
    if (!this.working) return
    return this.tick(fetch(this.urlValue, {
      method: "POST", body: JSON.stringify({ timezone: this.timezone }),
      headers: { "Content-Type": "application/json", Accept: "application/json",
        "X-CSRF-Token": document.querySelector("meta[name=csrf-token]")?.content },
    }))
  }

  // A beat that doesn't get through is just a missed beat: the next one makes up for it
  async tick(request) {
    try {
      const response = await request
      if (!response.ok) return
      window.dispatchEvent(new CustomEvent("heartbeat:tick", { detail: await response.json() }))
    } catch {}
  }
}
