import { Controller } from "@hotwired/stimulus"
import { capture } from "analytics"
import { Mascot } from "mascot"

// Pledge-first onboarding: an idea, the prize you're after, when you'll work on it, then a pledge you hold to
// sign. Answers live in this tab (sessionStorage), so a refresh or a trip to sign in doesn't lose them.
const ANSWERS_KEY = "manimator:onboarding"
const CODE_KEY = "manimator:code"
const VIEW_KEY = "manimator:view"
const PICK_DELAY = 360
const HOLD_MS = 1300
const REWIND_MS = 350
const TAP_MS = 260
const STEPS = ["idea", "prize", "rhythm", "pledge"]

const LINES = {
  idea: ["Hi, I’m π. What do you want to animate?", "wave"],
  prize: ["Ship it and one of these is yours.", "thinking"],
  rhythm: ["When do you usually have time?", "speaking"],
  pledge: ["Sign it, and it’s official.", "happy"],
}
const PICKED_IDEA = idea => `${idea}. Good one.`
const PICKED_PRIZE = (name, hours) => `Nice pick! The ${name} is about ${hours} hours of animating.`

function load(storage, key) {
  try { return JSON.parse(storage.getItem(key)) ?? {} } catch { return {} }
}

function save(storage, key, value) {
  try { storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)) } catch { /* storage unavailable */ }
}

function rhythm({ when, days }) {
  const often = days === 7 ? "every day" : `${days} days a week`
  return when === "weekends" ? "on weekends" : `${often}, ${when === "evening" ? "in the evening" : when}`
}

// The first scene for an idea: the idea itself, written on screen.
function starter(idea) {
  return `from manim import *


class MyScene(Scene):
    def construct(self):
        title = Text(${JSON.stringify(idea)}, font_size=48)
        self.play(Write(title))
        self.wait()
`
}

export default class extends Controller {
  static targets = ["step", "value", "dot", "own", "ownSubmit", "when", "days", "rhythmNext", "pledgeIdea", "pledgeRhythm",
    "name", "today", "hold", "holdFill", "holdLabel", "signed", "open", "bubble", "pi", "prize", "pledgePrize"]
  static values = { poses: Object, whoamiUrl: String, editorUrl: String }

  connect() {
    this.answers = { step: 0, ...load(sessionStorage, ANSWERS_KEY) }
    this.mascot = new Mascot(this.piTarget, this.bubbleTarget, this.posesValue)
    this.progress = 0
    this.todayTarget.textContent = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase()
    this.ownTarget.addEventListener("input", () => { this.ownSubmitTarget.disabled = !this.ownTarget.value.trim() })
    if (this.answers.name) this.nameTarget.value = this.answers.name
    this.render()
    this.greet()
    this.askWhoami()
  }

  disconnect() {
    clearTimeout(this.pickTimer)
    cancelAnimationFrame(this.raf)
    this.mascot.stop()
  }

  // Answering

  pickIdea({ params: { idea } }) { this.answer("idea", { idea }, PICKED_IDEA(idea)) }

  ownIdea() {
    const idea = this.ownTarget.value.trim()
    if (idea) this.answer("idea", { idea, ownIdea: true }, PICKED_IDEA(idea))
  }

  pickPrize({ params: { id, name, hours } }) {
    this.answer("prize", { prize: id, prizeName: name, prizeHours: hours }, PICKED_PRIZE(name, hours))
  }

  pickWhen({ params: { when } }) { this.answers.when = when; this.render() }
  pickDays({ params: { days } }) { this.answers.days = days; this.render() }
  rhythmDone() { this.answer("rhythm", {}, `${rhythm(this.answers)}. I’ll hold you to that.`) }

  answer(step, values, reply) {
    Object.assign(this.answers, values)
    const index = STEPS.indexOf(step)
    this.answers.step = Math.max(this.answers.step, index + 1)
    this.answers.open = null
    capture("onboarding_step_answered", { variant: "pledge", step, ...values })
    this.mascot.say(reply, "happy")
    this.render()
    clearTimeout(this.pickTimer)
    this.pickTimer = setTimeout(() => this.greet(), PICK_DELAY * 4)
  }

  reopen({ params: { step } }) {
    if (this.answers.signed) return
    this.answers.open = step
    this.render()
    this.greet()
  }

  named() {
    this.answers.name = this.nameTarget.value.trim()
    this.render()
  }

  // Holding to sign: it fills over HOLD_MS and signs when full; let go early and it runs back.

