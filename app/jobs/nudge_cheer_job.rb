# Someone's day just reached its goal (Nudge.day_completed, which says when): whatever π said in the hours before
# it worked (Nudge.worked!), and they get a cheer for the day (Nudge::Cheer). In quiet hours the cheer waits for the
# morning, so a late night's work gets a "yesterday" cheer at 8am rather than nothing; and right after anything else
# π said, it waits the hour (Nudge::MESSAGE_GAP), so no two of its messages land together. If Slack says slow down,
# it tries again.
class NudgeCheerJob < ApplicationJob
  retry_on SlackBot::RateLimited, wait: 1.minute, attempts: 5

  def perform(user_id, built_on, completed_at = nil)
    user = User.find_by(id: user_id)
    return unless user

    Nudge.worked!(user, completed_at) if completed_at && executions == 1

    context = Nudge::Context.new(user, built_on:)
    return unless context.cheer_due?

    if (later = context.cheer_waits_until)
      self.class.set(wait_until: later).perform_later(user_id, built_on)
    else
      Nudge::Cheer.deliver(context)
    end
  end
end
