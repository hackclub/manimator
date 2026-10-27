module EditorsHelper
  # Placeholder platform data from the "3a" design. There are no accounts yet, so the
  # streak, hours, buddy and leaderboard are fixed until a backend exists.
  PLACEHOLDER = {
    me: { initial: "A", color: "yellow" },
    streak: 6,
    week: %w[t w t f s s m],
    total: "14h 20m",
    buddy: {
      handle: "@noether", initial: "N", color: "purple", since: "oct 3",
      working_on: "epicycles", working_ago: "12m ago",
      note: "That k swing is great. Slow it down a little?", note_scene: "wave-scene", note_at: 4.1
    },
    shipped: { name: "sine-sweep", status: "shipped oct 19 · in review" },
    board: [
      { rank: 1, handle: "@tau_not_pi", initial: "T", color: "blue", hours: "12h 40m", streak: "11d" },
      { rank: 2, handle: "@noether", initial: "N", color: "purple", hours: "11h 05m", streak: "9d", buddy: true },
      { rank: 3, handle: "@eulers_kid", initial: "E", color: "teal", hours: "9h 52m", streak: "6d" },
      { rank: 4, handle: "you", initial: "A", color: "yellow", hours: "8h 14m", streak: "6d", me: true },
      { rank: 5, handle: "@fourierfan", initial: "F", color: "green", hours: "7h 31m", streak: "3d" },
      { rank: 6, handle: "@gauss.jr", initial: "G", color: "red", hours: "6h 48m", streak: "2d" }
    ],
    board_gap: "1h 38m behind @eulers_kid. One more session passes them."
  }.freeze

  def placeholder
    PLACEHOLDER
  end

  def avatar(initial, color, size: nil)
    tag.span initial, class: [ "avatar", "avatar--#{color}", ("avatar--#{size}" if size) ]
  end

  # One square per day this week; today is the last one and isn't done yet.
  def week_dots(css_class)
    days = placeholder[:week]
    safe_join(days.each_with_index.map { |_, i| tag.span(class: [ css_class, ("#{css_class}--done" if i < placeholder[:streak]) ]) })
  end
end
