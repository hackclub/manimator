import { Controller } from "@hotwired/stimulus"

const WAVE = ["wave_1", "wave_2", "wave_3", "wave_2", "wave_3", "wave_2", "wave_1"]
const DANCE = ["hooray", "dance_1", "dance_2", "dance_3", "dance_2", "dance_1", "hooray"]
const POKE = ["surprised", "tease", "awe", "erm"]
const LINES = ["Every line here is headed somewhere.", "Hey! That tickles.", "3.14159… where was I?", "I’m irrational, not unreasonable.", "Psst. The yellow button."]

// π, the mascot. The hero variant idles and reacts to the particle field;
// the end variant waves when the footer scrolls into view and dances when poked.
export default class extends Controller {
  static targets = ["img", "bubble", "hop"]
  static values = { variant: String, poses: Object }

  connect() {
    this.pose = "plain"
    this.timer = null
    this.hotNow = false
    this.stirring = false
    this.scatteredNow = false
    this.line = 0
    this.pokes = 0
    Object.values(this.posesValue).forEach(src => { new Image().src = src })

    if (this.isHero) {
      this.sequence(WAVE, 150, 900)
      const idle = () => {
        if (!this.timer && !this.hotNow) {
          const r = Math.random()
          r < .45 ? this.sequence(WAVE, 150) : this.flash(r < .75 ? "thinking" : "tease", 1500)
        }
        this.idleTimer = setTimeout(idle, 6500 + Math.random() * 3500)
      }
      this.idleTimer = setTimeout(idle, 7000)
    } else {
      this.observer = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return
        this.observer.disconnect()
        this.sequence(WAVE, 150, 200)
      }, { threshold: .25 })
      this.observer.observe(this.element)
    }
    this.render()
  }

  disconnect() {
    clearTimeout(this.timer)
    clearTimeout(this.idleTimer)
    clearTimeout(this.scatterTimer)
    this.observer?.disconnect()
  }

  get isHero() { return this.variantValue === "hero" }

  hot() { this.hotNow = true; this.render() }
  cold() { this.hotNow = false; this.render() }

  stir({ detail: { on } }) { this.stirring = on; this.render() }

  scattered() {
    this.flash("surprised", 800)
    this.scatteredNow = true
    this.line = 0
    clearTimeout(this.scatterTimer)
    this.scatterTimer = setTimeout(() => { this.scatteredNow = false; this.render() }, 2600)
    this.render()
  }

  poke() {
    this.hop()
    this.pokes++
    if (!this.isHero) return this.sequence(DANCE, 190)
    this.flash(POKE[this.pokes % 4], 900)
    this.line = (this.line + 1) % LINES.length
    this.render()
  }

  sequence(frames, step, delay = 0) {
    clearTimeout(this.timer)
    let i = 0
    const next = () => {
      if (i >= frames.length) { this.timer = null; this.setPose("plain"); return }
      this.setPose(frames[i++])
      this.timer = setTimeout(next, step)
    }
    this.timer = setTimeout(next, delay)
  }

  flash(pose, ms) {
    clearTimeout(this.timer)
    this.setPose(pose)
    this.timer = setTimeout(() => { this.timer = null; this.setPose("plain") }, ms)
  }

  setPose(pose) { this.pose = pose; this.render() }

  hop() {
    this.hopTarget.animate([
      { transform: "translateY(0) scale(1,1)" }, { transform: "translateY(0) scale(1.08,.9)", offset: .15 },
      { transform: "translateY(-40px) scale(.96,1.05)", offset: .5 }, { transform: "translateY(0) scale(1.05,.94)", offset: .85 },
      { transform: "translateY(0) scale(1,1)" }], { duration: 560, easing: "ease-out" })
  }

  render() {
    const pose = this.hotNow && !this.timer ? "hooray" : this.pose
    const src = this.posesValue[pose]
    if (src && this.imgTarget.getAttribute("src") !== src) this.imgTarget.src = src
    this.bubbleTarget.textContent = this.bubbleText
  }

  get bubbleText() {
    if (!this.isHero) return this.hotNow ? "Go go go!" : "See you in the render queue."
    if (this.hotNow) return "Yes! That one."
    if (this.scatteredNow) return "Scattered! Give them a second."
    if (this.line) return LINES[this.line]
    if (this.stirring) return "Stir them up. They always find their way back."
    return LINES[0]
  }
}
