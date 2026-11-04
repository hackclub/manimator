import { Controller } from "@hotwired/stimulus"
import { capture } from "analytics"
import { Mascot } from "mascot"

// Pledge-first onboarding: an idea (drawn for your math class, and nobody else's: Idea), the prize you're after, when you'll work on it, then a pledge you hold to
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
  idea: ["Hi, I’m π. Let’s find you something to animate.", "wave"],
  prize: ["Ship it and one of these is yours.", "thinking"],
  rhythm: ["When do you usually have time?", "speaking"],
  pledge: ["Sign it, and it’s official.", "happy"],
}
const PICKED_IDEA = idea => `${idea}. Good one.`
const TOOK_IDEA = "It’s yours. Nobody else gets this one."
const DREW_IDEA = "How about this?"
const OUT_OF_IDEAS = "That’s every idea for that class taken! Try another class, or write your own."
const IDEA_GONE = "Someone just took that idea, sorry! Here’s the idea step again."
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
    "name", "today", "hold", "holdFill", "holdLabel", "signed", "open", "bubble", "pi", "prize", "pledgePrize",
    "klass", "drawn", "drawnStandard", "drawnTitle", "drawnLine", "another"]
  static values = { poses: Object, whoamiUrl: String, editorUrl: String, drawUrl: String, claimUrl: String }

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

  // Your class, then an idea from it. Every "another" lets the last one go back in the pool, and skips the ones
  // you've already seen.
  pickClass({ params: { klass } }) {
    this.answers.klass = klass
    capture("onboarding_class_picked", { variant: "pledge", klass })
    this.drawIdea()
  }

  async drawIdea() {
    const seen = this.answers.seen ?? []
    if (this.answers.drawn) seen.push(this.answers.drawn.id)
    this.answers.seen = seen.slice(-50)
    this.anotherTarget.disabled = true
    try {
      const response = await this.post(this.drawUrlValue, { klass: this.answers.klass, except: this.answers.seen })
      this.answers.drawn = response.status === 200 ? await response.json() : null
      capture("onboarding_idea_drawn", { variant: "pledge", klass: this.answers.klass, idea: this.answers.drawn?.id, out: !this.answers.drawn })
      this.mascot.say(this.answers.drawn ? DREW_IDEA : OUT_OF_IDEAS, this.answers.drawn ? "speaking" : "erm")
    } catch {
      this.answers.drawn = null
    }
    this.anotherTarget.disabled = false
    this.render()
  }

  takeIdea() {
    const { id, title } = this.answers.drawn ?? {}
    if (id) this.answer("idea", { idea: title, ideaId: id, ownIdea: false }, TOOK_IDEA)
  }

  ownIdea() {
    const idea = this.ownTarget.value.trim()
    if (idea) this.answer("idea", { idea, ideaId: null, ownIdea: true }, PICKED_IDEA(idea))
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

  // Claims the drawn idea first: if someone took it while you were deciding, it's back to the idea step.
  async sign() {
    this.holding = false
    if (this.answers.ideaId && !(await this.claimIdea())) {
      Object.assign(this.answers, { step: 0, open: 0, idea: null, ideaId: null, drawn: null })
      this.progress = 0
      this.holdFillTarget.style.transform = "scaleX(0)"
      this.render()
      return this.mascot.say(IDEA_GONE, "erm")
    }
    this.answers.signed = new Date().toISOString()
    capture("onboarding_pledge_signed", { variant: "pledge", ...this.answers })
    save(localStorage, CODE_KEY, starter(this.answers.idea))
    save(localStorage, VIEW_KEY, "code")
    this.render()
    this.mascot.say(`It’s official${this.answers.name ? `, ${this.answers.name}` : ""}! Let’s make the first frame move.`, "hooray")
    this.mascot.dance()
  }

  async claimIdea() {
    try {
      const response = await this.post(this.claimUrlValue.replace("ID", this.answers.ideaId))
      return response.ok
    } catch { return true /* offline: the hold keeps it a while, and the pledge is still theirs */ }
  }

  post(url, body = {}) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": document.querySelector("meta[name=csrf-token]")?.content },
      body: JSON.stringify(body),
    })
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

    this.klassTargets.forEach(el => el.setAttribute("aria-pressed", el.dataset.pledgeKlassParam === a.klass))
    this.drawnTarget.hidden = !a.drawn
    if (a.drawn) {
      this.drawnTitleTarget.textContent = a.drawn.title
      this.drawnLineTarget.textContent = a.drawn.line
      this.drawnStandardTarget.textContent = [a.drawn.standard, a.drawn.topic].filter(Boolean).join(" · ")
    }
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
