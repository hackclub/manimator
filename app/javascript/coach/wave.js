import { insertAfter } from "coach/insert"

// Build π: written for someone who's never seen manim. Each step is one idea and one line, the line to type is in
// a box under π, and the marked line in the editor is where it goes (on a new line under it). A step counts once
// a render has it in.
const EYE = "eye = Circle(radius=0.3, color=WHITE)"
const SHOW_EYE = "self.play(Create(eye))"
const MOVE_EYE = "self.play(eye.animate.shift(UP * 1.2 + LEFT * 0.35))"
const EYE2 = "eye2 = eye.copy().shift(RIGHT * 0.7)"
const SHOW_EYE2 = "self.play(Create(eye2))"
const HELLO = 'hello = Text("hi, it\'s me!").next_to(body, RIGHT)'
const SHOW_HELLO = "self.play(Write(hello))"

export default {
  intro: "Hi! I’m π. The code on the left draws me. Let’s finish me off, one line at a time.",
  code: `from manim import *


class HelloPi(Scene):
    def construct(self):
        body = Text("π", font_size=240, color=BLUE)
        self.play(Write(body))
        self.wait()
`,
  steps: [
    {
      say: "Line 6 makes me, and line 7 puts me on screen. Change `BLUE` on line 6 to `YELLOW`. The picture updates as you type.",
      at: /Text\("π"/,
      done: code => /Text\("π"[^)]*color\s*=\s*(?!BLUE\b)[A-Z_]+/.test(code),
      show: code => code.replace(/(Text\("π"[^)]*color\s*=\s*)BLUE/, "$1YELLOW"),
      cheer: "Ooh. Any color in CAPITALS works: RED, GREEN, PINK, TEAL…",
    },
    {
      say: "I need an eye. Click at the end of line 7, press Enter, and type this. `Circle` makes a circle, and `radius` is how big.",
      type: EYE,
      at: /self\.play\(Write\(body\)\)/,
      done: code => /eye\s*=\s*Circle\(/.test(code),
      show: code => insertAfter(code, /self\.play\(Write\(body\)\)/, EYE),
      cheer: "Hm, nothing showed up. Making something doesn’t put it on screen…",
    },
    {
      say: "…playing it does. On a new line under it, type this. `Create` draws the circle’s outline.",
      type: SHOW_EYE,
      at: /eye\s*=\s*Circle\(/,
      done: code => /self\.play\(\s*Create\(\s*eye\s*\)/.test(code),
      show: code => insertAfter(code, /eye\s*=\s*Circle\(/, SHOW_EYE),
      cheer: "An eye! In the middle of my body, though.",
    },
    {
      say: "Let’s move it up to my head. `.animate` makes a change happen as a movement, and `shift` moves things: `UP * 1.2` is 1.2 units up.",
      type: MOVE_EYE,
      at: /self\.play\(\s*Create\(\s*eye\s*\)/,
      done: code => /eye\.animate\.shift\(/.test(code),
      show: code => insertAfter(code, /self\.play\(\s*Create\(\s*eye\s*\)/, MOVE_EYE),
      cheer: "Much better. Now I’m winking.",
    },
    {
      say: "Two eyes are better than one. `copy` makes a twin, and `shift` puts it to the right.",
      type: EYE2,
      at: /eye\.animate\.shift\(/,
      done: code => /eye2\s*=\s*eye\.copy\(\)/.test(code),
      show: code => insertAfter(code, /eye\.animate\.shift\(/, EYE2),
      cheer: "Nothing showed up again. You know why!",
    },
    {
      say: "Right: you have to play it. Show the second eye the same way you showed the first.",
      type: SHOW_EYE2,
      at: /eye2\s*=/,
      done: code => /self\.play\(\s*Create\(\s*eye2\s*\)/.test(code),
      show: code => insertAfter(code, /eye2\s*=/, SHOW_EYE2),
      cheer: "I can see! Hi.",
    },
    {
      say: "Last one: let me say something. Type this, and change the words if you like. `next_to(body, RIGHT)` puts it to my right.",
      type: HELLO,
      at: /Create\(\s*eye2\s*\)/,
      done: code => /hello\s*=\s*Text\(/.test(code),
      show: code => insertAfter(code, /Create\(\s*eye2\s*\)/, HELLO),
      cheer: "Nothing yet. You know what’s missing.",
    },
    {
      say: "Show what I’m saying. `Write` writes text out, letter by letter.",
      type: SHOW_HELLO,
      at: /hello\s*=\s*Text\(/,
      done: code => /self\.play\(\s*Write\(\s*hello\s*\)/.test(code),
      show: code => insertAfter(code, /hello\s*=\s*Text\(/, SHOW_HELLO),
      cheer: "Hi to you too!",
    },
  ],
  finish: {
    say: "You just built me from shapes: make a thing, then play it. That’s most of manim. What do you want to make?",
    cta: "Pick your idea →",
  },
}
