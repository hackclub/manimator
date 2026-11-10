import { Controller } from "@hotwired/stimulus"
import { capture } from "analytics"
import { Mascot } from "mascot"

// π in the editor, under your code, with one thing to try that needs no typing: drag a number. The scene the story
// onboarding leaves you with has k in it, the number you watched { } turn, so π points at that one (it pulses, and
// drags without holding Alt); anywhere else, it's any number.
//
// Under π are three chips for what to do next, each of which writes a line or two at the end of construct() and plays
// it: a new shape, a move, a colour. They're choices, not lessons: the code they leave is real and yours to change.
// × hides π for good.
const KEY = "manimator:coach" // "scrubbed" once you've dragged a number, "off" once hidden
const ALT = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌥" : "Alt"

const LINES = {
  k: ["Drag the number after `k`. The field follows.", "speaking"],
  any: [`Hold ${ALT} and drag any number in your code. The picture follows.`, "speaking"],
  scrubbed: [`Every number does that. Hold ${ALT} and drag. What next?`, "hooray"],
}

// Shapes come in this order, each somewhere the last one isn't.
const SHAPES = [
  ["circle", "Circle", "Circle(color=BLUE, fill_opacity=0.5)"],
  ["square", "Square", "Square(color=GREEN, fill_opacity=0.5).shift(RIGHT * 3)"],
  ["triangle", "Triangle", "Triangle(color=YELLOW, fill_opacity=0.5).shift(LEFT * 3)"],
  ["star", "Star", "Star(color=PINK, fill_opacity=0.5).shift(DOWN * 2)"],
]
const MOVES = ["shift(RIGHT * 2)", "scale(1.5)", "shift(DOWN)", "scale(0.5)"]
const COLOURS = ["YELLOW", "PINK", "TEAL", "ORANGE", "RED"]
// Something on screen with a name, to move or colour: the last one the code makes.
const NAMED = /^[ \t]*(\w+)[ \t]*=[ \t]*(?:Circle|Square|Triangle|Star|Text|MathTex|Tex|Rectangle|Dot|Line|Arrow|Polygon|RegularPolygon|Ellipse)\(/gm
const count = (code, pattern) => code.match(pattern)?.length ?? 0

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
  get editor() {
    return this.application.getControllerForElementAndIdentifier(this.element, "editor")
  }

  get code() {
    return this.editor?.editor
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

  // A shape, and the line that draws it. A second circle is circle2.
  addShape() {
    const code = this.code.code
    const [name, kind, shape] = SHAPES[count(code, /=[ \t]*(?:Circle|Square|Triangle|Star)\(/g) % SHAPES.length]
    const taken = count(code, new RegExp(`^[ \\t]*${name}\\d*[ \\t]*=`, "gm"))
    const called = taken ? `${name}${taken + 1}` : name
    this.add("shape", [`${called} = ${shape}`, `self.play(Create(${called}))`], `A \`${kind}\`. One line makes it, the next draws it.`)
  }

  move() {
    const name = this.named()
    if (!name) return this.nothingYet()
    const move = MOVES[count(this.code.code, /\.animate\.(?:shift|scale)\(/g) % MOVES.length]
    this.add("move", [`self.play(${name}.animate.${move})`], "`.animate` turns a change into motion.")
  }

  recolor() {
    const name = this.named()
    if (!name) return this.nothingYet()
    const colour = COLOURS[count(this.code.code, /\.set_color\(/g) % COLOURS.length]
    this.add("colour", [`self.play(${name}.animate.set_color(${colour}))`], "Any colour in capitals works. Try `GOLD`.")
  }

  named() {
    return [...this.code.code.matchAll(NAMED)].at(-1)?.[1]
  }

  nothingYet() {
    this.mascot.say("Add a shape first, then I have something to work with.", "erm")
  }

  // The chip's lines go in, and the scene plays from the last of them (the self.play).
  add(chip, lines, reply) {
    const first = this.code.addToConstruct(lines)
    if (!first) return this.mascot.say("I can’t find `construct` in this file, so I don’t know where to write.", "erm")
    this.waiting = false
    this.code.clearHint()
    this.editor.playFrom(first + lines.length - 1)
    this.mascot.say(reply, "happy")
    capture("editor_coach_chip", { chip })
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
