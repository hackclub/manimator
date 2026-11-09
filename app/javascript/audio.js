// One audio engine for the whole visit. It lives at module level, so it survives Turbo swapping the page: the piano
// bed that started on the landing page keeps playing into onboarding instead of stopping and loading again, and a
// sound triggered by a click plays at once. Browsers only allow audio after a gesture, so nothing is made until
// unlock() runs inside one (a click, tap or keypress).
//
// The bed is the landing page's music (generated with ElevenLabs, see script/generate_audio.rb). It sits in C major,
// which is what sfx.js tunes its chimes to.
const KEY = "manimator:sound"
const BED_LEVEL = .35
const FADE = 3   // seconds to fade the bed in
const XFADE = 4  // seconds of overlap where the bed loops back to its start
const GRACE = 400 // ms a page change has to bring in a new sound controller before the music fades

const store = {
  get() { try { return localStorage.getItem(KEY) } catch { return null } },
  set(v) { try { localStorage.setItem(KEY, v) } catch {} }
}

const buffers = new Map() // url → Promise<AudioBuffer>
let users = 0, leaveTimer = null

export const audio = {
  ctx: null,
  master: null, // everything
  sfx: null,    // one-shots, dry and through the room
  room: null,   // a soft reverb the one-shots can send into
  bed: null,    // { url, gain, timer }
  on: store.get() !== "off",

  get playing() { return !!(this.on && this.ctx && this.bed) },

  setOn(on) {
    this.on = on
    store.set(on ? "on" : "off")
    on ? this.ctx?.resume() : this.stopBed()
    this.changed()
  },

  // Call from inside a gesture. Returns false when sound is off or Web Audio is missing.
  unlock() {
    if (!this.on) return false
    if (this.ctx) { if (this.ctx.state === "suspended" && !document.hidden) this.ctx.resume(); return true }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return false
    const ctx = this.ctx = new AC()
    this.master = ctx.createGain()
    this.master.connect(ctx.destination)
    this.sfx = ctx.createGain()
    this.sfx.connect(this.master)
    this.room = ctx.createConvolver()
    this.room.buffer = impulse(ctx, 2.6)
    const wet = ctx.createGain()
    wet.gain.value = .5
    this.room.connect(wet).connect(this.master)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) ctx.suspend()
      else if (this.on) ctx.resume()
    })
    return true
  },

  load(url) {
    if (!url || !this.ctx) return Promise.reject()
    if (!buffers.has(url)) {
      const p = fetch(url).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b))
      p.catch(() => buffers.delete(url))
      buffers.set(url, p)
    }
    return buffers.get(url)
  },

  play(buf, { gain = .5, rate = 1 } = {}) {
    if (!this.on || !this.ctx || !buf) return
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain()
    src.buffer = buf
    src.playbackRate.value = rate
    g.gain.value = gain
    src.connect(g).connect(this.sfx)
    src.start()
  },

  // Starts the bed, or carries on with the one already playing.
  async startBed(url) {
    if (!this.unlock() || !url) return
    if (this.bed) return this.fadeBed(BED_LEVEL, FADE)
    const gain = this.ctx.createGain()
    gain.gain.value = 0
    gain.connect(this.master)
    const bed = this.bed = { url, gain, timer: null }
    this.changed()
    let buf
    try { buf = await this.load(url) } catch { if (this.bed === bed) this.stopBed(); return }
    if (this.bed !== bed) return
    this.loopBed(buf, this.ctx.currentTime + .05)
    this.fadeBed(BED_LEVEL, FADE)
  },

  // Plays the bed from `t` and schedules the next copy to start XFADE seconds before this one ends, crossfading the
  // two so the loop point can't be heard.
  loopBed(buf, t) {
    const bed = this.bed, ctx = this.ctx
    if (!bed) return
    const src = ctx.createBufferSource(), g = ctx.createGain(), len = buf.duration
    src.buffer = buf
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(1, t + XFADE)
    g.gain.setValueAtTime(1, t + len - XFADE)
    g.gain.linearRampToValueAtTime(0, t + len)
    src.connect(g).connect(bed.gain)
    src.start(t)
    src.stop(t + len)
    const next = t + len - XFADE
    bed.timer = setTimeout(() => this.bed === bed && this.loopBed(buf, next), (next - ctx.currentTime - 1) * 1000)
  },

  fadeBed(to, secs) {
    const g = this.bed?.gain.gain, now = this.ctx?.currentTime
    if (!g) return
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(to, now + secs)
  },

  stopBed(secs = 1) {
    const bed = this.bed
    if (!bed) return
    this.fadeBed(0, secs)
    this.bed = null
    clearTimeout(bed.timer)
    setTimeout(() => bed.gain.disconnect(), secs * 1000 + 100)
    this.changed()
  },

  // Sound controllers check in and out. When a page change leaves none behind (the editor, say), the music fades.
  join() { users++; clearTimeout(leaveTimer) },
  leave() {
    users--
    clearTimeout(leaveTimer)
    leaveTimer = setTimeout(() => { if (users <= 0) this.stopBed(1.5) }, GRACE)
  },

  changed() { window.dispatchEvent(new CustomEvent("audio:change")) },
}

// A soft room: stereo noise that dies away, a little darker as it goes.
function impulse(ctx, secs) {
  const len = Math.round(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const k = i / len
      lp += (Math.random() * 2 - 1 - lp) * (.5 - k * .4)
      d[i] = lp * (1 - k) ** 3
    }
  }
  return buf
}
