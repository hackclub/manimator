// The idea step's sketches as manim scenes: what the editor opens with after the story, so scene one there is the
// sketch π drew on the story's stage (onboarding/sketches.js), with π's number on its own line near the top, for you to change. Each
// question's scene is a function of its what-if (mode); the body is plain manim a newcomer can read top to bottom, in
// named parts (`# ── The court and the shooter`, editor/parts.js) that the story and the editor show folded.

// Sizes on the story's stage are in units; a Text's font_size is that times 48 / .72 in the editor's manim.
const BODIES = {
  // Why is a Minecraft circle a lie?
  "blocks_wide": mode => `
        # ── The grid
        n = blocks_wide / 2
        off = 0 if blocks_wide % 2 else 0.5  # odd: a block dead centre; even: a corner there
        cell = 2.7 / n
        center = LEFT * 2.6
        reach = int(n) + 1
        spots = range(-reach, reach + 1)

        def inside(i, j):
            return (i + off) ** 2 + (j + off) ** 2 < n ** 2

        def at(i, j):  # the middle of block (i, j)
            return center + RIGHT * (i + off) * cell + UP * (j + off) * cell

        # ── The blocks${mode === "outline" ? `
        def edge(i, j):
            return not (inside(i + 1, j) and inside(i - 1, j) and inside(i, j + 1) and inside(i, j - 1))

        blocks = VGroup(*[Square(side_length=cell, stroke_color=BLACK, stroke_width=1, fill_color=GREEN, fill_opacity=1).move_to(at(i, j))
                          for i in spots for j in spots if inside(i, j) and edge(i, j)])
        count = len(blocks)
` : `
        # each row of blocks is one long green bar…
        blocks, count = VGroup(), 0
        for j in spots:
            row = [i for i in spots if inside(i, j)]
            if row:
                count += len(row)
                bar = Rectangle(width=len(row) * cell, height=cell, stroke_width=0, fill_color=GREEN, fill_opacity=1)
                blocks.add(bar.move_to((at(row[0], j) + at(row[-1], j)) / 2))

        # …with the seams between blocks drawn over the bars, one line per column and per row
        seams = VMobject(stroke_color=BLACK, stroke_width=1)
        for k in spots:
            down = [j for j in spots if inside(k, j) and inside(k + 1, j)]  # the seam right of column k
            if down:
                a, b = at(k, down[0]) + (RIGHT + DOWN) * cell / 2, at(k, down[-1]) + (RIGHT + UP) * cell / 2
                seams.append_points([a, a, b, b])
            across = [i for i in spots if inside(i, k) and inside(i, k + 1)]  # the seam above row k
            if across:
                a, b = at(across[0], k) + (LEFT + UP) * cell / 2, at(across[-1], k) + (RIGHT + UP) * cell / 2
                seams.append_points([a, a, b, b])
        blocks.add(seams)
${mode === "wrong" ? `
        # the blocks whose far corner pokes furthest out of the true circle
        for i in spots:
            for j in spots:
                if inside(i, j) and math.hypot(abs(i + off) + 0.5, abs(j + off) + 0.5) - n > 0.25:
                    blocks.add(Square(side_length=cell, stroke_color=BLACK, stroke_width=1, fill_color=RED, fill_opacity=1).move_to(at(i, j)))
` : ""}`}
        # ── The circle and the labels
        circle = Circle(radius=2.7, color=WHITE, stroke_width=2).move_to(center)
        width = Text(f"{blocks_wide} blocks wide", font_size=37).move_to([3.8, 1.3, 0])
        count = Text(f"{count} blocks${mode === "outline" ? " in the ring" : ""}", font_size=31, color=GRAY).move_to([3.8, 0.3, 0])
        ask = Text("${{ outline: "that's all the ring takes", wrong: "red ones stick out the most", big: "does it ever turn round?" }[mode] ?? "is it round yet?"}", font_size=31, color=YELLOW).move_to([3.8, -1, 0])

        # ── Playing it
        self.play(Create(circle))
        self.play(FadeIn(blocks, lag_ratio=0.02), run_time=2)
        self.play(Write(width), Write(count))
        self.play(Write(ask))
        self.wait(2)`,

  // Why haven't I got the rare drop yet?
  "drop_rate": mode => `
        # ── Rolling the drops
        ${mode === "event" ? "drop_rate = min(drop_rate * 2, 0.99)  # double-drop weekend\n        " : ""}${mode === "pity" ? "pity = 80  # the try it's guaranteed on\n        " : ""}random.seed(7)

        def tries_needed():  # how many tries one player takes to get it
            return math.ceil(math.log(1 - random.random() * 0.999) / math.log(1 - drop_rate))

        need = [${mode === "two" ? "tries_needed() + tries_needed()" : mode === "pity" ? "min(tries_needed(), pity)" : "tries_needed()"} for player in range(100)]
        # ── The 100 players
        players = VGroup(*[Square(side_length=0.44, stroke_width=0, fill_color=DARK_GRAY, fill_opacity=1) for player in range(100)])
        players.arrange_in_grid(rows=10, cols=10, buff=0.12).move_to([-3.65, -0.25, 0])
        tries = ValueTracker(0)

        def light(grid):
            for player, square in enumerate(grid):
                square.set_fill(YELLOW if need[player] <= tries.get_value() else DARK_GRAY, 1)
        players.add_updater(light)

        # ── The labels
        label = Text("100 players, same boss", font_size=28, color=GRAY).next_to(players, UP)
        odds = Text(f"a 1 in {round(1 / drop_rate)} drop", font_size=40).move_to([3.6, 2.4, 0])
        ${{ pity: `rule = Text(f"with a pity timer: it's yours on try {pity}", font_size=27, color=TEAL)`, two: `rule = Text("and you need two of them", font_size=27, color=TEAL)`, event: `rule = Text(f"double-drop weekend: 1 in {round(1 / drop_rate)}", font_size=27, color=TEAL)` }[mode] ?? `rule = Text("")`}
        rule.move_to([3.6, 1.6, 0])
        counter = always_redraw(lambda: Text(f"try {int(tries.get_value())}", font_size=33, color=GRAY).move_to([3.6, 0.7, 0]))
        have = always_redraw(lambda: Text(f"{sum(n <= tries.get_value() for n in need)} of them have ${mode === "two" ? "both" : "it"}", font_size=33, color=YELLOW).move_to([3.6, -0.1, 0]))

        # ── Playing it
        self.play(FadeIn(players, lag_ratio=0.01), Write(label))
        self.play(Write(odds), Write(rule))
        self.add(counter, have)
        self.play(tries.animate.set_value(100), run_time=7, rate_func=linear)
        late = sum(n > 100 for n in need)
        self.play(Write(Text(f"after 100 tries, {late} still ${mode === "two" ? "weren't done" : "had nothing"}", font_size=31, color=RED).move_to([3.6, -1.4, 0])))
        self.wait(2)`,

  // I lost five in a row. Am I bad or unlucky?
  "games": mode => `
        # ── Rolling the games
        ${mode === "good" ? "" : "win_chance = 50  # percent: every game a coin flip\n        "}random.seed(91)
        lost = [random.random() >= win_chance / 100 for game in range(games)]

        # the longest run of ${mode === "win" ? "wins" : "losses"}, and where it starts
        best, start, run = 0, 0, 0
        for game in range(games):
            run = run + 1 if ${mode === "win" ? "not lost[game]" : "lost[game]"} else 0
            if run > best:
                best, start = run, game - run + 1

        # ── The cards
        cards = VGroup()
        for game in range(games):
            square = Square(side_length=0.5, stroke_width=0, fill_color=RED if lost[game] else GREEN, fill_opacity=0.45)
            letter = Text("L" if lost[game] else "W", font_size=19, color=BLACK)
            cards.add(VGroup(square, letter))
        cards.arrange_in_grid(cols=10, buff=0.12).to_edge(LEFT).to_edge(UP, buff=1.2)

        # ── Playing it
        self.play(Write(Text(f"${mode === "long" ? "{games} games this weekend" : "{games} games tonight"}", font_size=40).move_to([3.7, 2, 0])))
        self.play(Write(Text(${mode === "good" ? `f"and you win {win_chance}% of them", font_size=29, color=TEAL` : `"every one a coin flip", font_size=29, color=GRAY`}).move_to([3.7, 1.1, 0])))
        self.play(FadeIn(cards, lag_ratio=0.1), run_time=3)
        streak = cards[start:start + best]
        self.play(*[card[0].animate.set_fill(opacity=1).set_stroke(WHITE, 3) for card in streak])
        self.play(Write(Text(f"${mode === "win" ? "best winning" : "worst losing"} streak: {best}", font_size=33, color=${mode === "win" ? "GREEN" : "RED"}).move_to([3.7, 0, 0])))
        self.play(Write(Text("${mode === "win" ? "got better, or got lucky?" : "bad, or just unlucky?"}", font_size=33, color=YELLOW).move_to([3.7, -1.3, 0])))
        self.wait(2)`,

  // Does anyone in my class share a birthday?
  "people": mode => `
        # ── The class
        days = ${mode === "month" ? 12 : 365}
        center, radius = LEFT * 2.8, 2.7
        spots = [center + radius * np.array([math.cos(TAU * i / people + PI / 2), math.sin(TAU * i / people + PI / 2), 0]) for i in range(people)]
        dots = VGroup(*[Dot(spot, radius=0.16 if people <= 30 else 0.1, color=WHITE) for spot in spots])

        # ── Every pair
        # every pair that could share${mode === "mine" ? ": only the ones with you in" : ""}
        pairs = [(i, j) for i in range(${mode === "mine" ? 1 : "people"}) for j in range(i + 1, people)]
        lines = VMobject(stroke_color=BLUE, stroke_width=1).set_opacity(${mode === "mine" ? 0.6 : "min(0.5, 6 / people)"})
        for i, j in pairs:
            lines.append_points([spots[i], spots[i], spots[j], spots[j]])

        # ── The chance
        # the chance nobody matches, one person at a time
        nobody = 1
        for i in range(people):
            nobody *= ${mode === "mine" ? "(364 / 365) if i else 1" : "(days - i) / days"}

        # ── Playing it
        self.play(FadeIn(dots, lag_ratio=0.05))
        ${mode === "mine" ? `self.play(Write(Text("you", font_size=24, color=YELLOW).next_to(dots[0], UP)), dots[0].animate.set_color(YELLOW))
        ` : ""}self.play(Write(Text(f"${{ grade: "your whole grade: {people} people", month: "you and {people - 1} friends" }[mode] ?? "{people} people in your class"}", font_size=35).move_to([3.8, 2, 0])))
        self.play(Create(lines), run_time=2)
        self.play(Write(Text(f"{len(pairs)} pairs to check", font_size=31, color=BLUE).move_to([3.8, 1.1, 0])))
        self.play(Write(Text(f"chance ${{ mine: "someone shares yours", month: "two share a birth month" }[mode] ?? "two share a birthday"}: {round((1 - nobody) * 100)}%", font_size=31, color=YELLOW).move_to([3.8, 0, 0])))
        self.wait(2)`,

  // Is one large pizza more than two smalls?
  "large": mode => `
        # ── Drawing a pizza
        ${mode === "crust" ? "" : "crust = 0  # inches nobody eats\n        "}${mode === "price" ? "" : "large_price = 19  # dollars\n        "}inch = 2.1 / 9  # the radius of an 18-inch pizza is 2.1 here

        def pizza(diameter, where):
            pie = VGroup()
            radius = diameter / 2 * inch
            if crust:
                pie.add(Circle(radius=radius, stroke_color=LIGHT_BROWN, fill_color=LIGHT_BROWN, fill_opacity=0.7))
                radius = max(0.12, radius - crust * inch)
            pie.add(Circle(radius=radius, color=YELLOW, fill_opacity=0.3))
            for x, y in [(0.45, 0.3), (-0.4, 0.45), (-0.1, -0.5), (0.5, -0.35), (-0.6, -0.15), (0.05, 0.05)]:
                pie.add(Dot([x * radius, y * radius, 0], radius=radius * 0.13, color=RED))
            return pie.move_to(where)

        # ── The pizzas
        big = pizza(large, LEFT * 3.6)
        smalls = VGroup(pizza(12, RIGHT * 1.6), pizza(12, RIGHT * 4.8))

        # ── Playing it
        self.play(GrowFromCenter(big))
        self.play(Write(Text(f"one {large}-inch", font_size=37).move_to([-3.6, 3, 0])))
        self.play(GrowFromCenter(smalls[0]), GrowFromCenter(smalls[1]), FadeIn(Text("or", font_size=40, color=GRAY).move_to([-0.6, 0, 0])))
        self.play(Write(Text("two 12-inch", font_size=37).move_to([3.2, 3, 0])))
        ${mode === "price" ? `self.play(Write(Text(f"\${large_price}", font_size=33, color=GREEN).move_to([-3.6, -2.6, 0])), Write(Text("$11 + $11", font_size=33, color=GREEN).move_to([3.2, -2.6, 0])))
        ` : ""}${mode === "shrink" ? `self.play(big.animate.scale(0.72), run_time=2, rate_func=there_and_back)
        ` : ""}self.play(Write(Text(${{ crust: `f"which has more pizza, if you leave {crust} inches of crust?"`, price: `"which is more pizza for your money?"`, shrink: `"how big does the large have to be to win?"` }[mode] ?? `"which is more pizza?"`}, font_size=33, color=YELLOW).move_to([0, -3.4, 0])))
        self.wait(2)`,

  // What's the best angle to shoot a basketball?
  "shooter_height": mode => `
        # ── The court and the shooter
        ${mode === "tall" ? "shooter_height = shooter_height + 12  # a foot taller\n        " : ""}${mode === "three" ? "" : "feet_out = 15  # the free-throw line\n        "}${mode === "moon" ? "" : "gravity = 1  # of Earth's\n        "}floor = -2.9
        hand = np.array([-4.2 - (feet_out - 15) / 17 * 2.6, -2 + (shooter_height / 12 - 5.5) * 0.41, 0])
        rim = np.array([4.6, 1.2, 0])

        self.add(Line([-7, floor, 0], [7, floor, 0], color=DARK_GRAY))
        self.add(Line([5, floor, 0], [5, 2.5, 0], color=GRAY), Line([4, 1.2, 0], [5, 1.2, 0], color=RED, stroke_width=6))
        shooter = VGroup(Line([hand[0] - 0.25, floor, 0], hand + LEFT * 0.25 + DOWN * 0.15, stroke_width=5), Dot(hand + LEFT * 0.25 + UP * 0.1, radius=0.22))
        self.play(FadeIn(shooter))
        self.play(Write(Text(f"${{ three: "from {feet_out} feet out", moon: "where gravity is {gravity:.2f} of Earth's", tall: "if you were a foot taller" }[mode] ?? "from the free-throw line"}", font_size=31).move_to([-1, 3.4, 0])))

        # ── Three ways in
        # each arc leaves the hand at its angle and drops through the rim
        for angle, color in [(36, BLUE), (45, YELLOW), (55, GREEN)]:
            slope, across, rise = math.tan(angle * DEGREES), rim[0] - hand[0], rim[1] - hand[1]
            bend = (slope * across - rise) / across ** 2
            arc = ParametricFunction(lambda x: hand + np.array([x, slope * x - bend * x * x, 0]), t_range=(0, across), color=color)
            ball = Dot(hand, radius=0.26, color=ORANGE)
            # weaker gravity: the same arc, flown slower
            self.play(Create(arc), MoveAlongPath(ball, arc), run_time=min(4, 1.4 / math.sqrt(gravity)), rate_func=linear)
            self.play(FadeOut(ball), arc.animate.set_stroke(opacity=0.45), FadeIn(Text(f"{angle}°", font_size=27, color=color).next_to(arc.point_from_proportion(0.3), UP)))

        # ── The question
        self.play(Write(Text("${mode === "moon" ? "the ball floats. Does the best angle change?" : "three ways in. Which one drops through cleanest?"}", font_size=29, color=GRAY).move_to([0, -3.5, 0])))
        self.wait(2)`,

  // How far can a stack of books lean off a table?
  "books": mode => `
        # ── The table
        length, edge, top = 2.4, -5, -2
        thick = min(0.44, 4.6 / books)
        self.add(Rectangle(width=2.1, height=1.6, stroke_width=0, fill_color=DARK_GRAY, fill_opacity=1).move_to([-6.05, top - 0.8, 0]))
        self.add(DashedLine([edge, top, 0], [edge, 3, 0], color=GRAY))
        ${mode === "far" ? "self.add(Line([edge + 2 * length, top, 0], [edge + 2 * length, 3, 0], color=YELLOW))\n        " : ""}
        # ── The stack
        # each one sticks out past the one under it: half a ${mode === "cards" ? "card" : "book"} at the top, then a quarter, a sixth…
        stack, reach = VGroup(), 0
        for i in range(books, 0, -1):
            reach += length / (2 * i)
            book = Rectangle(width=length, height=thick, stroke_color=BLACK, stroke_width=2 if thick > 0.2 else 1,
                             fill_color=BLUE if i % 2 else TEAL, fill_opacity=1)
            stack.add(book.move_to([edge + reach - length / 2, top + (books - i + 0.5) * thick, 0]))

        # ── Playing it
        self.play(LaggedStart(*[FadeIn(book, shift=DOWN * 0.3) for book in stack], lag_ratio=0.5), run_time=min(6, 0.4 * books + 1))
        self.play(Write(Text(f"{books} ${mode === "cards" ? "cards" : "books"}", font_size=37).move_to([3.6, 2.2, 0])))
        self.play(Write(Text(f"the top one sticks out {reach / length:.2f} of its length", font_size=27, color=GRAY).move_to([3.2, 1.2, 0])))
        if reach > length:
            self.play(Write(Text("the top one is past the table. Nothing fell.", font_size=27, color=YELLOW).move_to([3.2, 0.3, 0])))
        self.wait(2)`,

  // Do you get less wet running in the rain?
  "distance": mode => `
        # ── The rain
        ${mode === "wind" ? "" : "wind = 0  # out of 10\n        "}trip = distance / 50  # how many bus stops long
        lean = -wind / 10 * 1.1
        random.seed(3)
        rain = VGroup(*[Line([0, 0, 0], [lean * 0.45, -0.45, 0], color=BLUE, stroke_width=2).set_opacity(0.35).move_to([random.uniform(-7.5, 7.5), random.uniform(-4, 4), 0]) for drop in range(70)])

        def fall(drops, dt):
            for drop in drops:
                drop.shift(np.array([lean, -8, 0]) * dt * 0.16)
                if drop.get_y() < -4:
                    drop.shift(UP * 8 + RIGHT * -lean * 1.3)
        rain.add_updater(fall)
        self.add(rain)
        self.play(Write(Text("${{ wind: "with the wind blowing it into your face", hat: "holding a pizza box over your head", far: "all the way to the far side" }[mode] ?? "to the bus stop on the corner"}", font_size=29).move_to([0, 3.5, 0])))

        # ── Walking and running
        # how wet you get: what lands on top of you (more, the longer you're out) plus what you walk into (the same either way)
        going = ValueTracker(0)
        for name, seconds, ground in [("walk", 5.2, 0.5), ("run", 2, -2.9)]:
            done = lambda seconds=seconds: min(1, going.get_value() / seconds)
            self.add(Line([-7, ground, 0], [7, ground, 0], color=DARK_GRAY), Text(name, font_size=31).move_to([-6.3, ground + 1.9, 0]))
            self.add(always_redraw(lambda ground=ground, done=done: VGroup(
                Rectangle(width=0.4, height=1, stroke_width=0, fill_color=WHITE, fill_opacity=1).move_to([-5.6 + 10 * done(), ground + 0.5, 0]),
                Dot([-5.6 + 10 * done(), ground + 1.25, 0], radius=0.24, color=WHITE)${mode === "hat" ? `,
                Rectangle(width=1.1, height=0.16, stroke_width=0, fill_color=YELLOW, fill_opacity=1).move_to([-5.6 + 10 * done(), ground + 1.63, 0])` : ""})))
            on_top = lambda seconds=seconds, done=done: ${mode === "hat" ? "0  # the box catches it" : "round(11 * seconds * done() * trip)"}
            in_front = lambda done=done: round((20 + 52 * wind / 10) * done() * trip)
            self.add(always_redraw(lambda ground=ground, on_top=on_top, in_front=in_front, done=done: Text(
                f"on top {on_top()} + in front {in_front()} = {on_top() + in_front()} drops", font_size=27,
                color=YELLOW if done() >= 1 else GRAY).move_to([0.6, ground + 1.9, 0])))
        self.play(going.animate.set_value(5.2), run_time=5.2, rate_func=linear)
        self.wait(2)`,
}

