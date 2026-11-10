# π and its friends, who you meet in the story onboarding and who then live in the editor's rail, one per tool. Each
# friend is its math symbol in the serif, with π's eyes; π is its own drawing. Keyed by the rail view they stand for.
module FriendsHelper
  FRIENDS = {
    "home" => { id: "pi", name: "π", color: "#58C4DD" },
    "code" => { id: "code", name: "{ }", color: "#9A72AC", glyph: "{ }", size: 74, base: 82, eyes: [ [ 38, 50 ], [ 62, 50 ] ] },
    "buddy" => { id: "inf", name: "∞", color: "#83C167", glyph: "∞", size: 104, base: 90, eyes: [ [ 31, 64 ], [ 69, 64 ] ] },
    "board" => { id: "sig", name: "Σ", color: "#FC6255", glyph: "Σ", size: 100, base: 94, eyes: [ [ 42, 40 ], [ 60, 40 ] ] },
    "examples" => { id: "int", name: "∫", color: "#5CD0B3", glyph: "∫", size: 120, base: 96, eyes: [ [ 57, 26 ], [ 70, 23 ] ] }
  }.freeze

  def friend_glyph(view)
    friend = FRIENDS.fetch(view)
    return image_tag("pi_creature/plain.svg", alt: "", class: "friend", draggable: false) unless friend[:glyph]

    eyes = friend[:eyes].map do |x, y|
      tag.g(class: "eye") do
        tag.circle(cx: x, cy: y, r: 8.5, fill: "#fff") + tag.circle(class: "pupil", cx: x + 1.6, cy: y + 1, r: 4.2, fill: "#16181b")
      end
    end
    tag.svg(class: "friend", viewBox: "0 0 100 110", aria: { hidden: true }) do
      tag.text(friend[:glyph], x: 50, y: friend[:base], "text-anchor": "middle", "font-size": friend[:size],
        style: "font-family: var(--serif)", fill: friend[:color]) + safe_join(eyes)
    end
  end
end
