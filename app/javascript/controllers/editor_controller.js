import { Controller } from "@hotwired/stimulus"
import { EXAMPLES } from "editor/examples"
import { FrameStore } from "editor/frames"
import { highlightLine } from "editor/highlight"
import { Renderer } from "editor/renderer"

const STORAGE_KEY = "manimator:code"
const EDITED_KEY = "manimator:edited"
const CURSOR_KEY = "manimator:cursor"
const FIRST_EXAMPLE = EXAMPLES[Object.keys(EXAMPLES)[0]]
const BLANK = `from manim import *


class MyScene(Scene):
    def construct(self):
        circle = Circle(color=BLUE, fill_opacity=0.4)
        self.play(Create(circle))
        self.wait()
`

function load(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

function store(key, value) {
  try { localStorage.setItem(key, value) } catch { /* storage unavailable: nothing to do */ }
}

function ago(ms) {
  const m = Math.floor((Date.now() - ms) / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  if (m < 60 * 24) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 60 / 24)}d ago`
}

// Clip colors follow what an animation does: draw in, fade, change, or call attention.
function clipKind(label) {
  if (label === "add") return "muted"
  if (/^(Create|Write|DrawBorderThenFill|Uncreate|Unwrite|ShowCreation|SpiralIn|AddText)/.test(label)) return "blue"
  if (/^Fade/.test(label)) return "teal"
  if (/^(Indicate|Circumscribe|Wiggle|Flash|ShowPassingFlash|FocusOn|ApplyWave)/.test(label)) return "purple"
  return "yellow"
}

const seconds = f => (Number.isInteger(f) ? String(f) : f.toFixed(1)) + "s"

function el(tag, className, text) {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text != null) e.textContent = text
  return e
}

// The live Manim editor: CodeMirror, a canvas, a lane timeline, and a Pyodide
// worker in between that re-bakes the scene on every edit.
export default class extends Controller {
  static targets = ["code", "error", "wrap", "stage", "tooltip", "play", "time", "total", "chapter", "status", "reset",
    "scene", "fps", "timeline", "laneNames", "lanes", "ruler", "waits", "playhead",
    "sceneName", "examples", "resume", "resumeMeta", "thumb"]
  static values = { worker: String, manim: String }

  async connect() {
    // Playback state
    this.renderer = new Renderer(this.stageTarget)
    this.thumbRenderer = new Renderer(this.thumbTarget)
    this.store = null // what's on screen
    this.incoming = null // run in progress, swapped in on its first chunk
    this.frame = 0
    this.playing = false
    this.playClock = { t: 0, frame: 0 }
    this.hoverLine = null
    this.cursorLine = Number(load(CURSOR_KEY, 0)) || null
    this.dirty = true
    this.timelineDirty = false
    this.untimed = null // code before the first clip drag, for "reset timing"
    this.view = this.element.dataset.view

    // Python worker: one bake at a time, latest edit wins
    this.interrupt = self.crossOriginIsolated ? new Int32Array(new SharedArrayBuffer(4)) : null
    this.ready = false
    this.busy = false
    this.pendingCode = null
    this.runSeq = 0
    this.sceneName = null

    this.renderExamples()

    // Keep the stage at 16:9 inside its pane
    this.resizeObserver = new ResizeObserver(() => {
      const { width, height } = this.wrapTarget.getBoundingClientRect()
      const w = Math.min(width - 40, ((height - 32) * 16) / 9)
      this.renderer.resize(Math.max(0, Math.floor(w)), Math.max(0, Math.floor((w * 9) / 16)))
      this.dirty = true
    })
    this.resizeObserver.observe(this.wrapTarget)

    this.startWorker()
    this.tick = this.tick.bind(this)
    this.raf = requestAnimationFrame(this.tick)

    // CodeMirror is only needed here, so it loads with the editor instead of on every page
    const { createEditor } = await import("editor/code_editor")
    if (!this.element.isConnected) return
    this.editor = createEditor(this.codeTarget, load(STORAGE_KEY, FIRST_EXAMPLE), {
      onChange: code => {
        store(STORAGE_KEY, code)
        store(EDITED_KEY, String(Date.now()))
        clearTimeout(this.debounce)
        this.debounce = setTimeout(() => this.requestRun(code), 120)
      },
      onScrub: () => {
        clearTimeout(this.debounce)
        this.requestRun(this.editor.code)
      },
      onCursorLine: line => {
        if (this.cursorLine !== line) {
          this.cursorLine = line
          this.dirty = true
          store(CURSOR_KEY, String(line))
        }
      },
    })
    this.requestRun(this.editor.code)
    this.renderHome()
  }

  disconnect() {
    cancelAnimationFrame(this.raf)
    clearTimeout(this.debounce)
    this.resizeObserver.disconnect()
    this.worker?.terminate()
    this.editor?.destroy()
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  setFrame(f) {
    const max = Math.max(0, (this.store?.length ?? 1) - 1)
    f = Math.max(0, Math.min(max, f))
    if (f !== this.frame) { this.frame = f; this.dirty = true }
  }

  setPlaying(p) {
    const { store } = this
    if (p && store && store.done && this.frame >= store.length - 1) this.setFrame(0)
    this.playing = p
    this.playClock = { t: performance.now(), frame: this.frame }
    this.playTarget.textContent = p ? "❚❚" : "▶"
  }

  tick(now) {
    const { store } = this
    if (this.playing && store) {
      const f = this.playClock.frame + Math.floor(((now - this.playClock.t) / 1000) * store.fps)
      if (f >= store.length) {
        this.setFrame(store.length - 1)
        if (store.done) this.setPlaying(false)
        else this.playClock = { t: now, frame: this.frame } // buffering: wait for the bake to catch up
      } else this.setFrame(f)
    }
    if (this.timelineDirty) this.renderTimeline()
    if (this.dirty) this.draw()
    this.raf = requestAnimationFrame(this.tick)
  }

  draw() {
    const { store, frame } = this
    this.dirty = false
    this.renderer.draw(store?.frames[frame], store?.strings ?? [], store?.background ?? "#000", { hoverLine: this.hoverLine, cursorLine: this.cursorLine })
    const fps = store?.fps ?? 30
    const total = store?.length ?? 0
    this.timeTarget.textContent = (frame / fps).toFixed(2)
    this.totalTarget.textContent = (total / fps).toFixed(2)
    this.playheadTarget.style.left = `${total ? (frame / total) * 100 : 0}%`
    const sec = store?.sectionAt(frame)
    this.chapterTarget.textContent = sec ? `L${sec.line} · ${sec.label.replace(/\.animate\./g, "")}` : ""
    for (const c of this.clipEls ?? []) c.el.classList.toggle("clip--on", frame >= c.start && frame < c.end)
    this.editor?.setMarks({ playing: sec?.line ?? null, hover: this.hoverLine })
  }

  // ---------------------------------------------------------------------------
  // Timeline: one lane per mobject, one clip per animation
  // ---------------------------------------------------------------------------

  lanes() {
    const lanes = new Map()
    const lane = c => {
      let l = lanes.get(c.lane)
      if (!l) lanes.set(c.lane, l = { name: c.lane, line: c.lane_line, redraw: false, clips: [], first: Infinity })
      l.redraw ||= c.redraw
      return l
    }
    this.store.sections.forEach((s, i) => s.clips.forEach(c => {
      const l = lane(c)
      l.clips.push({ label: c.label.replace(/^\.animate\./, ""), start: c.start, end: c.end, line: s.line, section: i })
      l.first = Math.min(l.first, c.start)
    }))
    for (const a of this.store.adds) {
      const l = lane(a)
      l.clips.push({ label: "add", start: a.frame, end: this.store.length, line: a.line, add: true })
      l.first = Math.min(l.first, a.frame)
    }
    return [...lanes.values()].sort((a, b) => a.first - b.first)
  }

  renderTimeline() {
    this.timelineDirty = false
    const { store } = this
    if (!store) return
    const total = Math.max(1, store.length)
    const pct = f => `${(f / total) * 100}%`
    const lanes = this.lanes()

    const secs = total / store.fps
    const step = secs > 40 ? 5 : secs > 16 ? 2 : 1
    const ticks = []
    for (let s = 0; s <= secs; s += step) {
      const t = el("span", "tl__tick", `${s}s`)
      t.style.left = pct(s * store.fps)
      ticks.push(t)
    }
    this.rulerTarget.replaceChildren(...ticks)

    this.waitsTarget.replaceChildren(...store.sections.filter(s => !s.clips.length).map(s => {
      const w = el("div", "tl__wait")
      w.style.left = pct(s.start)
      w.style.width = pct(s.end - s.start)
      w.append(el("span", "tl__wait-label", s.label))
      return w
    }))

    this.clipEls = []
    this.laneNamesTarget.replaceChildren(...lanes.map(l => {
      const name = el("button", "tl__name", l.name)
      name.append(el("span", "tl__name-line", `L${l.line}`))
      name.dataset.action = "editor#pickLine"
      name.dataset.editorLineParam = l.line
      if (store.values[l.name]) name.classList.add("tl__name--tall")
      return name
    }))
    this.lanesTarget.replaceChildren(...lanes.map(l => {
      const row = el("div", "tl__lane")
      const values = store.values[l.name]
      if (values) {
        row.classList.add("tl__lane--tall")
        row.append(this.valueCurve(values, total))
      }
      const played = l.clips.filter(c => !c.add)
      if (l.redraw && played.length) {
        const r = el("div", "tl__redraw")
        r.style.left = pct(Math.max(...played.map(c => c.end)))
        r.append(el("span", "tl__redraw-label", "always_redraw"), el("span", "tl__redraw-line"))
        row.append(r)
      }
      for (const c of l.clips) {
        const clip = el("div", `clip clip--${clipKind(c.label)}${values ? " clip--ghost" : ""}`)
        clip.style.left = pct(c.start)
        clip.style.width = `calc(${pct(c.end - c.start)} - 2px)`
        clip.title = `line ${c.line}: ${c.label}`
        clip.dataset.action = "click->editor#pickLine"
        clip.dataset.editorLineParam = c.line
        clip.append(el("span", "clip__label", c.label))
        if (!c.add) {
          const sec = store.sections[c.section]
          clip.append(el("span", "clip__dur", seconds(Math.round(((sec.end - sec.start) / store.fps) * 10) / 10)))
          const handle = el("span", "clip__handle")
          handle.dataset.action = "pointerdown->editor#retime"
          handle.dataset.editorSectionParam = c.section
          clip.append(handle)
        }
        row.append(clip)
        this.clipEls.push({ el: clip, start: c.start, end: c.end })
      }
      return row
    }))
    this.dirty = true
  }

  // A ValueTracker's value over the whole run, drawn across its lane
  valueCurve(values, total) {
    const first = values.find(v => v !== undefined) ?? 0
    let last = first
    const filled = Array.from({ length: total }, (_, i) => (last = values[i] ?? last))
    const lo = Math.min(...filled), hi = Math.max(...filled), range = hi - lo || 1
    const step = Math.max(1, Math.floor(total / 400))
    let d = ""
    for (let i = 0; i < total; i += step) d += `${i ? "L" : "M"}${((i / total) * 1000).toFixed(1)} ${(36 - ((filled[i] - lo) / range) * 32).toFixed(2)}`
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("viewBox", "0 0 1000 40")
    svg.setAttribute("preserveAspectRatio", "none")
    svg.classList.add("tl__curve")
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("d", d)
    path.setAttribute("vector-effect", "non-scaling-stroke")
    svg.append(path)
    return svg
  }

  // Drag a clip's right edge: rewrites run_time= (or wait()) on that line and re-bakes live
  retime(e) {
    e.stopPropagation()
    e.preventDefault()
    const sec = this.store?.sections[e.params.section]
    if (!sec || !this.editor) return
    const fps = this.store.fps
    const d0 = (sec.end - sec.start) / fps
    const pps = this.timelineTarget.getBoundingClientRect().width / (this.store.length / fps)
    const x0 = e.clientX, line = sec.line, before = this.editor.code
    let last = Math.round(d0 * 10) / 10
    document.body.classList.add("scrubbing")
    const move = ev => {
      const next = Math.max(0.1, Math.min(20, Math.round((d0 + (ev.clientX - x0) / pps) * 10) / 10))
      if (next === last) return
      last = next
      if (!this.editor.setRunTime(line, next)) return
      this.untimed ??= before
      this.resetTarget.hidden = false
      clearTimeout(this.debounce)
      this.requestRun(this.editor.code)
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      document.body.classList.remove("scrubbing")
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  resetTiming() {
    if (this.untimed == null || !this.editor) return
    this.editor.setDoc(this.untimed)
    this.clearRetime()
  }

  clearRetime() {
    this.untimed = null
    this.resetTarget.hidden = true
  }

  pickLine({ params: { line } }) {
    this.editor?.revealLine(line)
  }

  // ---------------------------------------------------------------------------
  // Python worker
  // ---------------------------------------------------------------------------

  startWorker() {
    this.ready = false
    this.busy = false
    // A worker script needs its own COEP header on a cross-origin isolated page, and
    // asset responses don't carry one. A blob: worker inherits the page's policy instead.
    const src = new URL(this.workerValue, location.href).href
    const blob = URL.createObjectURL(new Blob([`import ${JSON.stringify(src)}`], { type: "text/javascript" }))
    this.worker = new Worker(blob, { type: "module" })
    URL.revokeObjectURL(blob)
    this.worker.onmessage = e => this.onWorkerMessage(e.data)
    this.worker.postMessage({ type: "init", interrupt: this.interrupt?.buffer ?? null, manimUrl: new URL(this.manimValue, location.href).href })
    this.setStatus("loading Python…", "busy")
  }

  requestRun(code) {
    this.pendingCode = code
    if (!this.ready) return
    if (this.busy) {
      if (this.interrupt) Atomics.store(this.interrupt, 0, 2) // SIGINT -> KeyboardInterrupt in Python
      else { this.worker.terminate(); this.startWorker() }
      return
    }
    this.dispatchRun()
  }

  dispatchRun() {
    if (this.pendingCode == null) return
    const id = ++this.runSeq
    this.busy = true
    this.incoming = new FrameStore(id)
    this.worker.postMessage({ type: "run", id, code: this.pendingCode, fps: Number(this.fpsTarget.value), scene: this.sceneName })
    this.pendingCode = null
    this.setStatus("rendering…", "busy")
  }

  onWorkerMessage(msg) {
    switch (msg.type) {
      case "ready":
        this.ready = true
        this.setStatus(`Python ready (${(msg.ms / 1000).toFixed(1)}s)`, "ok")
        this.dispatchRun()
        if (!this.store && this.view !== "home") this.setPlaying(true)
        return
      case "chunk":
        if (msg.id !== this.runSeq || !this.incoming) return
        this.incoming.append(msg.data, msg.lengths, msg.meta)
        if (this.store !== this.incoming) {
          this.store = this.incoming
          this.setFrame(this.frame)
        }
        this.setStatus(`rendering… ${this.store.length} frames`, "busy")
        this.timelineDirty = true
        this.dirty = true
        return
      case "done":
        this.busy = false
        if (msg.id === this.runSeq && this.incoming) {
          this.incoming.done = true
          this.store = this.incoming
          this.clearError()
          this.updateSceneSelect(msg.scenes, msg.scene)
          this.sceneNameTargets.forEach(t => t.textContent = msg.scene)
          this.setStatus(`✓ ${msg.frames} frames in ${Math.round(msg.ms)}ms`, "ok")
          this.timelineDirty = true
          this.dirty = true
          if (this.view === "home") this.renderHome()
        }
        this.dispatchRun()
        return
      case "cancelled":
        this.busy = false
        this.dispatchRun()
        return
      case "error":
        this.busy = false
        if (msg.id === this.runSeq || msg.id === -1) this.showError(msg.message, msg.line, msg.traceback)
        this.dispatchRun()
        return
    }
  }

  setStatus(text, kind) {
    this.statusTarget.textContent = text
    this.statusTarget.dataset.kind = kind
  }

  showError(message, line, traceback) {
    const box = this.errorTarget
    box.hidden = false
    const head = el("div", "app__error-head", line ? `line ${line}: ${message}` : message)
    if (line) head.addEventListener("click", () => this.editor?.revealLine(line))
    box.replaceChildren(head, el("pre", null, traceback))
    this.editor?.setMarks({ error: line })
    this.setStatus(line ? `error · line ${line}` : "error", "error")
  }

  clearError() {
    this.errorTarget.hidden = true
    this.editor?.setMarks({ error: null })
  }

  updateSceneSelect(scenes, current) {
    this.sceneTarget.hidden = scenes.length < 2
    this.sceneTarget.replaceChildren(...scenes.map(s => new Option(s, s, false, s === current)))
  }

  // ---------------------------------------------------------------------------
  // Home and examples
  // ---------------------------------------------------------------------------

  viewChanged({ detail: { view } }) {
    this.view = view
    if (view === "home") this.renderHome()
    else this.editor?.view.requestMeasure()
  }

  renderHome() {
    if (!this.editor) return
    const n = this.editor.view.state.doc.lines
    const cursor = Math.min(Math.max(1, this.cursorLine ?? n), n)
    const from = Math.max(1, Math.min(cursor - 4, n - 6))
    const lines = []
    for (let i = from; i <= Math.min(n, from + 6); i++) {
      const row = el("div", `resume__line${i === cursor ? " resume__line--cursor" : ""}`)
      const code = el("span", "resume__text")
      code.append(highlightLine(this.editor.lineText(i)))
      row.append(el("span", "resume__num", String(i)), code)
      lines.push(row)
    }
    this.resumeTarget.replaceChildren(...lines)

    const edited = Number(load(EDITED_KEY, 0))
    const length = this.store ? ` · ${(this.store.length / this.store.fps).toFixed(1)}s scene` : ""
    this.resumeMetaTarget.textContent = `${edited ? `last edit ${ago(edited)} · ` : ""}cursor on line ${cursor}${length}`

    const { width } = this.thumbTarget.getBoundingClientRect()
    if (width && this.store?.length) {
      this.thumbRenderer.resize(Math.floor(width), Math.floor((width * 9) / 16))
      const f = this.frame || Math.floor(this.store.length * 0.45)
      this.thumbRenderer.draw(this.store.frames[f], this.store.strings, this.store.background, { hoverLine: null, cursorLine: null })
    }
  }

  renderExamples() {
    this.examplesTarget.replaceChildren(...Object.entries(EXAMPLES).map(([name, code]) => {
      const b = el("button", "example")
      b.dataset.action = "editor#loadExample shell#show"
      b.dataset.editorNameParam = name
      b.dataset.shellViewParam = "code"
      b.append(el("span", "example__name", name), el("span", "mono-xs c-faint", code.match(/class (\w+)/)?.[1] ?? ""))
      return b
    }))
  }

  loadExample({ params: { name } }) {
    if (EXAMPLES[name]) this.replaceCode(EXAMPLES[name])
  }

  newScene() {
    this.replaceCode(BLANK)
  }

  replaceCode(code) {
    if (!this.editor) return
    this.sceneName = null
    this.clearRetime()
    this.editor.setDoc(code)
    this.setFrame(0)
    this.setPlaying(true)
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  seek({ params: { seconds } }) {
    this.setPlaying(false)
    this.setFrame(Math.round(seconds * (this.store?.fps ?? 30)))
  }

  pickScene() {
    this.sceneName = this.sceneTarget.value
    if (this.editor) this.requestRun(this.editor.code)
  }

  changeFps() {
    const t = this.store ? this.frame / this.store.fps : 0
    if (this.editor) this.requestRun(this.editor.code)
    this.frame = Math.round(t * Number(this.fpsTarget.value))
  }

  toggle() {
    this.setPlaying(!this.playing)
  }

  key(e) {
    if (this.view === "home" || e.target.closest(".cm-editor, select, input, textarea")) return
    if (e.code === "Space") {
      e.preventDefault()
      this.setPlaying(!this.playing)
    } else if (e.code === "ArrowRight" || e.code === "ArrowLeft") {
      e.preventDefault()
      this.setPlaying(false)
      const step = (e.shiftKey ? 10 : 1) * (e.code === "ArrowRight" ? 1 : -1)
      this.setFrame(this.frame + step)
    }
  }

  // Timeline scrubbing
  scrubTo(clientX) {
    if (!this.store) return
    const r = this.timelineTarget.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    this.setFrame(Math.min(this.store.length - 1, Math.floor(t * this.store.length)))
  }

  scrub(e) {
    const track = this.timelineTarget
    this.setPlaying(false)
    track.setPointerCapture(e.pointerId)
    this.scrubTo(e.clientX)
    const move = ev => this.scrubTo(ev.clientX)
    const up = () => {
      track.removeEventListener("pointermove", move)
      track.removeEventListener("pointerup", up)
    }
    track.addEventListener("pointermove", move)
    track.addEventListener("pointerup", up)
  }

  // Canvas <-> code
  hover(e) {
    const r = this.stageTarget.getBoundingClientRect()
    const line = this.renderer.hitTest(this.store?.frames[this.frame], e.clientX - r.left, e.clientY - r.top)
    if (line !== this.hoverLine) { this.hoverLine = line; this.dirty = true }
    this.stageTarget.style.cursor = line ? "pointer" : "default"
    const tip = this.tooltipTarget
    tip.hidden = !line || !this.editor
    if (tip.hidden) return
    const text = this.editor.lineText(line).trim()
    tip.textContent = `L${line}  ${text.length > 60 ? text.slice(0, 57) + "…" : text}`
    const wrapRect = this.wrapTarget.getBoundingClientRect()
    const x = e.clientX - wrapRect.left
    const flip = x + 14 + tip.offsetWidth > wrapRect.width
    tip.style.left = `${flip ? x - 14 - tip.offsetWidth : x + 14}px`
    tip.style.top = `${e.clientY - wrapRect.top + 14}px`
  }

  unhover() {
    this.hoverLine = null
    this.tooltipTarget.hidden = true
    this.dirty = true
  }

  jump() {
    if (this.hoverLine) this.editor?.revealLine(this.hoverLine)
  }
}
