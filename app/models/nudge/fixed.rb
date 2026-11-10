# The rules for who gets what. The sit-down they booked goes at the time they booked it; the rest go at their slot,
# and the first that applies wins: their first day, then a milestone, then saving a streak, then asking them back.
# There's nothing for an ordinary day with none of these: no message is better than one with nothing to say.
# "Already sent" counts the ones a held-out person would have got (Nudge.issued), so both groups get the same schedule.
module Nudge::Fixed
  # How long after the time they booked π will still say "you said now" (the job runs every 15 minutes).
  SESSION_LATE = 30.minutes
  # Asking someone back waits this long before asking again, and stops after this many with no work in between.
  COMEBACK_EVERY = 3.days
  COMEBACK_LIMIT = 3

  def self.for(context)
    first_frame(context) || milestone(context) || streak_saver(context) || comeback(context)
  end

  # The time they booked for their next sit-down (Pledge#next_session_at) has arrived. Once per booking.
  def self.session(context)
    at = context.pledge.next_session_at or return
    return unless at <= context.now && at > context.now - SESSION_LATE
    return if issued(context).where(kind: "session", sent_at: at..).exists?
    build(context, "session")
  end

  # Pledged, but no day has reached its goal yet: what's left of the first day's fifteen minutes. Once.
  def self.first_frame(context)
    return if context.any_day_completed? || issued(context).where(kind: "first_frame").exists?
    build(context, "first_frame")
  end

  # Hours in the editor that each milestone is for, in order: the hour that makes a postcard, then halfway to the
  # prize they picked, and there. Each sends once, and reaching a later one first means the earlier ones don't send.
  def self.milestones(context)
    hours = context.prize&.dig(:hours)
    { "postcard" => Activity::POSTCARD_SECONDS / 3600.0, "halfway" => (hours / 2.0 if hours), "done" => hours }.compact
  end

  def self.milestone(context)
    milestones = milestones(context)
    key = milestones.select { |_, hours| context.seconds_total >= hours * 3600 }.keys.last or return
    later = milestones.keys.drop(milestones.keys.index(key))
    return if issued(context).where(kind: "milestone", arm: later).exists?
    build(context, "milestone", arm: key)
  end

  # Sent at their slot, so streak savers come with the day's nudge rather than at 11pm. (Context#may_nudge? has
  # already checked today's goal isn't met.)
  def self.streak_saver(context)
    return unless context.streak >= 2
    return if issued(context).where(kind: "streak_saver", sent_at: context.now - context.streak.days..).exists?
    build(context, "streak_saver")
  end

  # Nothing for more days than their pace allows (Context#lapsed?): their frame and one tiny thing to do.
  def self.comeback(context)
    return unless context.lapsed?

    comebacks = issued(context).where(kind: "comeback")
    return if comebacks.where(sent_at: context.now - COMEBACK_EVERY + 1.hour..).exists? # the slot three days on is fine
    since = context.last_active_on || context.pledge.signed_at.to_date
    return if comebacks.where(sent_at: since.beginning_of_day..).count >= COMEBACK_LIMIT
    build(context, "comeback")
  end

  def self.issued(context) = context.user.nudges.issued

  def self.build(context, kind, arm: kind)
    context.user.nudges.new(kind:, arm:)
  end
end
