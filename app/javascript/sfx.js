import { audio } from "audio"

// Small sounds made on the spot with Web Audio, so they play the instant they're asked for (nothing to fetch). Bells
// and plucks stay in C major pentatonic to sit inside the piano bed. Each one is a no-op until audio is unlocked.
const hz = midi => 440 * 2 ** ((midi - 69) / 12)
const C5 = 72
const PENTA = [0, 2, 4, 7, 9] // C D E G A
const scale = step => C5 + PENTA[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)

function ready() { return audio.on && audio.ctx && audio.ctx.state !== "closed" }

// A glassy bell: a sine with two slightly inharmonic overtones that die faster than it does.
function bell(t, midi, { gain = .12, decay = 1.6, wet = .6, pan = 0 } = {}) {
  const ctx = audio.ctx, out = ctx.createGain(), p = ctx.createStereoPanner()
  p.pan.value = pan
  out.connect(p)
  p.connect(audio.sfx)
  const send = ctx.createGain()
  send.gain.value = wet
  p.connect(send).connect(audio.room)
  ;[[1, 1, decay], [2.01, .35, decay * .45], [3.98, .12, decay * .2]].forEach(([ratio, level, d]) => {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.frequency.value = hz(midi) * ratio
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain * level, t + .005)
    g.gain.exponentialRampToValueAtTime(.0001, t + d)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + d + .05)
  })
}

// A soft pluck, a little like a harp: a triangle through a closing low-pass.
function pluck(t, midi, { gain = .09, decay = .7, wet = .5, pan = 0 } = {}) {
  const ctx = audio.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner()
  o.type = "triangle"
  o.frequency.value = hz(midi)
  f.type = "lowpass"
  f.frequency.setValueAtTime(hz(midi) * 6, t)
  f.frequency.exponentialRampToValueAtTime(hz(midi) * 1.2, t + decay)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + .004)
  g.gain.exponentialRampToValueAtTime(.0001, t + decay)
  p.pan.value = pan
  o.connect(f).connect(g).connect(p)
  p.connect(audio.sfx)
  const send = ctx.createGain()
  send.gain.value = wet
  p.connect(send).connect(audio.room)
  o.start(t)
  o.stop(t + decay + .05)
}

// Band-passed noise that swells and sweeps: air moving.
function air(t, dur, { from = 400, to = 2400, gain = .05, q = 1.2 } = {}) {
  const ctx = audio.ctx, len = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
  src.buffer = buf
  f.type = "bandpass"
  f.Q.value = q
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + dur * .85)
  g.gain.linearRampToValueAtTime(0, t + dur)
  src.connect(f).connect(g).connect(audio.sfx)
  src.start(t)
}

// A sine whose pitch slides: a droplet's bloop, a thump, a pop.
function sweep(t, from, to, dur, { gain = .2, type = "sine" } = {}) {
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + dur * .6)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + .006)
  g.gain.exponentialRampToValueAtTime(.0001, t + dur)
  o.connect(g).connect(audio.sfx)
  o.start(t)
  o.stop(t + dur + .05)
}

export const sfx = {
  // Pressing Start animating: a quick sparkle up, and a breath of air under it.
  launch() {
    if (!ready()) return
    const t = audio.ctx.currentTime + .01
    ;[0, 2, 4, 5, 7].forEach((s, i) => bell(t + i * .045, scale(s + 5), { gain: .07, decay: .9, pan: -.3 + i * .15 }))
    air(t, .35, { from: 600, to: 3200, gain: .035 })
  },

  // π falling for `dur` seconds: twinkles stepping down the scale as the air rushes louder.
  fall(dur) {
    if (!ready()) return
    const t = audio.ctx.currentTime + .01, steps = 6
    for (let i = 0; i < steps; i++) {
      const k = i / steps
      bell(t + dur * k ** .8, scale(11 - i), { gain: .045 + k * .025, decay: .7, wet: .8, pan: (i % 2 ? .2 : -.2) })
    }
    air(t, dur, { from: 300, to: 1600, gain: .045, q: .8 })
  },

  // Landing in the pond: a droplet's bloop, a soft thump, and a C chord that rings out.
  land() {
    if (!ready()) return
    const t = audio.ctx.currentTime + .005
    sweep(t, 320, 1050, .16, { gain: .16 })
    sweep(t, 130, 52, .45, { gain: .28 })
    bell(t + .01, 60, { gain: .1, decay: 2.8, wet: .9 })
    bell(t + .03, 67, { gain: .08, decay: 2.6, wet: .9, pan: -.25 })
    bell(t + .05, 76, { gain: .07, decay: 2.4, wet: 1, pan: .25 })
    bell(t + .09, 84, { gain: .035, decay: 2, wet: 1.2 })
  },

  // Each ring after the first: a quieter, higher bell.
  ring(n) {
    if (!ready()) return
    bell(audio.ctx.currentTime + .005, scale(8 + n * 2), { gain: .04, decay: 1.4, wet: 1.2, pan: n % 2 ? .35 : -.35 })
  },

  // The field washing away: a harp running up.
  reveal(dur = .9) {
    if (!ready()) return
    const t = audio.ctx.currentTime + .01, n = 9
    for (let i = 0; i < n; i++) pluck(t + dur * .55 * (i / n) ** 1.2, scale(i + 2), { gain: .07, pan: -.4 + i * .1 })
    air(t, dur * .7, { from: 800, to: 4000, gain: .025 })
  },

  // π arriving at its spot on the page: a little pop.
  arrive() {
    if (!ready()) return
    const t = audio.ctx.currentTime + .005
    sweep(t, 520, 980, .12, { gain: .12, type: "triangle" })
    bell(t + .02, scale(10), { gain: .05, decay: 1.1, wet: .7 })
  },
}
