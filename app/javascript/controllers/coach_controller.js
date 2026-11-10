import { Controller } from "@hotwired/stimulus"
import { capture } from "analytics"
import { Mascot } from "mascot"

// π in the editor, under your code, with one thing to try that needs no typing: drag a number. The scene the story
// onboarding leaves you with has k in it, the number you watched { } turn, so π points at that one (it pulses, and
// drags without holding Alt); anywhere else, it's any number. × hides π for good.
const KEY = "manimator:coach" // "scrubbed" once you've dragged a number, "off" once hidden
const ALT = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌥" : "Alt"

const LINES = {
  k: ["Drag the number after `k`. The field follows.", "speaking"],
  any: [`Hold ${ALT} and drag any number in your code. The picture follows.`, "speaking"],
  scrubbed: [`Every number does that. Hold ${ALT} and drag.`, "hooray"],
}

function load() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

function save(value) {
  try { localStorage.setItem(KEY, value) } catch { /* storage unavailable */ }
}

export default class extends Controller {
  static targets = ["card", "pi", "bubble"]
  static values = { poses: Object }

  // The editor's CodeMirror wrapper (editor/code_editor.js), once the editor has it.
  get code() {
    return this.application.getControllerForElementAndIdentifier(this.element, "editor")?.editor
  }

  ready() {
    const seen = load()
    if (seen === "off" || !this.code) return
    this.mascot = new Mascot(this.piTarget, this.bubbleTarget, this.posesValue)
    this.cardTarget.hidden = false
    if (seen === "scrubbed") return this.mascot.say(...LINES.scrubbed.with(1, "happy"))
    this.waiting = true
    const line = this.code.hintNumber("k") ? LINES.k : LINES.any
    this.mascot.say(line[0], "plain")
    this.mascot.wave(line[1])
    capture("editor_coach_shown", {})
  }

  scrubbed() {
    if (!this.waiting) return
    this.waiting = false
    this.code?.clearHint()
    save("scrubbed")
    this.mascot.say(...LINES.scrubbed)
    capture("editor_coach_scrubbed", {})
  }

  hide() {
    this.waiting = false
    this.code?.clearHint()
    this.cardTarget.hidden = true
    save("off")
    capture("editor_coach_hidden", {})
  }

  disconnect() {
    this.mascot?.stop()
  }
}
