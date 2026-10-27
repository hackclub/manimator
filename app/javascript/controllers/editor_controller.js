import { Controller } from "@hotwired/stimulus"
import { EXAMPLES } from "editor/examples"
import { FrameStore } from "editor/frames"
import { Renderer } from "editor/renderer"

const STORAGE_KEY = "manimator:code"
const FIRST_EXAMPLE = EXAMPLES[Object.keys(EXAMPLES)[0]]

function loadSaved() {
  try { return localStorage.getItem(STORAGE_KEY) ?? FIRST_EXAMPLE } catch { return FIRST_EXAMPLE }
}

function save(code) {
  try { localStorage.setItem(STORAGE_KEY, code) } catch { /* storage unavailable: nothing to do */ }
}

// The live Manim editor: CodeMirror on the left, a canvas on the right, and a
// Pyodide worker in between that re-bakes the scene on every edit.
export default class extends Controller {
  static targets = ["code", "error", "wrap", "stage", "tooltip", "play", "time", "timeline", "sections", "playhead", "chapter", "examples", "scene", "fps", "status"]
  static values = { worker: String, manim: String }

  async connect() {
    // Playback state
    this.renderer = new Renderer(this.stageTarget)
    this.store = null // what's on screen
    this.incoming = null // run in progress, swapped in on its first chunk
    this.frame = 0
    this.playing = false
    this.playClock = { t: 0, frame: 0 }
    this.hoverLine = null
    this.cursorLine = null
    this.dirty = true
    this.renderedSections = 0

    // Python worker: one bake at a time, latest edit wins
    this.interrupt = self.crossOriginIsolated ? new Int32Array(new SharedArrayBuffer(4)) : null
    this.ready = false
    this.busy = false
    this.pendingCode = null
    this.runSeq = 0
    this.sceneName = null

    this.examplesTarget.append(new Option("Examples…", ""), ...Object.keys(EXAMPLES).map(k => new Option(k, k)))

    // Keep the stage at 16:9 inside its pane
    this.resizeObserver = new ResizeObserver(() => {
      const { width, height } = this.wrapTarget.getBoundingClientRect()
      const w = Math.min(width, (height * 16) / 9)
      this.renderer.resize(Math.floor(w), Math.floor((w * 9) / 16))
      this.dirty = true
    })
    this.resizeObserver.observe(this.wrapTarget)

    this.startWorker()
    this.tick = this.tick.bind(this)
    this.raf = requestAnimationFrame(this.tick)

    // CodeMirror is only needed here, so it loads with the editor instead of on every page
    const { createEditor } = await import("editor/code_editor")
    if (!this.element.isConnected) return
    let debounce = 0
    this.editor = createEditor(this.codeTarget, loadSaved(), {
      onChange: code => {
        save(code)
        clearTimeout(debounce)
        debounce = setTimeout(() => this.requestRun(code), 120)
      },
      onScrub: () => {
        clearTimeout(debounce)
        this.requestRun(this.editor.code)
      },
      onCursorLine: line => {
        if (this.cursorLine !== line) { this.cursorLine = line; this.dirty = true }
      },
    })
    this.requestRun(this.editor.code)
  }

  disconnect() {
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.worker?.terminate()
    this.editor?.destroy()
    this.examplesTarget.replaceChildren()
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
    if (this.dirty) this.draw()
    this.raf = requestAnimationFrame(this.tick)
  }

  draw() {
    const { store, frame } = this
    this.dirty = false
    this.renderer.draw(store?.frames[frame], store?.strings ?? [], store?.background ?? "#000", { hoverLine: this.hoverLine, cursorLine: this.cursorLine })
    const fps = store?.fps ?? 30
    const total = store?.length ?? 0
    this.timeTarget.textContent = `${(frame / fps).toFixed(2)} / ${(total / fps).toFixed(2)}s`
    this.playheadTarget.style.left = `${total > 1 ? (frame / (total - 1)) * 100 : 0}%`
    if (store && store.sections.length !== this.renderedSections) this.renderSections()
    const sec = store?.sectionAt(frame)
    // Segments sit at their share of the run, each filling blue as the playhead passes
    const span = Math.max(1, total - 1)
    for (const el of this.sectionsTarget.children) {
      const start = Number(el.dataset.start), end = Math.min(Number(el.dataset.end), total)
      el.style.left = `${(start / span) * 100}%`
      el.style.width = `calc(${(Math.max(0, end - start) / span) * 100}% - 3px)`
      el.firstChild.style.width = `${Math.max(0, Math.min(1, (frame - start) / Math.max(1, end - start))) * 100}%`
    }
    this.chapterTarget.textContent = sec ? `L${sec.line} · ${sec.label}` : ""
    this.editor?.setMarks({ playing: sec?.line ?? null, hover: this.hoverLine })
  }

  renderSections() {
    this.renderedSections = this.store.sections.length
    this.sectionsTarget.replaceChildren(...this.store.sections.map(s => {
      const el = document.createElement("div")
      el.className = "editor__section"
      el.dataset.start = String(s.start)
      el.dataset.end = String(s.end)
      el.title = `line ${s.line}: ${s.label}  (double-click to jump to code)`
      const fill = document.createElement("span")
      fill.className = "editor__fill"
      el.append(fill)
      el.addEventListener("dblclick", () => this.editor?.revealLine(s.line))
      return el
    }))
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
        if (!this.store) this.setPlaying(true)
        return
      case "chunk":
        if (msg.id !== this.runSeq || !this.incoming) return
        this.incoming.append(msg.data, msg.lengths, msg.meta)
        if (this.store !== this.incoming) {
          this.store = this.incoming
          this.renderedSections = -1
          this.setFrame(this.frame)
        }
        this.setStatus(`rendering… ${this.store.length} frames`, "busy")
        this.dirty = true
        return
      case "done":
        this.busy = false
        if (msg.id === this.runSeq && this.incoming) {
          this.incoming.done = true
          if (this.store !== this.incoming) {
            this.store = this.incoming
            this.renderedSections = -1
          }
          this.clearError()
          this.updateSceneSelect(msg.scenes, msg.scene)
          this.setStatus(`✓ ${msg.frames} frames in ${Math.round(msg.ms)}ms`, "ok")
          this.dirty = true
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
    const el = this.errorTarget
    el.hidden = false
    el.replaceChildren()
    const head = document.createElement("div")
    head.className = "editor__error-head"
    head.textContent = line ? `line ${line}: ${message}` : message
    if (line) head.addEventListener("click", () => this.editor?.revealLine(line))
    const tb = document.createElement("pre")
    tb.textContent = traceback
    el.append(head, tb)
    this.editor?.setMarks({ error: line })
    this.setStatus("error", "error")
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
  // Actions
  // ---------------------------------------------------------------------------

  loadExample() {
    const code = EXAMPLES[this.examplesTarget.value]
    this.examplesTarget.value = ""
    if (!code || !this.editor) return
    this.sceneName = null
    this.editor.setDoc(code)
    this.setFrame(0)
    this.setPlaying(true)
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
    if (e.target.closest(".cm-editor, select")) return
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
    this.setFrame(Math.round(t * (this.store.length - 1)))
  }

  scrub(e) {
    const el = this.timelineTarget
    this.setPlaying(false)
    el.setPointerCapture(e.pointerId)
    this.scrubTo(e.clientX)
    const move = ev => this.scrubTo(ev.clientX)
    const up = () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
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
