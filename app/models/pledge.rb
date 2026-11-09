# What someone signed at the end of onboarding (the pledge page): their idea, who it's for, the prize, and when and
# how long they'll work. Nudges read it: the time to send, the pace, the finish date, and the words to fill in.
class Pledge < ApplicationRecord
  # Who you're making it for: how the chip reads, how the pledge says it, and how π says it back to you.
  FOR = {
    "younger_me" => { label: "Younger me", pledge: "someone like me a few years ago", you: "younger you" },
    "friend" => { label: "A friend who’s stuck", pledge: "a friend who’s stuck", you: "your friend" },
    "class" => { label: "My class", pledge: "my class", you: "your class" },
    "internet" => { label: "Anyone on the internet", pledge: "someone on the internet", you: "the internet" }
  }.freeze

  # When you'll work, and the local time π messages you for each (wrong-tool's Nudge::SLOTS).
  SLOTS = { "after school" => "15:30", "evening" => "19:00", "late night" => "21:30", "weekends" => "11:00" }.freeze
  DAYS = [ 2, 3, 5, 7 ].freeze
  SESSIONS = { 30 => "half an hour", 60 => "an hour", 90 => "an hour and a half" }.freeze

  # A first video is at least this much work, which is what the finish date counts.
  HOURS_PER_VIDEO = 3

  belongs_to :idea_record, class_name: "Idea", optional: true
  belongs_to :user, optional: true

  validates :visitor_id, :idea, :signed_at, presence: true
  validates :for_whom, inclusion: { in: FOR.keys }, allow_nil: true
  validates :build_time, inclusion: { in: SLOTS.keys }
  validates :days_per_week, inclusion: { in: DAYS }
  validates :session_minutes, inclusion: { in: SESSIONS.keys }
end
