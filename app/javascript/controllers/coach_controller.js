import { Controller } from "@hotwired/stimulus"
import { capture } from "analytics"
import { Mascot } from "mascot"

const CHEER_MS = 1800

// π coaching someone through their first scene, on top of the real editor (the remix and wave onboardings). It
// loads a lesson (app/javascript/coach) into the editor, points at a line, and moves on once a render has the
// step's change in it. It sits on the editor's element, so the two talk in events:
//   editor:ready / editor:changed / editor:rendered / editor:failed  ->  coach
//   coach:load (a whole scene) / coach:mark (the line to point at)    ->  editor
export default class extends Controller {
  static targets = ["card", "bubble", "type", "typeCode", "copy", "pi", "count", "show", "skip", "finish"]
  static values = { lesson: String, poses: Object, finishUrl: String }

  async connect() {
    this.mascot = new Mascot(this.piTarget, this.bubbleTarget, this.posesValue)
    this.step = -1
    this.code = ""
    this.started = false
    this.lesson = (await import(`coach/${this.lessonValue}`)).default
    this.start()
  }

  disconnect() {
    clearTimeout(this.cheerTimer)
    this.mascot.stop()
  }

  // The editor's ready once CodeMirror has loaded, which can be before or after the lesson has.
  ready() {
    this.editorReady = true
    this.start()
  }

  start() {
    if (!this.lesson || !this.editorReady || this.started) return
    this.started = true
    this.cardTarget.hidden = false
    this.dispatch("load", { detail: { code: this.lesson.code } })
    this.mascot.say(this.lesson.intro, "plain")
    this.mascot.wave("speaking")
    capture("onboarding_step_viewed", { variant: this.lessonValue, step: "intro" })
    this.cheerTimer = setTimeout(() => this.goTo(0), CHEER_MS + 600)
  }

  changed({ detail: { code } }) {
    this.code = code
    this.markLine()
  }

  rendered({ detail: { code } }) {
    if (!this.started) return
    if (!this.firstRender) {
      this.firstRender = true
      capture("first_render", { variant: this.lessonValue })
    }
    if (this.stuck) { this.stuck = false; this.say() }
    const step = this.lesson.steps[this.step]
    if (step && !this.cheering && step.done(code, { start: this.stepStart })) this.complete(step)
  }

  failed({ detail: { line } }) {
    if (!this.started || this.step < 0 || this.cheering) return
    this.stuck = true
    this.typeTarget.hidden = true
    this.mascot.say(line ? `Python’s stuck on line ${line}. The red box under the code says why.` : "Python’s stuck. The red box under the code says why.", "erm")
  }

  complete(step) {
    capture("onboarding_step_answered", { variant: this.lessonValue, step: this.step + 1, shown: !!this.shown })
    this.cheering = true
    this.mascot.say(step.cheer, "hooray")
    this.mascot.dance()
    this.cheerTimer = setTimeout(() => {
      this.cheering = false
      this.goTo(this.step + 1)
    }, CHEER_MS)
  }

  goTo(index) {
    this.step = index
    this.shown = false
    if (index >= this.lesson.steps.length) return this.finish()
    this.stepStart = this.code
    this.say()
    this.markLine()
    capture("onboarding_step_viewed", { variant: this.lessonValue, step: index + 1 })
  }

  say() {
    const step = this.lesson.steps[this.step]
    if (!step) return
    this.mascot.say(step.say, "speaking")
    this.typeTarget.hidden = !step.type
    this.typeCodeTarget.textContent = step.type || ""
    this.copyTarget.textContent = "copy"
    this.countTarget.textContent = `${this.step + 1} of ${this.lesson.steps.length}`
    this.showTarget.hidden = !step.show
  }

  // The step's line, to paste.
  async copy() {
    const step = this.lesson.steps[this.step]
    if (!step?.type) return
    try {
      await navigator.clipboard.writeText(step.type)
      this.copyTarget.textContent = "copied"
    } catch { /* clipboard blocked: they can still select it */ }
  }

  // "Do it for me": make the step's change for them. Still counts once it renders.
  showMe() {
    const step = this.lesson.steps[this.step]
    if (!step?.show) return
    this.shown = true
    this.dispatch("load", { detail: { code: step.show(this.code) } })
  }

  skip() {
    capture("onboarding_skipped", { variant: this.lessonValue, step: this.step + 1 })
    this.finish()
  }

  finish() {
    this.step = this.lesson.steps.length
    this.dispatch("mark", { detail: { line: null } })
    this.mascot.say(this.lesson.finish.say, "hooray")
    this.mascot.dance()
    this.countTarget.textContent = ""
    this.typeTarget.hidden = true
    this.showTarget.hidden = true
    this.skipTarget.hidden = true
    this.finishTarget.textContent = this.lesson.finish.cta
    this.finishTarget.hidden = false
    capture("onboarding_finished", { variant: this.lessonValue })
  }

  // The first line matching the step's `at`, as it is now.
  markLine() {
    const at = this.lesson?.steps[this.step]?.at
    const index = at ? this.code.split("\n").findIndex(line => at.test(line)) : -1
    this.dispatch("mark", { detail: { line: index >= 0 ? index + 1 : null } })
  }
}
