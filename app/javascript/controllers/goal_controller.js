import { Controller } from "@hotwired/stimulus"
import { capture } from "analytics"
import { Mascot } from "mascot"
import { Renderer } from "editor/renderer"

// Today's goal, and what meeting it gets you. It's all driven by heartbeat:tick (heartbeat_controller), which says
// how long you've worked today, the goal, your streak and your time in all.
//
// The goal is one full turn. An arc around π in the bar grows from 0 to 2π, the way angles go (from the right,
// counterclockwise), and reads out θ as it does. The moment it closes while you're here, π says so once ("Day 1 ✓"),
// the frame on the stage is saved as the scene's picture (Scene#frame) and shown as a postcard in pencil, and on
// your first day ∞ asks when you'll sit down next (Pledge#next_session_at, which π messages you at). An hour in, all
// told, the postcard is made: the pencil turns to colour and it's stamped.
const DONE_KEY = "manimator:goal" // the day π last said you'd met the goal
const MADE_KEY = "manimator:postcard" // "made" once π's said the postcard is made
const SNAP_EVERY = 60_000
const WIDTH = 960
const MAX_FRAME = 380_000 // characters of data URL; the server takes 400 KB

const read = key => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key, value) => { try { localStorage.setItem(key, value) } catch { /* storage unavailable */ } }
const today = () => new Date().toDateString()
const minutes = seconds => Math.floor(seconds / 60)

// 0.25 of a turn is "0.5π"; a half is "π"; all of it is "2π".
function theta(turn) {
  const halves = Math.round(turn * 20) / 10
  return halves === 0 ? "0" : `${halves === 1 ? "" : halves}π`
}

