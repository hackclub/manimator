// π, talking you through onboarding: a pose and a speech bubble. Both the pledge page and the editor's coach use it.
const WAVE = ["wave_1", "wave_2", "wave_3", "wave_2", "wave_3", "wave_2", "wave_1"]
const DANCE = ["hooray", "dance_1", "dance_2", "dance_3", "dance_2", "dance_1", "hooray"]

export class Mascot {
  constructor(img, bubble, poses) {
    this.img = img
    this.bubble = bubble
    this.poses = poses
    this.timer = null
    Object.values(poses).forEach(src => { new Image().src = src })
  }

  // `Backticks` in what π says show as code.
  say(text, pose = "speaking") {
    this.bubble.replaceChildren(...(text || "").split("`").map((part, i) => {
      if (i % 2 === 0) return document.createTextNode(part)
      const code = document.createElement("code")
      code.textContent = part
      return code
    }))
    this.bubble.hidden = !text
    this.bubble.classList.remove("mascot__bubble--pop")
    void this.bubble.offsetWidth
    this.bubble.classList.add("mascot__bubble--pop")
    this.pose(pose)
  }

  pose(name) {
    clearTimeout(this.timer)
    this.timer = null
    this.show(name)
  }

  wave(then = "plain") { this.sequence(WAVE, 150, then) }
  dance(then = "hooray") { this.sequence(DANCE, 140, then) }

  sequence(frames, ms, then) {
    clearTimeout(this.timer)
    let i = 0
    const next = () => {
      if (i < frames.length) { this.show(frames[i++]); this.timer = setTimeout(next, ms) }
      else { this.timer = null; this.show(then) }
    }
    next()
  }

  show(name) {
    if (this.poses[name]) this.img.src = this.poses[name]
  }

  stop() { clearTimeout(this.timer) }
}
