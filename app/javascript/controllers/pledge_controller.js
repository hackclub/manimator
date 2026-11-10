import { Controller } from "@hotwired/stimulus"
import { capture } from "analytics"
import { Mascot } from "mascot"

// Onboarding (onboarding/pledge.html.erb): an idea and who it's for, the prize you're after, when and how
// long you'll work on it, then a pledge you hold to sign. Answers live in this tab (sessionStorage), so a refresh or
// a trip to sign in doesn't lose them; signing keeps them on the server too (Pledge), for nudges.
const ANSWERS_KEY = "manimator:onboarding"
const CODE_KEY = "manimator:code"
const VIEW_KEY = "manimator:view"
const PICK_DELAY = 360
const HOLD_MS = 1300
const REWIND_MS = 350
const TAP_MS = 260
const STAGE_WIDTH = 1360
const STEPS = ["idea", "prize", "rhythm", "pledge"]

const LINES = {
  idea: ["Hi, I’m π! I’ll help you make your first animation.", "wave"],
  who: ["That’s your first frame. Who’s it for?", "awe"],
  prize: ["Pick one to work toward.", "thinking"],
  rhythm: ["When do you usually have time?", "speaking"],
  pledge: ["Sign it, and it’s official.", "happy"],
}
const TOOK_IDEA = "It’s yours. Nobody else gets this one."
const DREW_IDEA = "Here are three. Any of them grab you?"
const OUT_OF_IDEAS = "That’s every idea for that class taken! Try another class, or write your own."
const IDEA_GONE = "Someone just took that idea, sorry! Here’s the idea step again."
const PICKED_FOR = you => `Then let’s make it so ${you} gets it.`
// The postcard is made an hour in and mailed with whatever you pick; picked alone, it's the prize for one video.
const PICKED_PRIZE = (name, videos) => `Nice pick! The ${name} takes ${videos} videos. Your postcard is mailed with it, free.`
const PICKED_POSTCARD = "Just the postcard, then. It’s made one hour in, and on its own it’s your prize for one video."

function load(storage, key) {
  try { return JSON.parse(storage.getItem(key)) ?? {} } catch { return {} }
}

function save(storage, key, value) {
  try { storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)) } catch { /* storage unavailable */ }
}

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1)
const shortDate = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric" })

// The first scene for an idea: the idea itself, written on screen.
function starter(idea) {
  return `from manim import *


class MyScene(Scene):
    def construct(self):
        title = Text(${JSON.stringify(idea)}, font_size=48)
        if title.width > 12:
            title.scale_to_fit_width(12)
        self.play(Write(title))
        self.wait()
`
}

export default class extends Controller {
  static targets = ["step", "value", "dot", "own", "ownSubmit", "klass", "drawn", "drawnIdeas", "drawnTemplate", "another",
    "stageText", "forWhom", "prize", "when", "days", "minutes", "ship", "rhythmNext",
    "pledgeIdea", "pledgeRhythm", "pledgeShipBy", "pledgeFor", "pledgePrize", "dmTime", "dmText",
    "name", "today", "hold", "holdFill", "holdLabel", "signed", "bubble", "pi"]
  static values = { poses: Object, whoamiUrl: String, drawUrl: String, claimUrl: String, pledgeUrl: String,
    for: Object, slots: Object, sessions: Object, hoursPerVideo: Number }

