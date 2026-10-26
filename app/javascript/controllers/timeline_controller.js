import { Controller } from "@hotwired/stimulus"

const clamp = v => Math.max(0, Math.min(1, v))

// A video-player scrubber pinned to the bottom of the page. Scroll position is
// the playhead; each section is a chapter. Play auto-scrolls; dragging scrubs.
export default class extends Controller {
  static targets = ["chapter", "bar", "play", "time", "track", "head", "tip", "index", "label"]
  static values = { total: Number }

  connect() {
    this.playing = false
    this.segments = this.chapterTargets.map(() => {
      const seg = document.createElement("span"); seg.className = "timeline__seg"
      const fill = document.createElement("span"); fill.className = "timeline__fill"
      seg.append(fill)
      this.trackTarget.prepend(seg)
      return { seg, fill }
    })

    this.onScroll = () => {
      if (this.scrollRaf) return
      this.scrollRaf = requestAnimationFrame(() => { this.scrollRaf = null; this.measure(); this.render() })
    }
    this.onUser = () => { if (this.playing && !this.selfScroll) this.stop() }
    window.addEventListener("scroll", this.onScroll, { passive: true })
    window.addEventListener("resize", this.onScroll)
    ;["wheel", "touchstart", "keydown"].forEach(ev => window.addEventListener(ev, this.onUser, true))
    this.measure()
    this.render()
  }

  disconnect() {
    window.removeEventListener("scroll", this.onScroll)
    window.removeEventListener("resize", this.onScroll)
    ;["wheel", "touchstart", "keydown"].forEach(ev => window.removeEventListener(ev, this.onUser, true))
    cancelAnimationFrame(this.scrollRaf)
    cancelAnimationFrame(this.playRaf)
    this.segments.forEach(({ seg }) => seg.remove())
  }

  measure() {
    const els = this.chapterTargets, first = els[0], last = els[els.length - 1]
    const a = first.getBoundingClientRect(), b = last.getBoundingClientRect()
    this.span = Math.max(1, b.bottom - a.top - window.innerHeight)
    this.offset = -a.top
    this.progress = clamp(this.offset / this.span)
    this.starts = els.map(el => clamp((el.getBoundingClientRect().top - a.top) / this.span))
  }

  chapterAt(f) {
    let i = 0
    this.starts.forEach((s, j) => { if (f >= s - .001) i = j })
    return i
  }

  format(t) { return `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}` }

  render() {
    const f = this.progress, st = this.starts, n = st.length, active = this.chapterAt(f)
    this.segments.forEach(({ seg, fill }, i) => {
      const a = st[i], b = i < n - 1 ? st[i + 1] : 1, w = Math.max(0, b - a)
      seg.style.left = `${a * 100}%`
      seg.style.width = `calc(${w * 100}% - 4px)`
      fill.style.width = `${(w ? clamp((f - a) / w) : f >= a ? 1 : 0) * 100}%`
    })
    this.headTarget.style.left = `${f * 100}%`
    this.timeTarget.textContent = this.format(f * this.totalValue)
    this.indexTarget.textContent = `${active + 1}/${n}`
    this.labelTarget.textContent = this.chapterTargets[active].dataset.chapter
    this.barTarget.classList.toggle("is-shown", this.offset > 80 || this.playing)
    this.playTarget.textContent = this.playing ? "❚❚" : "▶"
    this.playTarget.setAttribute("aria-label", this.playing ? "Pause" : "Play the page")
  }

  scrubTo(f, smooth) {
    this.measure()
    window.scrollBy({ top: f * this.span - this.offset, behavior: smooth ? "smooth" : "auto" })
  }

  toggle() {
    if (this.playing) return this.stop()
    this.playing = true
    this.render()
    const step = () => {
      this.measure()
      if (this.offset >= this.span - 1) return this.stop()
      this.selfScroll = true; window.scrollBy(0, 2); this.selfScroll = false
      this.playRaf = requestAnimationFrame(step)
    }
    this.playRaf = requestAnimationFrame(step)
  }

  stop() {
    cancelAnimationFrame(this.playRaf)
    this.playing = false
    this.render()
  }

  trackFraction(event) {
    const r = this.trackTarget.getBoundingClientRect()
    return clamp((event.clientX - r.left) / r.width)
  }

  down(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    this.scrubbing = true
    if (this.playing) this.stop()
    this.scrubTo(this.trackFraction(event))
  }

  hover(event) {
    const x = this.trackFraction(event)
    this.measure()
    const ch = this.chapterTargets[this.chapterAt(x)].dataset.chapter
    this.tipTarget.hidden = false
    this.tipTarget.style.left = `${x * 100}%`
    this.tipTarget.textContent = `${ch} · ${this.format(x * this.totalValue)}`
    if (this.scrubbing) this.scrubTo(x)
  }

  up() { this.scrubbing = false }

  leave() { if (!this.scrubbing) this.tipTarget.hidden = true }
}
