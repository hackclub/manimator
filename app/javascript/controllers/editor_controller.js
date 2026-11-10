import { Controller } from "@hotwired/stimulus"
import { EXAMPLES } from "editor/examples"
import { FrameStore } from "editor/frames"
import { highlightLine } from "editor/highlight"
import { Renderer } from "editor/renderer"

// Where the editor kept your code before scenes were saved on the server: read once, to save it as your first scene.
const STORAGE_KEY = "manimator:code"
// The story onboarding's last frame, shown on the stage until Python has drawn the first one, so arriving from it
// doesn't start on a black canvas.
const POSTER_KEY = "manimator:poster"
const OLD_KEYS = [STORAGE_KEY, "manimator:edited", "manimator:cursor"]
// Saves wait until typing stops for this long.
const SAVE_MS = 800
const FIRST_EXAMPLE = EXAMPLES[Object.keys(EXAMPLES)[0]]
// Half-typed code doesn't run, so an error only shows once typing has stopped for this long. A render that works
// in the meantime means it never shows.
const ERROR_QUIET_MS = 1200
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

function forget(keys) {
  try { keys.forEach(k => localStorage.removeItem(k)) } catch { /* storage unavailable: nothing to do */ }
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
    "sceneName", "examples", "resume", "resumeMeta", "thumb", "saved", "others"]
  static values = { worker: String, manim: String, scenesUrl: String, scene: Object, scenes: Array }

  async connect() {
    // Playback state
    this.renderer = new Renderer(this.stageTarget)
    this.thumbRenderer = new Renderer(this.thumbTarget)
    // Canvas text only picks up the webfont once it has loaded, so redraw when it does
    Promise.all(["100px 'Computer Modern Serif'", "italic 100px 'Computer Modern Serif'"].map((f) => document.fonts?.load(f)))
      .then(() => {
        this.renderer.widthCache.clear()
        this.thumbRenderer.widthCache.clear()
        this.dirty = true
      }, () => {})
    this.store = null // what's on screen
    this.incoming = null // run in progress, swapped in on its first chunk
    this.frame = 0
    this.playing = false
    this.playClock = { t: 0, frame: 0 }
    this.hoverLine = null
    // The scene being edited ({ id: null } until its first save makes it), and your others, newest first
    this.scene = { id: this.sceneValue.id ?? null }
    this.scenes = this.scenesValue
    this.editedAt = this.sceneValue.edited_at ? Date.parse(this.sceneValue.edited_at) : null
    this.cursorLine = this.sceneValue.cursor_line ?? null
    this.unsaved = false
    this.saving = Promise.resolve()
    this.onPageHide = () => this.save({ keepalive: true })
    window.addEventListener("pagehide", this.onPageHide)
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
    this.renderOthers()

    // Keep the stage at 16:9 inside its pane
    this.showPoster()
    this.resizeObserver = new ResizeObserver(() => {
      const { width, height } = this.wrapTarget.getBoundingClientRect()
      const w = Math.min(width - 40, ((height - 32) * 16) / 9)
      this.renderer.resize(Math.max(0, Math.floor(w)), Math.max(0, Math.floor((w * 9) / 16)))
      if (this.poster) Object.assign(this.poster.style, { width: `${Math.floor(w)}px`, height: `${Math.floor((w * 9) / 16)}px` })
      this.dirty = true
    })
    this.resizeObserver.observe(this.wrapTarget)

    this.startWorker()
    this.tick = this.tick.bind(this)
    this.raf = requestAnimationFrame(this.tick)

    // CodeMirror is only needed here, so it loads with the editor instead of on every page
    const { createEditor } = await import("editor/code_editor")
    if (!this.element.isConnected) return
    const local = this.scene.id ? null : load(STORAGE_KEY, null)
    this.editor = createEditor(this.codeTarget, this.sceneValue.code ?? local ?? FIRST_EXAMPLE, {
      onChange: code => {
        this.dispatch("changed", { detail: { code } })
        clearTimeout(this.errorTimer)
        if (!this.opening) this.edited()
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
          this.cursorMoved = true
        }
      },
    })
    this.requestRun(this.editor.code)
    this.renderHome()
    // Code from before scenes were saved here becomes your first scene
    if (local != null) this.edited()
    this.dispatch("ready")
  }

  showPoster() {
    let src = null
    try { src = sessionStorage.getItem(POSTER_KEY); sessionStorage.removeItem(POSTER_KEY) } catch { /* storage unavailable */ }
    if (!src) return
    this.poster = el("img", "app__poster")
    this.poster.src = src
    this.poster.alt = ""
    this.wrapTarget.append(this.poster)
  }

  dropPoster() {
    const poster = this.poster
    if (!poster) return
    this.poster = null
    poster.classList.add("app__poster--out")
    setTimeout(() => poster.remove(), 700)
  }

  disconnect() {
    cancelAnimationFrame(this.raf)
    clearTimeout(this.debounce)
    clearTimeout(this.errorTimer)
    this.resizeObserver.disconnect()
    window.removeEventListener("pagehide", this.onPageHide)
    this.save({ keepalive: true })
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
    this.runCode = this.pendingCode
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
          this.dropPoster()
        }
        this.setStatus(`rendering… ${this.store.length} frames`, "busy")
        this.timelineDirty = true
        this.dirty = true
        return
      case "done":
        this.busy = false
        if (msg.id === this.runSeq && this.incoming) {
          clearTimeout(this.errorTimer)
          this.incoming.done = true
          this.store = this.incoming
          this.clearError()
          this.updateSceneSelect(msg.scenes, msg.scene)
          this.sceneNameTargets.forEach(t => t.textContent = msg.scene)
          this.setStatus(`✓ ${msg.frames} frames in ${Math.round(msg.ms)}ms`, "ok")
          this.timelineDirty = true
          this.dirty = true
          this.playFromWaiting()
          if (this.view === "home") this.renderHome()
          this.dispatch("rendered", { detail: { code: this.runCode, frames: msg.frames } })
        }
        this.dispatchRun()
        return
      case "cancelled":
        this.busy = false
        this.dispatchRun()
        return
      case "error":
        this.busy = false
        if (msg.id === this.runSeq || msg.id === -1) this.showErrorWhenQuiet(msg)
        this.dispatchRun()
        return
    }
  }

  setStatus(text, kind) {
    this.statusTarget.textContent = text
    this.statusTarget.dataset.kind = kind
  }

  showErrorWhenQuiet({ message, line, traceback }) {
    clearTimeout(this.errorTimer)
    const show = () => {
      this.showError(message, line, traceback)
      this.dispatch("failed", { detail: { message, line } })
    }
    const wait = ERROR_QUIET_MS - (Date.now() - (this.editedAt ?? 0))
    if (wait > 0) this.errorTimer = setTimeout(show, wait)
    else show()
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

    const edited = this.editedAt
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

  // Your other scenes, newest first, to switch to.
  renderOthers() {
    const others = this.scenes.filter(s => s.id !== this.scene.id).slice(0, 5)
    this.othersTarget.replaceChildren(...others.map(s => {
      const b = el("button", "scene-card")
      b.dataset.action = "editor#openScene shell#show"
      b.dataset.editorIdParam = s.id
      b.dataset.shellViewParam = "code"
      const text = el("div", "stack stack--6")
      text.append(el("span", "scene-card__name", s.name), el("span", "mono-sm c-faint", `edited ${ago(Date.parse(s.edited_at))}`))
      b.append(el("div", "scene-card__thumb"), text)
      return b
    }))
  }

  async newScene() {
    await this.save()
    this.switchTo({ id: null })
    this.replaceCode(BLANK)
  }

  async openScene({ params: { id } }) {
    await this.save()
    const response = await fetch(`${this.scenesUrlValue}/${id}`, { headers: { Accept: "application/json" } })
    if (!response.ok) return this.setSaved("couldn’t open that scene", "red")
    const scene = await response.json()
    this.switchTo(scene)
    this.cursorLine = scene.cursor_line ?? null
    this.editedAt = Date.parse(scene.edited_at)
    // Opening isn't an edit: no save, and it stays where it is in your list
    this.opening = true
    try { this.replaceCode(scene.code) } finally { this.opening = false }
    if (this.cursorLine) this.editor.revealLine(this.cursorLine)
  }

  switchTo(scene) {
    this.scene = { id: scene.id ?? null }
    this.cursorMoved = false
    this.showSceneInUrl()
    this.renderOthers()
    this.setSaved("saved", "green")
  }

  // ---------------------------------------------------------------------------
  // Saving: every edit, once typing stops, to the server (ScenesController)
  // ---------------------------------------------------------------------------

  edited() {
    this.editedAt = Date.now()
    this.unsaved = true
    this.setSaved("saving…", "yellow")
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.save(), SAVE_MS)
  }

  // Sends what's unsaved, after any save already on its way (so a scene's first save, which makes it, comes first).
  save({ keepalive = false } = {}) {
    clearTimeout(this.saveTimer)
    if (!this.editor || !(this.unsaved || (this.cursorMoved && this.scene.id))) return this.saving
    const scene = this.scene
    const body = JSON.stringify({ scene: { code: this.editor.code, cursor_line: this.cursorLine } })
    this.unsaved = this.cursorMoved = false
    this.saving = this.saving.then(async () => {
      const response = await fetch(scene.id ? `${this.scenesUrlValue}/${scene.id}` : this.scenesUrlValue, {
        method: scene.id ? "PATCH" : "POST", body, keepalive,
        headers: { "Content-Type": "application/json", Accept: "application/json",
          "X-CSRF-Token": document.querySelector("meta[name=csrf-token]")?.content },
      })
      if (!response.ok) throw new Error(`save failed: ${response.status}`)
      const saved = await response.json()
      if (!scene.id) {
        scene.id = saved.id
        forget(OLD_KEYS)
      }
      this.scenes = [saved, ...this.scenes.filter(s => s.id !== saved.id)]
      if (scene === this.scene) {
        this.showSceneInUrl()
        if (!this.unsaved) this.setSaved("saved", "green")
      }
      this.renderOthers()
    }).catch(() => {
      // Tried again on the next edit
      if (scene === this.scene) { this.unsaved = true; this.setSaved("not saved", "red") }
    })
    return this.saving
  }

  setSaved(text, color) {
    this.savedTarget.textContent = text
    this.savedTarget.className = `badge badge--${color} app__saved`
  }

  // A reload opens the same scene
  showSceneInUrl() {
    const url = new URL(location.href)
    if (this.scene.id) url.searchParams.set("scene", this.scene.id)
    else url.searchParams.delete("scene")
    history.replaceState(history.state, "", url)
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

  // Plays from the animation on this line, once the code as it is now has rendered (π's chips: you see what the
  // line you just got does, not the whole scene again).
  playFrom(line) {
    this.playFromLine = line
  }

  playFromWaiting() {
    const section = this.playFromLine && this.store.sections.find(s => s.line === this.playFromLine)
    this.playFromLine = null
    if (!section) return
    this.setFrame(section.start)
    this.setPlaying(true)
  }

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
