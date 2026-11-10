# Everything π says in a nudge: plain, warm and short. What's true, and one easy next step; never guilt. Almost
# nobody clicks through (2 to 5 in a hundred last time), so the message has to be the whole thing.
#
# Each arm has a few wordings, and one is picked at random from those that can be filled in (Nudge#variant is its
# place in the list, so we can see which wording works). %{...} fills in from Nudge::Context#vars. A wording whose
# values aren't there (no streak, no prize picked) isn't picked.
module Nudge::Copy
  ARMS = {
    # The time they booked at the end of their first session has arrived.
    "session" => [
      "It's %{local_time}, the time you booked for %{idea}. It's right where you left it.",
      "You said %{local_time}. %{left_today} on %{idea} and today counts.",
      "This is the time you picked to come back to %{idea}. Change one number first and watch what moves."
    ],
    # Pledged, but no day has reached its goal: what's left of the five minutes, and one tiny thing to do.
    "first_frame" => [
      "%{left_today} more on %{idea} and your first day is done and a π sticker is yours. Change one number and watch what moves.",
      "Your first day takes five minutes and earns you a π sticker. You have %{left_today} to go. Open %{idea}, change one color, and see how it looks.",
      "Five minutes makes a first day, and a π sticker. You're %{left_today} away. Pick any number in %{idea} and make it bigger."
    ],
    # An hour in the editor: the postcard exists. Mailed free with whatever prize they earn; on its own, it's the
    # prize for one video.
    "postcard" => [
      "That's an hour on %{idea}. Your postcard is made, with your last frame on it. It gets mailed free with your %{prize}.",
      "An hour on %{idea}, and your postcard is made: your last frame, printed. It's mailed free with any prize you earn, or on its own for one video."
    ],
    "halfway" => [
      "%{hours} on %{idea}. That's halfway to your %{prize}.",
      "You're halfway to your %{prize}: %{hours} of %{prize_hours}."
    ],
    "done" => [
      "%{hours} on %{idea}. That's all the time your %{prize} takes. Ship what you've made and it's yours.",
      "You've put in the %{prize_hours} for your %{prize}. What's left is shipping it."
    ],
    # A streak of two days or more, and today's goal not met yet.
    "streak_saver" => [
      "%{streak} days in a row on %{idea}. %{left_today} today makes it %{streak_next}.",
      "You've worked %{streak} days running. %{left_today} today keeps it going."
    ],
    # Away for longer than their pace allows: their frame and one tiny thing. Nothing about how long it's been.
    "comeback" => [
      "Here's %{idea} as you left it. Change one number and watch it move. That's enough for today.",
      "%{idea} is saved where you stopped. One small thing: pick a color in it and change it.",
      "No need to finish anything. Open %{idea}, make one thing a little bigger, and see how it looks."
    ],
    # Right after a day's goal. %{day} is "today" or "yesterday", and %{next_day} "tomorrow" or "today", so a cheer
    # held for the morning still reads right.
    "cheer" => [
      "%{minutes} on %{idea} %{day}. That's a day done.",
      "You worked on %{idea} %{day}: %{minutes}. Same time %{next_day}?",
      "%{minutes} %{day}, which makes %{total} on %{idea} so far.",
      "That's %{streak} days in a row on %{idea}. See you %{next_day}?"
    ]
  }.freeze

  # The buttons under every message, and what a screen reader says for the picture.
  OPEN = "Open the editor"
  STOP = "Stop π's messages"
  FRAME_ALT = "The latest frame of your scene"

  # [variant, text] for an arm: one of its wordings that these vars can fill, picked evenly at random. Nil if none can.
  def self.render(arm, vars)
    variants = ARMS.fetch(arm)
    variant = variants.each_index.select { |index| (keys(variants[index]) - vars.keys).empty? }.sample or return
    [ variant, format(variants[variant], vars) ]
  end

  def self.keys(text)
    text.scan(/%\{(\w+)\}/).flatten.map(&:to_sym)
  end
end