// "7pm", "3:30pm"
function clock(date) {
  const h = date.getHours(), m = date.getMinutes()
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`
}

export default class extends Controller {
  static targets = ["dial", "arc", "hand", "minutes", "theta", "shade", "card", "pi", "bubble", "postcard", "picture",
    "caption", "next", "question", "times", "signIn"]
  static values = { poses: Object, scenesUrl: String, pledgeUrl: String, slot: String, frame: String, signedIn: Boolean }

  connect() {
    this.last = null // the tick before this one
    this.met = false // today's goal has been met, now or before the page opened
    this.snappedAt = 0
    this.picture = null // the frame as last snapped here, a data URL
  }

  disconnect() {
    this.mascot?.stop()
    clearTimeout(this.inking)
  }

  get editor() {
    return this.application.getControllerForElementAndIdentifier(this.element.closest(".app"), "editor")
  }

  // Where you stand, every half minute you're working and once when the page opens.
  tick({ detail }) {
    const was = this.last
    this.last = detail
    this.met ||= detail.completed
    this.draw(detail)

    const made = detail.total_seconds >= detail.postcard_seconds
    const justMet = was && !was.completed && detail.completed && read(DONE_KEY) !== today()
    const justMade = was && was.total_seconds < was.postcard_seconds && made && read(MADE_KEY) !== "made"
    if (justMet) this.celebrate(detail, made)
    else if (justMade) this.celebrate(detail, true, { hour: true })
  }

  draw({ today_seconds, goal_seconds, completed }) {
    const turn = completed ? 1 : Math.min(today_seconds / goal_seconds, 1)
    this.arcTarget.style.strokeDasharray = `${turn} 1`
    this.handTarget.style.transform = `rotate(${-turn * 360}deg)`
    this.element.classList.toggle("goal--met", completed)
    this.minutesTarget.textContent = completed ? `${minutes(today_seconds)} min today` : `${minutes(today_seconds)} of ${minutes(goal_seconds)} min`
    this.thetaTarget.textContent = `θ = ${theta(turn)}${completed ? " ✓" : ""}`
    this.dialTarget.title = completed ? "Full turn. Today’s goal is met."
      : `Today’s goal is one full turn: ${minutes(goal_seconds)} minutes in the editor.`
  }

  // The goal's met (or the hour's up): π says so, with your frame as the postcard.
  celebrate(tick, made, { hour = false } = {}) {
    if (!hour) write(DONE_KEY, today())
    const firstMade = made && read(MADE_KEY) !== "made"
    if (made) write(MADE_KEY, "made")

    this.snap({ force: true })
    this.showPicture(this.picture || this.frameValue)
    // Just made: it opens in pencil and the colour comes in. Made a while ago: it's in colour already.
    this.postcardTarget.classList.toggle("goal__postcard--made", made && !firstMade)
    if (firstMade) this.inking = setTimeout(() => this.postcardTarget.classList.add("goal__postcard--made"), 900)
    const left = Math.max(1, Math.ceil((tick.postcard_seconds - tick.total_seconds) / 60))
    this.captionTarget.textContent = made
      ? "Your postcard is made. It’s mailed free with whatever prize you earn. On its own, it’s your prize for one video."
      : `Your frame, in pencil for now. At one hour it’s made into your postcard: ${left} ${left === 1 ? "minute" : "minutes"} to go.`

    const asking = !hour && tick.first_day && this.hasNextTarget && this.slotValue
    if (this.hasNextTarget) this.nextTarget.hidden = !asking
    if (asking) this.offerTimes()

    this.shadeTarget.hidden = false
    this.mascot ||= new Mascot(this.piTarget, this.bubbleTarget, this.posesValue)
    this.mascot.say(hour ? "One hour in. That’s a postcard!" : this.cheer(tick), "hooray")
    this.mascot.dance()
    this.dialTarget.classList.add("goal__dial--pop")
    capture(hour ? "editor_postcard_made" : "editor_goal_met", { first_day: tick.first_day, streak: tick.streak, asked_next: !!asking })
  }

  cheer({ first_day, streak }) {
    if (first_day) return "Day 1 ✓ That’s a full turn, and your streak has started."
    return streak > 1 ? `${streak}-day streak ✓ Today’s turn is closed.` : "Today ✓ A new streak starts here."
  }

  close() {
    if (this.shadeTarget.hidden) return
    this.shadeTarget.hidden = true
    this.dialTarget.classList.remove("goal__dial--pop")
    this.mascot?.stop()
  }

  closeOutside(event) {
    if (event.target === this.shadeTarget) this.close()
  }

  // The picture of your scene
  // ---------------------------------------------------------------------------

  // Once the goal's been met, each save of the scene takes its picture again, a minute apart at most.
  saved() {
    if (this.met || this.frameValue) this.snap()
  }

  // Draws the frame you're on (or one from the middle, at the very start) onto a canvas of its own, 960 across
  // whatever size the stage is, and saves it as the scene's frame.
  snap({ force = false } = {}) {
    const editor = this.editor, store = editor?.store
    if (!store?.length || (!force && Date.now() - this.snappedAt < SNAP_EVERY)) return
    try {
      const canvas = document.createElement("canvas"), renderer = new Renderer(canvas)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      renderer.resize(WIDTH / dpr, (WIDTH * 9) / 16 / dpr)
      const frame = store.frames[editor.frame || Math.floor(store.length * 0.45)] ?? store.frames[store.length - 1]
      renderer.draw(frame, store.strings, store.background, { hoverLine: null, cursorLine: null })
      // Line drawings come out small; a busy frame gets squeezed harder until it fits
      let url
      for (const quality of [.82, .6, .4]) {
        url = canvas.toDataURL("image/jpeg", quality)
        if (url.length <= MAX_FRAME) break
      }
      if (url.length > MAX_FRAME || !url.startsWith("data:image/jpeg")) return
      this.picture = url
      this.snappedAt = Date.now()
      if (!this.shadeTarget.hidden) this.showPicture(url)
      // A scene that's never been saved has nowhere to keep it yet: its first save comes back through saved()
      if (editor.scene?.id) this.send(`${this.scenesUrlValue}/${editor.scene.id}`, { scene: { frame: url } }).catch(() => { this.snappedAt = 0 })
      else this.snappedAt = 0
    } catch { /* no picture this time */ }
  }

  showPicture(url) {
    this.pictureTarget.hidden = !url
    if (url) this.pictureTarget.src = url
  }

  // Your next sit-down
  // ---------------------------------------------------------------------------

  // Tomorrow, the day after, and the weekend if that's neither, each at the time of day you pledged.
  offerTimes() {
    const [hour, minute] = this.slotValue.split(":").map(Number)
    const at = days => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, minute, 0, 0); return d }
    const day = date => date.toLocaleDateString("en-US", { weekday: "long" })
    const saturday = (6 - new Date().getDay() + 7) % 7
    const weekend = [saturday, saturday + 1].find(days => days > 2 && days < 7)
    const times = [["Tomorrow", at(1)], [day(at(2)), at(2)], ...(weekend ? [[day(at(weekend)), at(weekend)]] : [])]
    this.timesTarget.replaceChildren(...times.map(([name, date]) => {
      const button = document.createElement("button")
      button.className = "goal__time"
      button.textContent = `${name} at ${clock(date)}`
      button.addEventListener("click", () => this.book(button, date))
      return button
    }))
  }

  async book(button, date) {
    const buttons = [...this.timesTarget.children]
    buttons.forEach(b => { b.disabled = true })
    try {
      await this.send(this.pledgeUrlValue, { pledge: { next_session_at: date.toISOString() } })
      this.questionTarget.textContent = `${button.textContent} it is. ${this.signedInValue ? "π will message you then."
        : "Sign in so π knows where to message you."}`
      this.timesTarget.hidden = true
      if (this.hasSignInTarget) this.signInTarget.hidden = false
      capture("editor_next_session_booked", { days_out: Math.round((date - Date.now()) / 86_400_000) })
    } catch {
      buttons.forEach(b => { b.disabled = false })
      this.questionTarget.textContent = "That didn’t save. Try once more?"
    }
  }

  async send(url, body) {
    const response = await fetch(url, {
      method: "PATCH", body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", Accept: "application/json",
        "X-CSRF-Token": document.querySelector("meta[name=csrf-token]")?.content },
    })
    if (!response.ok) throw new Error(`${url}: ${response.status}`)
  }
}