  holdStart(event) {
    if (this.holdTarget.disabled || this.answers.signed) return
    event.preventDefault?.()
    this.holding = true
    this.pressedAt = performance.now()
    this.animate()
  }

  holdEnd() {
    if (!this.holding) return
    this.holding = false
    if (performance.now() - this.pressedAt < TAP_MS) this.holdLabelTarget.textContent = "Keep holding…"
  }

  holdKey(event) {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) this.holdStart(event)
  }

  holdKeyUp(event) {
    if (event.key === " " || event.key === "Enter") this.holdEnd()
  }

  animate() {
    cancelAnimationFrame(this.raf)
    let last = performance.now()
    const step = now => {
      const dt = now - last
      last = now
      this.progress = Math.min(1, Math.max(0, this.progress + (this.holding ? dt / HOLD_MS : -dt / REWIND_MS)))
      this.holdFillTarget.style.transform = `scaleX(${this.progress})`
      if (this.progress >= 1) return this.sign()
      if (this.holding || this.progress > 0) this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }

  sign() {
    this.holding = false
    this.answers.signed = new Date().toISOString()
    capture("onboarding_pledge_signed", { variant: "pledge", ...this.answers })
    save(localStorage, CODE_KEY, starter(this.answers.idea))
    save(localStorage, VIEW_KEY, "code")
    this.render()
    this.mascot.say(`It’s official${this.answers.name ? `, ${this.answers.name}` : ""}! Let’s make the first frame move.`, "hooray")
    this.mascot.dance()
  }

  open() {
    capture("onboarding_finished", { variant: "pledge" })
    sessionStorage.removeItem(ANSWERS_KEY)
  }

  abandoned() {
    if (!this.answers.signed) capture("onboarding_abandoned", { variant: "pledge", step: STEPS[this.current] })
  }

  // Drawing

  get current() {
    return this.answers.open ?? Math.min(this.answers.step, STEPS.length - 1)
  }

  greet() {
    if (this.answers.signed) return this.mascot.say("Your editor’s ready.", "happy")
    const [line, pose] = LINES[STEPS[this.current]]
    if (pose === "wave") { this.mascot.say(line, "plain"); this.mascot.wave("speaking") }
    else this.mascot.say(line, pose)
    capture("onboarding_step_viewed", { variant: "pledge", step: STEPS[this.current] })
  }

  render() {
    const a = this.answers
    save(sessionStorage, ANSWERS_KEY, a)
    const current = this.current
    this.stepTargets.forEach((el, i) => {
      el.dataset.state = i === current ? "open" : i < a.step ? "done" : "todo"
    })
    this.dotTargets.forEach((el, i) => el.classList.toggle("onboard__dot--on", i < a.step || (i === 3 && !!a.signed)))
    const values = [a.idea, a.prizeName, a.step > 2 && rhythm(a)]
    this.valueTargets.forEach((el, i) => { el.textContent = values[i] || "" })

    this.whenTargets.forEach(el => el.setAttribute("aria-pressed", el.dataset.pledgeWhenParam === a.when))
    this.daysTargets.forEach(el => el.setAttribute("aria-pressed", Number(el.dataset.pledgeDaysParam) === a.days))
    this.rhythmNextTarget.disabled = !(a.when && (a.days || a.when === "weekends"))
    this.daysTargets.forEach(el => { el.disabled = a.when === "weekends" })

    this.prizeTargets.forEach(el => el.setAttribute("aria-pressed", el.dataset.prize === a.prize))
    this.pledgeIdeaTarget.textContent = a.idea || "something"
    this.pledgePrizeTarget.textContent = a.prizeName || "prize"
    this.pledgeRhythmTarget.textContent = a.when ? rhythm(a) : ""
    this.holdTarget.disabled = !a.name || !!a.signed
    if (!a.signed) this.holdLabelTarget.textContent = a.name ? "Hold to sign" : "Write your name first"
    this.holdTarget.hidden = !!a.signed
    this.nameTarget.disabled = !!a.signed
    this.signedTarget.hidden = !a.signed
  }

  // The first name of whoever's signed in to Hack Club Auth, to sign with.
  async askWhoami() {
    if (!this.whoamiUrlValue || this.nameTarget.value) return
    try {
      const response = await fetch(this.whoamiUrlValue, { credentials: "include" })
      if (!response.ok) return
      const { signed_in: signedIn, first_name: firstName } = await response.json()
      const name = signedIn && (firstName || "").trim().slice(0, 40)
      if (name && !this.nameTarget.value) { this.nameTarget.value = name; this.named() }
    } catch { /* not signed in there, or it's down: they type it */ }
  }
}