  connect() {
    this.answers = { step: 0, ...load(sessionStorage, ANSWERS_KEY) }
    if (!Array.isArray(this.answers.drawn)) delete this.answers.drawn
    this.mascot = new Mascot(this.piTarget, this.bubbleTarget, this.posesValue)
    this.progress = 0
    this.todayTarget.textContent = shortDate(new Date()).toLowerCase()
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

  // The idea: your own, or one of three from your math class. "Show me others" lets them go back in the pool, and
  // skips the ones you've already seen. Either way it writes itself on screen next, and asks who it's for.

  pickClass({ params: { klass } }) {
    this.answers.klass = klass
    capture("onboarding_class_picked", { klass })
    this.drawIdea()
  }

  async drawIdea() {
    this.answers.seen = [...(this.answers.seen ?? []), ...(this.answers.drawn ?? []).map(idea => idea.id)].slice(-60)
    this.anotherTarget.disabled = true
    try {
      const response = await this.post(this.drawUrlValue, { klass: this.answers.klass, except: this.answers.seen })
      this.answers.drawn = response.status === 200 ? await response.json() : null
      capture("onboarding_idea_drawn", { klass: this.answers.klass, ideas: this.answers.drawn?.map(idea => idea.id), out: !this.answers.drawn })
      this.mascot.say(this.answers.drawn ? DREW_IDEA : OUT_OF_IDEAS, this.answers.drawn ? "speaking" : "erm")
    } catch {
      this.answers.drawn = null
    }
    this.anotherTarget.disabled = false
    this.render()
  }

  takeIdea({ params: { id } }) {
    const idea = this.answers.drawn?.find(drawn => drawn.id === id)
    if (idea) this.chooseIdea({ idea: idea.title, ideaId: idea.id, ownIdea: false }, TOOK_IDEA)
  }

  ownIdea() {
    const idea = this.ownTarget.value.trim()
    if (idea) this.chooseIdea({ idea, ideaId: null, ownIdea: true })
  }

  chooseIdea(values, reply) {
    Object.assign(this.answers, values, { ideaPhase: "who" })
    capture("onboarding_idea_chosen", { ...values })
    this.render()
    this.mascot.say(reply ?? LINES.who[0], reply ? "happy" : LINES.who[1])
    clearTimeout(this.pickTimer)
    if (reply) this.pickTimer = setTimeout(() => this.mascot.say(...LINES.who), PICK_DELAY * 4)
  }

  changeIdea() {
    this.answers.ideaPhase = "what"
    this.render()
    this.greet()
  }

  pickFor({ params: { for: forWhom } }) {
    this.answer("idea", { forWhom, ideaPhase: null }, PICKED_FOR(this.forValue[forWhom].you))
  }

  pickPrize({ params: { id, name, videos, alone } }) {
    this.answer("prize", { prize: id, prizeName: name }, alone ? PICKED_POSTCARD : PICKED_PRIZE(name, videos))
  }

  // When, how often and how long: enough to say when a first video ships.

  pickWhen({ params: { when } }) { this.answers.when = when; this.render() }
  pickDays({ params: { days } }) { this.answers.days = days; this.render() }
  pickMinutes({ params: { minutes } }) { this.answers.minutes = minutes; this.render() }

  rhythmDone() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    this.answer("rhythm", { timezone, shipBy: this.shipBy().toISOString().slice(0, 10) },
      `${shortDate(this.shipBy())} it is. I’ll hold you to that.`)
  }

  get daysPerWeek() {
    return this.answers.when === "weekends" ? 2 : this.answers.days
  }

  get rhythmReady() {
    return !!(this.answers.when && this.daysPerWeek && this.answers.minutes)
  }

  // A first video's hours, in sessions at your pace, spread over the days a week you said.
  shipBy() {
    const sessions = Math.ceil(this.hoursPerVideoValue * 60 / this.answers.minutes)
    const days = Math.max(sessions - 1, Math.ceil(sessions / this.daysPerWeek * 7))
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date
  }

  rhythmText() {
    const { when, days, minutes } = this.answers
    const often = when === "weekends" ? "on weekends" : `${days === 7 ? "every day" : `${days} days a week`}, ${when === "evening" ? "in the evening" : when}`
    return minutes ? `${often}, ${this.sessionsValue[minutes]} at a time` : often
  }

  answer(step, values, reply) {
    Object.assign(this.answers, values)
    const index = STEPS.indexOf(step)
    this.answers.step = Math.max(this.answers.step, index + 1)
    this.answers.open = null
    capture("onboarding_step_answered", { step, ...values })
    this.mascot.say(reply, "happy")
    this.render()
    clearTimeout(this.pickTimer)
    this.pickTimer = setTimeout(() => this.greet(), PICK_DELAY * 4)
  }

