# How long someone worked in the editor on one day, counted from the editor's heartbeats. Theirs by user once they've
# signed in, by visitor id until then (User#adopt! takes a visitor's days along). A day counts towards the streak at
# its goal: twenty minutes, or five on your very first day. Days run 2am to 2am in their timezone, so working past
# midnight still counts for the night before. (hackclub/wrong-tool's StreakActivity, counting heartbeats rather than
# Hackatime.)
class Activity < ApplicationRecord
  DAILY_GOAL_SECONDS = 20 * 60
  FIRST_DAY_GOAL_SECONDS = 5 * 60
  # An hour in the editor is the first prize, a postcard.
  POSTCARD_SECONDS = 60 * 60

  # The editor beats every 30 seconds while you're working. The time between two beats counts, up to MAX_GAP (so a
  # dropped beat isn't lost time); after STOPPED_AFTER without one you'd stopped, and the gap counts for nothing.
  MAX_GAP = 60.seconds
  STOPPED_AFTER = 2.minutes

  belongs_to :user, optional: true

  validates :activity_date, presence: true
  validates :seconds, numericality: { greater_than_or_equal_to: 0 }
  validate :has_owner

  scope :for_range, ->(range) { where(activity_date: range) }

  def first_day?
    !person_days.where(activity_date: ...activity_date, seconds: 1..).exists?
  end

  def goal_seconds
    first_day? ? FIRST_DAY_GOAL_SECONDS : DAILY_GOAL_SECONDS
  end

  def completed?
    seconds >= goal_seconds
  end

  class << self
    # The days that are one person's: by account once they've signed in, by visitor id until then.
    def of(user: nil, visitor_id: nil)
      user ? where(user_id: user.id) : where(user_id: nil, visitor_id: visitor_id.presence || raise(ArgumentError, "whose?"))
    end

    # Which day a moment belongs to. Anything that isn't a real timezone counts as UTC.
    def date_for(time, timezone)
      zone = ActiveSupport::TimeZone[timezone.to_s] || ActiveSupport::TimeZone["UTC"]
      (time.in_time_zone(zone) - 2.hours).to_date
    end

    # One heartbeat from the editor: adds the time since their last one to today (see MAX_GAP and STOPPED_AFTER) and
    # returns today's row. The time is counted here, never taken from the browser. When it carries a signed-in
    # person's day past its goal, their streak is counted again and π hears about it (Nudge.day_completed).
    def beat!(user: nil, visitor_id: nil, timezone: nil, now: Time.current)
      days = of(user:, visitor_id:)
      date = date_for(now, timezone)
      day = days.find_by(activity_date: date) || days.create_or_find_by!(activity_date: date)

      just_completed = false
      # Two beats at once wait their turn here, so neither counts the same gap twice.
      day.with_lock do
        # Their last beat might be on yesterday's row, if they're working across 2am.
        last = [ day.last_beat_at, days.where.not(id: day.id).maximum(:last_beat_at) ].compact.max
        gap = last ? now - last : 0
        next if gap.negative?

        completed_before = day.completed?
        day.seconds += [ gap, MAX_GAP ].min.round if gap <= STOPPED_AFTER
        day.last_beat_at = now
        day.save!
        just_completed = day.completed? && !completed_before
      end

      if user && just_completed
        user.recalculate_streak!
        Sticker.earn(user)
        Nudge.day_completed(user, day.activity_date)
      end
      day
    end

    def total_seconds
      sum(:seconds)
    end

    # The days that reached their goal, oldest first. Call it on one person's days (Activity.of): the first of them
    # with any time is the one that only needs five minutes.
    def completed_dates
      where(seconds: 1..).order(:activity_date).pluck(:activity_date, :seconds).each_with_index.filter_map do |(date, seconds), i|
        date if seconds >= (i.zero? ? FIRST_DAY_GOAL_SECONDS : DAILY_GOAL_SECONDS)
      end
    end

    # Completed days in a row, up to today. Today doesn't break it until it's over. (Also for one person's days.)
    def streak(today)
      dates = completed_dates.to_set
      day = dates.include?(today) ? today : today - 1
      count = 0
      while dates.include?(day)
        count += 1
        day -= 1
      end
      count
    end
  end

  private
    def person_days
      user_id ? Activity.where(user_id:) : Activity.where(user_id: nil, visitor_id:)
    end

    def has_owner
      errors.add(:base, "needs an owner") if user_id.blank? && visitor_id.blank?
    end
end
