# Writing animation ideas for Manimator

Manimator is a Hack Club program (teenagers, 13–18) where each person makes one short math animation in the style of
3Blue1Brown, using manim (Python), in an in-browser editor. When someone asks for an idea, we hand them one from a
pool, and no two people ever get the same idea. You're writing part of that pool, from Common Core math standards.

## Input
A JSON array of standards: {code, domain, cluster, text, band}.

## Output
Write a JSON array to the output path you're given. One object per idea:

  {"standard": "8.G.B.6", "band": "<copy the standard's band>", "title": "...", "line": "...", "needs": [...]}

- title: 2–6 words, a name for the animation, not the standard. "Pythagoras by rearranging", not "Explaining a proof
  of the Pythagorean theorem". Sentence case. No trailing period.
- line: ONE sentence, at most ~22 words, saying what the viewer SEES happen on screen and why it's satisfying.
  Concrete shapes, numbers, motion. A 13-year-old should get it. No "explore", "visualize", "dive into",
  "journey", "unlock", "beautiful", "elegant", "stunning", no em dashes.
- needs: any of "latex" (needs typeset equations beyond plain text), "graph" (axes / function plots),
  "3d" (needs real 3D: our renderer can't do it, so avoid these unless the idea really can't be 2D), "data"
  (random numbers / statistics plots). Empty array if none.

## What makes a good idea
- Something MOVES and the motion is the explanation: pieces slide, a shape morphs, a point traces a path, a number
  counts up as an area fills. If it would be just as good as a still picture, it's a weak idea.
- Worth at least 3 hours of a beginner's work, and small enough to finish: one idea, a minute or two of video.
- Specific: name actual numbers or shapes ("a 3×4 rectangle of dots splits into...") rather than "show that...".
- Each idea for a standard must be clearly different from the others for that standard (different picture or
  different angle), and avoid repeating ideas you've already written for other standards in your batch.

## How many
About 3 ideas per standard. Write 0–1 for standards that are dull to animate (units, reporting, vocabulary,
"use technology", "interpret in context"), and up to 4 for rich ones. Skip a standard entirely rather than force
a weak idea.

## Renderer
The in-browser renderer supports 2D only: circles, polygons, lines, arrows, braces, text, MathTex (simple),
numbers that count, axes/number lines/number planes, function graphs, parametric curves, transforms, fades, moving
along paths, updaters. No 3D, no images, no sound.

When you're done, reply with only: the number of standards, the number of ideas, and the output path.
