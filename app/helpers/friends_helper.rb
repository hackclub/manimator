# π and its friends, who you meet in the story onboarding and who then live in the editor's rail, one per tool. Each
# friend is its math symbol in the serif, with π's eyes; π is its own drawing. Keyed by the rail view they stand for.
module FriendsHelper
  FRIENDS = {
    "home" => { id: "pi", name: "π", color: "#58C4DD" },
    "code" => { id: "code", name: "{ }", color: "#9A72AC", glyph: "{ }", size: 74, base: 82, eyes: [ [ 41.3, 47 ], [ 58.7, 47 ] ], round: true },
    "buddy" => { id: "inf", name: "∞", color: "#83C167", glyph: "∞", size: 104, base: 90, eyes: [ [ 31, 39.5 ], [ 69, 39.5 ] ] },
    "board" => { id: "sig", name: "Σ", color: "#FC6255", glyph: "Σ", size: 100, base: 94, eyes: [ [ 43, 25 ], [ 60.3, 25 ] ] },
    "examples" => { id: "int", name: "∫", color: "#5CD0B3", glyph: "∫", size: 120, base: 96, eyes: [ [ 66, 13 ], [ 82, 8 ] ], tilt: -18, round: true }
  }.freeze

  def friend_glyph(view)
    friend = FRIENDS.fetch(view)
    return image_tag("pi_creature/plain.svg", alt: "", class: "friend", draggable: false) unless friend[:glyph]

    eyes = friend[:eyes].map { |x, y| pi_eye(x, y, friend[:tilt] || 0, round: friend[:round]) }
    tag.svg(class: "friend", viewBox: "0 0 100 110", aria: { hidden: true }) do
      tag.text(friend[:glyph], x: 50, y: friend[:base], "text-anchor": "middle", "font-size": friend[:size],
        style: "font-family: var(--serif)", fill: friend[:color]) + safe_join(eyes)
    end
  end

  private

  EYE_R = 6

  # π's eye, from pi_creature/plain.svg: a dome cut flat 0.6r below its middle, a thin dark rim, and a big pupil up
  # and to the right with a glint. (x, y) is the middle of the flat bottom, where it sits. The flat bottom only
  # makes sense resting on an edge (π's bar, Σ's top), so eyes floating free (round:) are the whole circle.
  # The tilt sits on an outer group so the blink's CSS transform doesn't replace it.
  def pi_eye(x, y, tilt, round: false, r: EYE_R)
    n = ->(v) { v.round(2) }
    cy = y - 0.6 * r
    tag.g(transform: "rotate(#{tilt} #{x} #{y})") do
      tag.g(class: "eye") do
        white = { fill: "#fff", stroke: "#16181b", "stroke-width": n[r * 0.1] }
        (round ? tag.circle(cx: x, cy: n[cy], r: r, **white) : tag.path(d: "M#{n[x - 0.8 * r]} #{y}A#{r} #{r} 0 1 1 #{n[x + 0.8 * r]} #{y}Z", **white)) +
          tag.circle(class: "pupil", cx: n[x + 0.44 * r], cy: n[cy - 0.43 * r], r: n[0.4 * r], fill: "#16181b") +
          tag.circle(cx: n[x + 0.29 * r], cy: n[cy - 0.65 * r], r: n[0.13 * r], fill: "#fff")
      end
    end
  end
end