  reopen({ params: { step } }) {
    if (this.answers.signed) return
    this.answers.open = step
    if (step === 0) this.answers.ideaPhase = "what"
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
      Object.assign(this.answers, { step: 0, open: 0, idea: null, ideaId: null, drawn: null, ideaPhase: "what" })
      this.progress = 0
      this.holdFillTarget.style.transform = "scaleX(0)"
      this.render()
      return this.mascot.say(IDEA_GONE, "erm")
    }
    this.answers.signed = new Date().toISOString()
    capture("onboarding_pledge_signed", { ...this.answers, drawn: undefined, seen: undefined })
    this.keepPledge()
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

  // For nudges. If it doesn't get through, the pledge still stands for them.
  async keepPledge() {
    const a = this.answers
    try {
      await this.post(this.pledgeUrlValue, { pledge: {
        name: a.name, idea: a.idea, idea_record_id: a.ideaId, for_whom: a.forWhom, prize: a.prize, build_time: a.when,
        days_per_week: this.daysPerWeek, session_minutes: a.minutes, timezone: a.timezone, ship_by: a.shipBy,
      } })
    } catch { /* offline */ }
  }

  post(url, body = {}) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": document.querySelector("meta[name=csrf-token]")?.content },
      body: JSON.stringify(body),
    })
  }

  open() {
    capture("onboarding_finished", {})
    sessionStorage.removeItem(ANSWERS_KEY)
  }

  abandoned() {
    if (!this.answers.signed) capture("onboarding_abandoned", { step: STEPS[this.current] })
  }

  // Drawing

  get current() {
    return this.answers.open ?? Math.min(this.answers.step, STEPS.length - 1)
  }

  greet() {
    if (this.answers.signed) return this.mascot.say("Your editor’s ready.", "happy")
    const name = STEPS[this.current]
    const [line, pose] = LINES[name === "idea" && this.answers.ideaPhase === "who" ? "who" : name]
    if (pose === "wave") { this.mascot.say(line, "plain"); this.mascot.wave("speaking") }
    else this.mascot.say(line, pose)
    capture("onboarding_step_viewed", { step: name })
  }

  render() {
    const a = this.answers
    save(sessionStorage, ANSWERS_KEY, a)
    const current = this.current
    this.stepTargets.forEach((el, i) => {
      el.dataset.state = i === current ? "open" : i < a.step ? "done" : "todo"
    })
    this.stepTargets[0].dataset.phase = a.ideaPhase === "who" && a.idea ? "who" : "what"
    this.dotTargets.forEach((el, i) => el.classList.toggle("onboard__dot--on", i < a.step || (i === 3 && !!a.signed)))
    const forWhom = this.forValue[a.forWhom]
    const values = [a.idea && [a.idea, forWhom && `for ${forWhom.label.toLowerCase()}`].filter(Boolean).join(" · "), a.prizeName,
      a.step > 2 && this.rhythmReady && `${this.rhythmText()} · ship by ${shortDate(this.shipBy())}`]
    this.valueTargets.forEach((el, i) => { el.textContent = values[i] || "" })

    this.renderIdeas()
    this.writeIdea()
    this.forWhomTargets.forEach(el => el.setAttribute("aria-pressed", el.dataset.pledgeForParam === a.forWhom))
    this.prizeTargets.forEach(el => el.setAttribute("aria-pressed", el.dataset.prize === a.prize))
    this.renderRhythm()
    this.renderPledge()
  }

  renderIdeas() {
    const a = this.answers
    this.klassTargets.forEach(el => el.setAttribute("aria-pressed", el.dataset.pledgeKlassParam === a.klass))
    this.drawnTarget.hidden = !a.drawn
    this.drawnIdeasTarget.replaceChildren(...(a.drawn ?? []).map(idea => {
      const card = this.drawnTemplateTarget.content.firstElementChild.cloneNode(true)
      const pick = card.querySelector(".drawn-idea__pick")
      pick.dataset.pledgeIdParam = idea.id
      pick.setAttribute("aria-pressed", idea.id === a.ideaId)
      card.querySelector(".drawn-idea__title").textContent = idea.title
      card.querySelector(".drawn-idea__line").textContent = idea.line
      // The lesson it comes from, to read up on and to point people to.
      const source = card.querySelector(".drawn-idea__source")
      if (idea.source_url) {
        source.href = idea.source_url
        source.textContent = `${idea.source_title || idea.topic} ↗`
      } else {
        source.remove()
      }
      return card
    }))
  }

  // The idea on the stage, sized to fit, written in again whenever it changes (the stroke draws, then it fills).
  writeIdea() {
    const idea = this.answers.idea || ""
    if (idea === this.written) return
    this.written = idea
    const text = this.stageTextTarget
    text.textContent = idea
    text.style.fontSize = "120px"
    const width = text.getComputedTextLength?.() || 0
    if (idea && !width) { this.written = null; return } // not on screen yet: write it in once it is
    if (width > STAGE_WIDTH) text.style.fontSize = `${Math.floor(120 * STAGE_WIDTH / width)}px`
    text.classList.remove("first-frame__text--write")
    void text.getBBox?.()
    text.classList.add("first-frame__text--write")
  }

  renderRhythm() {
    const a = this.answers
    this.whenTargets.forEach(el => el.setAttribute("aria-pressed", el.dataset.pledgeWhenParam === a.when))
    this.daysTargets.forEach(el => {
      el.setAttribute("aria-pressed", Number(el.dataset.pledgeDaysParam) === a.days)
      el.disabled = a.when === "weekends"
    })
    this.minutesTargets.forEach(el => el.setAttribute("aria-pressed", Number(el.dataset.pledgeMinutesParam) === a.minutes))
    this.rhythmNextTarget.disabled = !this.rhythmReady
    this.shipTarget.hidden = !this.rhythmReady
    if (this.rhythmReady) {
      this.shipTarget.replaceChildren("At that pace, your first video ships by ",
        Object.assign(document.createElement("b"), { textContent: shortDate(this.shipBy()) }), ".")
    }
  }

  renderPledge() {
    const a = this.answers
    const forWhom = this.forValue[a.forWhom]
    this.pledgeIdeaTarget.textContent = a.idea || "something"
    this.pledgeRhythmTarget.textContent = a.when ? this.rhythmText() : ""
    this.pledgeShipByTarget.textContent = this.rhythmReady ? shortDate(this.shipBy()) : ""
    this.pledgeForTarget.textContent = forWhom?.pledge ?? "someone"
    const alone = this.prizeTargets.find(el => el.dataset.prize === a.prize)?.dataset.pledgeAloneParam === "true"
    this.pledgePrizeTarget.textContent = !a.prizeName ? "prize" : alone ? "postcard of my frame" : `${a.prizeName}, and my postcard with it`
    this.renderMessage()

    this.holdTarget.disabled = !a.name || !!a.signed
    if (!a.signed) this.holdLabelTarget.textContent = a.name ? "Hold to sign" : "Write your name first"
    this.holdTarget.hidden = !!a.signed
    this.nameTarget.disabled = !!a.signed
    this.signedTarget.hidden = !a.signed
  }

  // The message π will send: the next time they said they'd work, with their idea, who it's for and their pace.
  renderMessage() {
    const a = this.answers
    if (!a.when || !a.minutes) return
    const [hour, minute] = this.slotsValue[a.when].split(":").map(Number)
    const at = new Date()
    at.setHours(hour, minute, 0, 0)
    while (at <= new Date() || (a.when === "weekends" && ![0, 6].includes(at.getDay()))) at.setDate(at.getDate() + 1)
    const day = at.toDateString() === new Date().toDateString() ? "today" : at.toLocaleDateString("en-US", { weekday: "short" })
    this.dmTimeTarget.textContent = `${day} ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()}`
    const you = this.forValue[a.forWhom]?.you
    const session = capitalize(this.sessionsValue[a.minutes])
    this.dmTextTarget.textContent = `It’s the time you picked. “${a.idea}” is waiting${you ? `, and so is ${you}` : ""}. ${session} now?`
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
