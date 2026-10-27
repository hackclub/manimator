import { basicSetup, EditorView } from "codemirror"
import { python } from "@codemirror/lang-python"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
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

// Alt/Option + drag on a number literal scrubs its value, Bret Victor style.
function numberScrubber(onScrub) {
  return EditorView.domEventHandlers({
    mousedown(e, view) {
      if (!e.altKey) return false
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (pos == null) return false
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
        theme,
        syntaxHighlighting(highlight),
        marksField,
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
      if (next.playing === marks.playing && next.hover === marks.hover && next.error === marks.error) return
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
    lineText(line) {
      return view.state.doc.line(Math.min(line, view.state.doc.lines)).text
    },
    setDoc(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
    },
    destroy() {
      view.destroy()
    },
  }
}
