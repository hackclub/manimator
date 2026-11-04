// Remix first: a scene that's already playing, and four small changes to it, each explained. You don't need to
// understand the whole scene, only the line you're changing. A step counts once a render has it in.
const n = code => /^\s*n\s*=\s*(\d+)/m.exec(code)?.[1]

export default {
  intro: "This scene is running in your browser. You don’t need to understand all of it. We’ll change a few things.",
  code: `from manim import *


class OddSquares(Scene):
    def construct(self):
        n = 4
        size = 0.6
        colors = [YELLOW, BLUE, GREEN, PURPLE, TEAL, RED, PINK, ORANGE, GOLD, MAROON]
        corner = np.array([-(n - 1) * size / 2, -(n - 1) * size / 2 + 0.6, 0])

        for k in range(n):
            # The k-th odd number, 2k + 1, wrapped around the square as an L
            l_shape = VGroup(*[
                Square(side_length=size, color=colors[k % 10], fill_opacity=0.7).move_to(corner + np.array([x, y, 0]) * size)
                for x in range(k + 1) for y in range(k + 1) if x == k or y == k
            ])
            self.play(LaggedStart(*[FadeIn(s, scale=0.5) for s in l_shape], lag_ratio=0.1), run_time=0.8)

        odds = " + ".join(str(2 * k + 1) for k in range(n))
        total = MathTex(odds + " = " + str(n) + "^{" + str(n) + "}", font_size=48).to_edge(DOWN)
        self.play(Write(total))
        self.wait()
`,
  steps: [
    {
      say: "Line 6 says `n = 4`: stack the first 4 odd numbers, 1 + 3 + 5 + 7, and you get a 4 × 4 square. Change the 4 to a 6.",
      at: /^\s*n\s*=/,
      done: code => /^\s*n\s*=\s*(?!4\b)\d+/m.test(code),
      show: code => code.replace(/^(\s*n\s*=\s*)\d+/m, "$16"),
      cheer: "1 + 3 + 5 + 7 + 9 + 11 = 36, which is 6 × 6. It works for every n.",
    },
    {
      say: "Line 8 is the list of colors, one per layer. Change `YELLOW` to `PINK`.",
      at: /^\s*colors\s*=/,
      done: code => /^\s*colors\s*=\s*\[\s*(?!YELLOW\b)[A-Z_]+/m.test(code),
      show: code => code.replace(/^(\s*colors\s*=\s*\[\s*)YELLOW/m, "$1PINK"),
      cheer: "Pink it is.",
    },
    {
      say: "On line 17, `run_time=0.8` is how many seconds each layer takes. Make it `2`.",
      at: /run_time=/,
      done: code => /LaggedStart[\s\S]*run_time\s*=\s*(?!0\.8\b)[\d.]+/.test(code),
      show: code => code.replace(/run_time=0\.8/, "run_time=2"),
      cheer: "Slower is easier to follow.",
    },
    {
      say: "A trick: hold Alt (⌥ on a Mac) and drag the number on line 6 left and right. The scene changes as you drag.",
      at: /^\s*n\s*=/,
      done: (code, { start }) => n(code) !== n(start),
      cheer: "That works on any number in the code.",
    },
  ],
  finish: {
    say: "That’s you animating in manim. What do you want to make for real?",
    cta: "Pick your idea →",
  },
}
