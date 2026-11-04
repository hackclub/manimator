// Remix first: a scene that's already playing, and three small changes to it. Each step is done once a render
// has the change in it, so typing alone doesn't count; the scene has to run.
const SNIPPET_COLORS = "PINK, TEAL or ORANGE"

export default {
  intro: "This scene is running in your browser right now. Let’s change it.",
  code: `from manim import *


class OddSquares(Scene):
    def construct(self):
        n = 4
        size = 0.6
        colors = [YELLOW, BLUE, GREEN, PURPLE, TEAL, RED]
        corner = np.array([-(n - 1) * size / 2, -(n - 1) * size / 2 + 0.6, 0])

        for k in range(n):
            # The k-th odd number, 2k + 1, wrapped around the square as an L
            l_shape = VGroup(*[
                Square(side_length=size, color=colors[k % 6], fill_opacity=0.7).move_to(corner + np.array([x, y, 0]) * size)
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
      say: "Odd numbers stack into squares. Change n = 4 to 6 and watch it grow.",
      at: /^\s*n\s*=/,
      done: code => /^\s*n\s*=\s*(?!4\b)\d+/m.test(code),
      show: code => code.replace(/^(\s*n\s*=\s*)\d+/m, "$16"),
      cheer: "Six odd numbers, six squared. It works every time.",
    },
    {
      say: `Now make it yours. Swap YELLOW for another color, like ${SNIPPET_COLORS}.`,
      at: /^\s*colors\s*=/,
      done: code => /^\s*colors\s*=\s*\[\s*(?!YELLOW\b)[A-Z_]+/m.test(code),
      show: code => code.replace(/^(\s*colors\s*=\s*\[\s*)YELLOW/m, "$1PINK"),
      cheer: "Much better.",
    },
    {
      say: "Last one: slow it down. Change run_time=0.8 to 2, or drag a clip’s right edge in the timeline.",
      at: /run_time=/,
      done: code => /LaggedStart[\s\S]*run_time\s*=\s*(?!0\.8\b)[\d.]+/.test(code),
      show: code => code.replace(/run_time=0\.8/, "run_time=2"),
      cheer: "There. Now people can follow along.",
    },
  ],
  finish: {
    say: "That’s you animating in manim. What do you want to make for real?",
    cta: "Pick your idea →",
  },
}
