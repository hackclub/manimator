// Make π wave: build the mascot from shapes, a step at a time, ending with π saying hi to you. Each step is done
// once a render has the change in it.
const before = (code, lines) => code.replace(/(\n[ \t]*self\.wait\(\)\s*)$/, `\n${lines}$1`)

export default {
  intro: "Hi! I’m π. Let’s build me, one line at a time.",
  code: `from manim import *


class HelloPi(Scene):
    def construct(self):
        body = Text("π", font_size=240, color=BLUE)
        self.play(Write(body))
        self.wait()
`,
  steps: [
    {
      say: "That’s me! Mostly. Change BLUE to your favorite color: YELLOW, PINK, GREEN…",
      at: /Text\("π"/,
      done: code => /Text\("π"[^)]*color\s*=\s*(?!BLUE\b)[A-Z_]+/.test(code),
      show: code => code.replace(/(Text\("π"[^)]*color\s*=\s*)BLUE/, "$1YELLOW"),
      cheer: "Ooh. Suits me.",
    },
    {
      say: "I can’t see! Give me eyes: two white circles with dots in them, on top of my head.",
      at: /self\.wait\(\)/,
      done: code => /eyes\s*=/.test(code) && /self\.play\([^)]*eyes/.test(code),
      show: code => before(code, `
        eyes = VGroup(
            VGroup(Circle(radius=0.25, color=WHITE, fill_opacity=1), Dot(radius=0.1, color=BLACK)),
            VGroup(Circle(radius=0.25, color=WHITE, fill_opacity=1), Dot(radius=0.1, color=BLACK)),
        ).arrange(RIGHT, buff=0.1).next_to(body, UP, buff=-1.1)
        self.play(FadeIn(eyes))`),
      cheer: "I can see! Hi.",
    },
    {
      say: "Make me blink: squash my eyes flat with eyes.animate.stretch(0.1, 1), then stretch them back.",
      at: /self\.wait\(\)/,
      done: code => /eyes\.animate\.stretch\(/.test(code),
      show: code => before(code, `
        self.play(eyes.animate.stretch(0.1, 1), run_time=0.15)
        self.play(eyes.animate.stretch(10, 1), run_time=0.15)`),
      cheer: "Blinking is hard work.",
    },
    {
      say: "Now let me say hi. Put a Text with your name next to me, and Write it.",
      at: /self\.wait\(\)/,
      done: code => /Text\(\s*["'](?!π)[^"']+["'][^\n]*next_to\(\s*body/.test(code) && (code.match(/Write\(/g) || []).length > 1,
      show: code => before(code, `
        hello = Text("hi, it's me!", font_size=48).next_to(body, RIGHT)
        self.play(Write(hello))`),
      cheer: "Hi to you too!",
    },
  ],
  finish: {
    say: "You built me from scratch. Now make something of your own.",
    cta: "Pick your idea →",
  },
}
