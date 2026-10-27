export const EXAMPLES = {
  "Shapes & transforms": `from manim import *


class ShapesScene(Scene):
    def construct(self):
        title = Text("Hello, Hack Club!", font_size=56).to_edge(UP)
        circle = Circle(radius=1.5, color=BLUE, fill_opacity=0.4)
        square = Square(side_length=2.5, color=ORANGE, fill_opacity=0.6)

        self.play(Write(title), Create(circle))
        self.play(Transform(circle, square))
        self.play(circle.animate.shift(RIGHT * 3).rotate(PI / 4).set_color(GREEN))

        dots = VGroup(*[Dot(radius=0.15, color=YELLOW) for _ in range(7)])
        dots.arrange(RIGHT, buff=0.4).shift(DOWN * 2.5)
        self.play(LaggedStart(*[FadeIn(d, shift=UP) for d in dots], lag_ratio=0.15))

        star = Star(n=5, outer_radius=1.2, color=PINK, fill_opacity=0.8).shift(LEFT * 3)
        self.play(ReplacementTransform(dots, star))
        self.play(Indicate(title), Rotate(star, TAU, run_time=2))
        self.play(FadeOut(title, shift=UP), FadeOut(star), FadeOut(circle))
`,

  "ValueTracker + graph": `from manim import *


class WaveScene(Scene):
    def construct(self):
        axes = Axes(x_range=[-4, 4, 1], y_range=[-2, 2, 1], x_length=11, y_length=5)
        k = ValueTracker(1.0)

        graph = always_redraw(
            lambda: axes.plot(lambda x: np.sin(k.get_value() * x), color=YELLOW)
        )
        label = always_redraw(
            lambda: VGroup(MathTex("k ="), DecimalNumber(k.get_value()))
            .arrange(RIGHT, buff=0.2)
            .to_corner(UR)
        )
        dot = always_redraw(
            lambda: Dot(axes.c2p(1, np.sin(k.get_value())), color=RED, radius=0.12)
        )

        self.play(Create(axes), run_time=1.5)
        self.play(Create(graph), FadeIn(label))
        self.add(dot)
        self.play(k.animate.set_value(3.0), run_time=3)
        self.play(k.animate.set_value(0.5), run_time=2, rate_func=there_and_back)
        self.wait()
`,

  "Orbit (updaters)": `from manim import *


class OrbitScene(Scene):
    def construct(self):
        sun = Dot(radius=0.4, color=YELLOW)
        orbit = Circle(radius=2.5, color=GRAY, stroke_width=2)
        planet = Dot(radius=0.18, color=BLUE).move_to(orbit.point_at_angle(0))
        moon = Dot(radius=0.07, color=WHITE)

        speed = 1.2
        planet.add_updater(lambda m, dt: m.rotate(dt * speed, about_point=ORIGIN))
        moon.add_updater(
            lambda m: m.move_to(planet.get_center() + 0.5 * np.array(
                [np.cos(5 * self.time), np.sin(5 * self.time), 0]))
        )
        trail = VMobject(color=BLUE_B, stroke_width=2)
        trail.set_points_as_corners([planet.get_center(), planet.get_center()])
        trail.add_updater(lambda t: t.append_points(
            np.array([t.points[-1], t.points[-1], planet.get_center(), planet.get_center()])))

        self.add(orbit, trail, sun, planet, moon)
        self.play(GrowFromCenter(sun))
        self.wait(4)
        self.play(sun.animate.scale(1.5).set_color(ORANGE), run_time=2)
        self.wait(2)
`,

  "Math intro": `from manim import *


class MathScene(Scene):
    def construct(self):
        eq = MathTex(r"e^{i\\pi} + 1 = 0", font_size=96)
        self.play(Write(eq))
        self.wait(0.5)

        box = SurroundingRectangle(eq, color=YELLOW, buff=0.3)
        self.play(Create(box))
        self.play(VGroup(eq, box).animate.scale(0.6).to_edge(UP))

        plane = NumberPlane(x_range=[-7, 7, 1], y_range=[-3, 3, 1]).shift(DOWN * 0.8)
        self.play(Create(plane), run_time=2)

        vec = Arrow(plane.c2p(0, 0), plane.c2p(2, 1), buff=0, color=GREEN)
        self.play(GrowArrow(vec))
        self.play(Rotate(vec, PI / 2, about_point=plane.c2p(0, 0)))
        brace = Brace(vec, DOWN)
        self.play(Create(brace))
        self.wait()
`,
};
