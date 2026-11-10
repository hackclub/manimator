import { basicSetup, EditorView } from "codemirror"
import { python } from "@codemirror/lang-python"
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language"
import { tags as t } from "@lezer/highlight"
import { EditorState, StateEffect, StateField } from "@codemirror/state"
import { Decoration, keymap } from "@codemirror/view"
import { indentWithTab } from "@codemirror/commands"

// The landing page's look: raised panel, Computer Modern Typewriter, 3Blue1Brown colors.
const theme = EditorView.theme({
  "&": { height: "100%", color: "var(--ink)", backgroundColor: "var(--bg-raised)" },
  ".cm-scroller": { fontFamily: "var(--mono)", fontSize: "15px", lineHeight: "1.55" },
  ".cm-content": { caretColor: "var(--yellow)", padding: "14px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--yellow)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "rgba(88, 196, 221, .22)" },
  ".cm-gutters": { backgroundColor: "var(--bg-raised)", color: "var(--ink-faint)", border: "none", paddingLeft: "6px" },
  ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, .025)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": { backgroundColor: "rgba(244, 211, 69, .16)", outline: "none" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--line)", border: "none", color: "var(--ink-muted)" },
  ".cm-tooltip": { backgroundColor: "var(--bg)", border: "1px solid var(--line-hover)", borderRadius: "8px" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--line-strong)", color: "var(--ink)" },
  ".cm-panels": { backgroundColor: "var(--bg)", color: "var(--ink)" },
}, { dark: true })

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: "var(--yellow)" },
  { tag: [t.string, t.special(t.string)], color: "var(--green)" },
  { tag: [t.number, t.bool, t.null], color: "var(--blue)" },
  { tag: [t.className, t.definition(t.className)], color: "var(--teal)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--blue)" },
  { tag: t.definition(t.variableName), color: "var(--ink)" },
  { tag: t.self, color: "var(--purple)", fontStyle: "italic" },
  { tag: t.comment, color: "var(--ink-faint)", fontStyle: "italic" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--ink-muted)" },
  { tag: t.invalid, color: "var(--red)" },
])

const setMarks = StateEffect.define()

const marksField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (!e.is(setMarks)) continue
      const ranges = []
      const add = (line, cls) => {
        if (line && line >= 1 && line <= tr.state.doc.lines) {
          ranges.push(Decoration.line({ class: cls }).range(tr.state.doc.line(line).from))
        }
      }
      add(e.value.error, "cm-line-error")
      add(e.value.playing, "cm-line-playing")
      add(e.value.hover, "cm-line-hover")
      ranges.sort((a, b) => a.from - b.from)
      deco = Decoration.set(ranges, true)
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

// One number π is pointing at (the coach's first tip): it pulses, and drags without holding Alt. Editing it lets it go.
const setHint = StateEffect.define()

const hintField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setHint)) deco = e.value ? Decoration.set([Decoration.mark({ class: "cm-scrub-hint" }).range(e.value.from, e.value.to)]) : Decoration.none
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

function hinted(view, pos) {
  let on = false
  view.state.field(hintField).between(pos, pos, () => { on = true })
  return on
}

// A number literal: not part of an identifier like BLUE_E or x2.
const NUMBER = /(?<![\w.])-?\d+(?:\.\d+)?(?![\w])/g

function numberAt(view, pos) {
  const line = view.state.doc.lineAt(pos)
  for (const m of line.text.matchAll(NUMBER)) {
    const from = line.from + m.index
    const to = from + m[0].length
    if (pos >= from && pos <= to) return { from, to, text: m[0] }
  }
  return null
}

// Alt/Option + drag on a number literal scrubs its value, Bret Victor style. The hinted number needs no Alt.
function numberScrubber(onScrub) {
  return EditorView.domEventHandlers({
    mousedown(e, view) {
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (pos == null || !(e.altKey || hinted(view, pos))) return false
      const num = numberAt(view, pos)
      if (!num) return false
      e.preventDefault()
      const decimals = num.text.includes(".") ? num.text.split(".")[1].length : 0
      const step = decimals ? 10 ** -decimals : 1
      const start = parseFloat(num.text)
      const startX = e.clientX
      const from = num.from
      let to = num.to
      document.body.classList.add("scrubbing")
      const move = (ev) => {
        const px = decimals ? 3 : 6
        const value = start + Math.round((ev.clientX - startX) / px) * step
        const text = value.toFixed(decimals)
        if (text === view.state.sliceDoc(from, to)) return
        view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
        to = from + text.length
        onScrub()
      }
      const up = () => {
        window.removeEventListener("mousemove", move)
        window.removeEventListener("mouseup", up)
        document.body.classList.remove("scrubbing")
      }
      window.addEventListener("mousemove", move)
      window.addEventListener("mouseup", up)
      return true
    },
  })
}