// A class name out of the video's name: "The Cursed Circle" → TheCursedCircle.
const className = name => {
  const words = String(name).normalize("NFKD").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean)
  const camel = words.map(w => w[0].toUpperCase() + w.slice(1)).join("")
  return /^[A-Za-z]/.test(camel) ? camel : `Scene${camel}`
}

const KNOB = /^ {8}\w+ = -?\d+(\.\d+)?  # /
const number = v => Number.isInteger(+v) ? `${+v}` : `${+(+v).toFixed(2)}`
const quote = s => JSON.stringify(String(s))

// The scene for your idea: lines (to show, with numbers you can find by id) and the source the editor opens with.
// "number" is the line with the number to change on it; v is that number, π's guess if left out.
export function sceneFor(q, n, v, name) {
  const [mode, whatif, , , , next, own] = q.whatifs[n], [before, guess, after = ""] = (own?.code ?? q.code)
  const key = q.code[0].split(" ")[0]
  const value = v ?? guess(mode)
  // The body's other numbers to play with (a plain number with a note, like `gravity = 1  # of Earth's`) move up
  // beside yours, above the folded parts (editor/parts.js), so all of them are in view before anything's opened.
  const body = BODIES[key](mode).split("\n").slice(1), blank = body.findIndex(text => !text.trim())
  const knob = (text, i) => i < (blank < 0 ? body.length : blank) && KNOB.test(text)
  const knobs = body.filter(knob), rest = body.filter((text, i) => !knob(text, i))
  const lines = [
    ["", "from manim import *"],
    ["", "import math, random"],
    ["", ""], ["", ""],
    ["", `class ${className(name)}(Scene):`],
    ["", `    # ${q.title}`],
    ["", `    # What if ${whatif}`],
    ["", `    # Scene two: ${next}.`],
    ["", "    def construct(self):"],
    ...(own?.code ? [["", `        ${q.code[0]}${number(q.code[1](mode))}${q.code[2] ?? ""}`]] : []),
    ["number", `        ${before}${number(value)}${after}`],
    ...knobs.map(text => ["", text]),
    ["", ""],
    ["title", "        # ── The title card"],
    ["title", `        title = Text(${quote(name)}, font_size=48)`],
    ["title", "        if title.width > 12:"],
    ["title", "            title.scale_to_fit_width(12)"],
    ["title", "        self.play(Write(title))"],
    ["title", "        self.wait()"],
    ["title", "        self.play(FadeOut(title))"],
    ["", ""],
    ...rest.map(text => ["", text]),
  ]
  return { lines, code: lines.map(([, text]) => text).join("\n") + "\n" }
}
