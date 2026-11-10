# Everything a nudge needs to know about someone right now: where they are in their local day, what they pledged,
# how much they've worked (Activity), and the values π's copy fills in. For a cheer, built_on is the day it's for.
class Nudge::Context
  # In the editor this recently means they're working right now, and π doesn't interrupt.
  WORKING_NOW = 5.minutes

  attr_reader :user, :pledge, :now, :local_now, :built_on

  def initialize(user, now = Time.current, built_on: nil)
    @user = user
    @pledge = user.pledges.order(:signed_at, :id).last
    @now = now
    @timezone = user.timezone.presence || pledge&.timezone.presence
    @local_now = now.in_time_zone(ActiveSupport::TimeZone[@timezone.to_s] || "UTC")
    @built_on = built_on
  end

  # The day their work counts towards right now: days run 2am to 2am (Activity).
  def today
    Activity.date_for(now, @timezone)
  end

  # Within the 15 minutes after their slot, on a day they work. Nobody without a timezone has a slot.
  def in_slot?
    return false unless pledge && @timezone
    return false if pledge.build_time == "weekends" && !local_now.to_date.on_weekend?

    hour, min = Pledge::SLOTS.fetch(pledge.build_time).split(":").map(&:to_i)
    slot = local_now.change(hour:, min:)
    local_now >= slot && local_now < slot + 15.minutes
  end

  def quiet?
    local_now.hour >= Nudge::QUIET_FROM || local_now.hour < Nudge::QUIET_UNTIL
  end

  # The next morning π may speak: today's, or tomorrow's once it's late.
  def quiet_ends_at
    morning = local_now.change(hour: Nudge::QUIET_UNTIL, min: 0)
    local_now < morning ? morning : morning + 1.day
  end

  # π can reach them: there's a bot, they're on Slack, they haven't stopped it, and the DM hasn't failed.
  def reachable?
    Nudge.configured? && user.slack_id.present? && user.slack_muted_at.nil? && user.slack_dm_failed_at.nil?
  end

  # The last time π messaged them: anything it DMed (User#slack_dmed_at), or for someone held out, the last one it
  # would have.
  def last_messaged_at
    [ user.slack_dmed_at, user.nudges.issued.maximum(:sent_at) ].compact.max
  end

  def just_messaged?
    last_messaged_at.present? && last_messaged_at > now - Nudge::MESSAGE_GAP
  end

  def working_now?
    last_beat = user.activities.maximum(:last_beat_at)
    last_beat.present? && last_beat > now - WORKING_NOW
  end

  # Not quiet hours, π not stopped and not just heard from, under the caps, not in the editor this minute, and
  # today's goal isn't met already.
  def may_nudge?
    return false unless reachable?
    return false if quiet? || just_messaged? || sent_today.count >= Nudge::DAILY_CAP
    return false if user.nudges.issued.real.where.not(kind: "cheer").where(sent_at: now - 7.days..).count >= Nudge::WEEKLY_CAP
    !working_now? && !day(today).completed?
  end

  # A cheer for built_on is still owed: π not stopped, the day's still today or yesterday with its goal still met,
  # and no cheer for that day, or any today, yet.
  def cheer_due?
    return false unless built_on && reachable?
    return false if !(today - 1..today).cover?(built_on) || !day(built_on).completed?

    cheers = user.nudges.issued.cheers
    !cheers.where(built_on:).or(cheers.where(sent_at: local_now.beginning_of_day..)).exists?
  end

  # Owed, and this is a moment π can speak: not quiet hours, nothing else just said.
  def may_cheer?
    cheer_due? && cheer_waits_until.nil?
  end

  # When a cheer owed now can go instead, if not now: once quiet hours end, or MESSAGE_GAP after whatever π last
  # sent them. Nil when now's fine.
  def cheer_waits_until
    return quiet_ends_at if quiet?
    last_messaged_at + Nudge::MESSAGE_GAP if just_messaged?
  end

  def sent_today
    user.nudges.issued.real.where(sent_at: local_now.beginning_of_day..)
  end

  # Their row for a day, or an empty one that knows its goal.
  def day(date)
    @days ||= {}
    @days[date] ||= user.activities.find_or_initialize_by(activity_date: date)
  end

  # Counted afresh: the one kept on them goes stale if they haven't opened the editor since it lapsed.
  def streak = @streak ||= user.recalculate_streak!
  def seconds_total = @seconds_total ||= user.seconds_total
  def last_active_on = @last_active_on ||= user.activities.where(seconds: 1..).maximum(:activity_date)

  # Whether any day has reached its goal yet.
  def any_day_completed?
    user.activities.completed_dates.any?
  end

  # Whole days with nothing since they last worked (or since they pledged, if they never have).
  def days_idle
    since = last_active_on || Activity.date_for(pledge.signed_at, @timezone)
    [ (today - since).to_i - 1, 0 ].max
  end

  # How many days off are ordinary for the pace they pledged: every day leaves none to spare, twice a week leaves
  # a few, and weekend people are away all week. π only asks someone back after more than that (never under two).
  def idle_allowed
    return 7 if pledge.build_time == "weekends"
    [ 2, (7.0 / pledge.days_per_week).ceil ].max
  end

  def lapsed? = days_idle >= idle_allowed

  # The prize they picked, unless it's the postcard, which everyone gets at an hour anyway.
  def prize
    @prize ||= OnboardingHelper::PRIZES.find { |prize| prize[:id] == pledge&.prize && prize[:id] != "postcard" }
  end

  # The scene they edited last, and its latest frame as a picture Slack can fetch (FramesController), if it has one.
  def frame_url
    scene = user.scenes.recent.first
    return unless scene&.frame.present?

    Rails.configuration.x.app_url + Rails.application.routes.url_helpers.frame_path(scene.signed_id(purpose: :frame))
  end

  # What copy can fill in. Anything missing or not worth saying (no streak, no prize picked) is left out, and copy
  # that needs it won't be picked.
  def vars
    @vars ||= {
      idea: pledge&.idea.presence&.then { |idea| "“#{idea.squish.truncate(80)}”" } || "your video",
      local_time: local_now.strftime(local_now.min.zero? ? "%-l%P" : "%-l:%M%P"),
      goal: minutes(day(today).goal_seconds),
      left_today: minutes(day(today).goal_seconds - day(today).seconds),
      hours: (hours(seconds_total) if seconds_total >= 3600),
      prize: prize&.dig(:name),
      prize_hours: (hours(prize[:hours] * 3600) if prize),
      streak: (streak if streak >= 2),
      streak_next: (streak + 1 if streak >= 2),
      **cheer_vars
    }.compact
  end

  private
    # For a cheer: how long they worked on the day it's for, and which day that is from where they are now ("today"
    # or "yesterday", so a cheer held for the morning still reads right). The total only once it's more than that day.
    def cheer_vars
      return {} unless built_on

      seconds = day(built_on).seconds
      { minutes: minutes(seconds, :floor), day: built_on == today ? "today" : "yesterday",
        next_day: built_on == today ? "tomorrow" : "today",
        total: (seconds_total >= 3600 ? hours(seconds_total) : minutes(seconds_total, :floor) if seconds_total >= seconds + 60) }
    end

    # "1 minute", "14 minutes". What's left to do is rounded up, so it's never "0 minutes"; what's done (:floor) is
    # rounded down, so π never says more than they did.
    def minutes(seconds, rounding = :ceil)
      count = [ (seconds / 60.0).public_send(rounding), 1 ].max
      "#{count} #{"minute".pluralize(count)}"
    end

    # "1 hour", "2.5 hours".
    def hours(seconds)
      count = (seconds / 3600.0).floor(1)
      count = count.to_i if count == count.to_i
      "#{count} #{"hour".pluralize(count)}"
    end
end