export function createEditor(parent, doc, hooks) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        python(),
        // Python's four spaces. CodeMirror's default unit is two, so a new line under a def or a for came out short.
        indentUnit.of("    "),
        EditorState.tabSize.of(4),
        theme,
        syntaxHighlighting(highlight),
        marksField,
        hintField,
        numberScrubber(hooks.onScrub),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) hooks.onChange(u.state.doc.toString())
          if (u.selectionSet || u.docChanged) {
            hooks.onCursorLine(u.state.doc.lineAt(u.state.selection.main.head).number)
          }
        }),
      ],
    }),
  })

  let marks = { playing: null, hover: null, error: null }
  return {
    view,
    get code() {
      return view.state.doc.toString()
    },
    setMarks(patch) {
      const next = { ...marks, ...patch }
      if (Object.keys(next).every(k => next[k] === marks[k])) return
      marks = next
      view.dispatch({ effects: setMarks.of(marks) })
    },
    revealLine(line) {
      if (line < 1 || line > view.state.doc.lines) return
      const l = view.state.doc.line(line)
      const indent = l.text.length - l.text.trimStart().length
      view.dispatch({
        selection: { anchor: l.from + indent, head: l.to },
        effects: EditorView.scrollIntoView(l.from, { y: "center" }),
      })
      view.focus()
    },
    // Points at the number a variable is set to ("k = 1.0" is the 1.0). Returns false if there isn't one.
    hintNumber(name) {
      const m = new RegExp(`^[ \\t]*${name}[ \\t]*=[ \\t]*(-?\\d+(?:\\.\\d+)?)`, "md").exec(view.state.doc.toString())
      view.dispatch({ effects: setHint.of(m ? { from: m.indices[1][0], to: m.indices[1][1] } : null) })
      return !!m
    },
    clearHint() {
      view.dispatch({ effects: setHint.of(null) })
    },
    lineText(line) {
      return view.state.doc.line(Math.min(line, view.state.doc.lines)).text
    },
    // Rewrites the duration of the play()/wait() call on a line. Returns false if it can't.
    setRunTime(line, seconds) {
      if (line < 1 || line > view.state.doc.lines) return false
      const l = view.state.doc.line(line)
      const value = Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1)
      let text = l.text
      if (/run_time\s*=\s*[\d.]+/.test(text)) text = text.replace(/(run_time\s*=\s*)[\d.]+/, `$1${value}`)
      else if (/\.wait\(\s*\)/.test(text)) text = text.replace(/\.wait\(\s*\)/, `.wait(${value})`)
      else if (/\.wait\(\s*[\d.]+/.test(text)) text = text.replace(/(\.wait\(\s*)[\d.]+/, `$1${value}`)
      else if (/\.play\(.*\)\s*$/.test(text)) text = text.replace(/\)\s*$/, `, run_time=${value})`)
      else return false
      if (text !== l.text) view.dispatch({ changes: { from: l.from, to: l.to, insert: text } })
      return true
    },
    // Adds lines to the end of construct() (the last one in the file, which is the scene that renders), indented to
    // match, and selects them. They go before a closing self.wait(), so the scene still ends on its pause. Returns the
    // first new line's number, or null if there's no construct() to add to.
    addToConstruct(lines) {
      const doc = view.state.doc
      const indentOf = text => text.match(/^[ \t]*/)[0].length
      let def = 0
      for (let i = 1; i <= doc.lines; i++) if (/^[ \t]*def construct\s*\(/.test(doc.line(i).text)) def = i
      if (!def) return null
      const indent = indentOf(doc.line(def).text) + 4
      let last = def
      for (let i = def + 1; i <= doc.lines; i++) {
        const text = doc.line(i).text
        if (!text.trim()) continue
        if (indentOf(text) < indent) break
        last = i
      }
      const end = doc.line(last)
      const before = last > def && indentOf(end.text) === indent && /^\s*self\.wait\(\s*\)\s*$/.test(end.text)
      const text = lines.map(line => " ".repeat(indent) + line).join("\n")
      const from = before ? end.from : end.to
      const start = before ? from : from + 1
      view.dispatch({
        changes: { from, insert: before ? text + "\n" : "\n" + text },
        selection: { anchor: start + indent, head: start + text.length },
        effects: EditorView.scrollIntoView(start, { y: "center" }),
        userEvent: "input",
      })
      return before ? last : last + 1
    },
    setDoc(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
    },
    destroy() {
      view.destroy()
    },
  }
}
