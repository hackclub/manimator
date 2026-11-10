# π cheering someone on, right after they've worked: the moment a day reaches its goal (Nudge.day_completed), a
# cheer is queued (NudgeCheerJob) and sent then, or first thing in the morning if it's late, or an hour on from
# anything else π's just said (Nudge::MESSAGE_GAP). One per day at most, and never counted against the slot nudges'
# weekly cap: these are earned.
#
# Which of its wordings goes is picked at random (Nudge#variant), and each is scored on whether they come back and
# reach the next day's goal (Nudge#window). People held out get theirs logged and scored too, which is the only way
# to tell whether a cheer does anything: last time 60% came back after one, and 68% came back without.
module Nudge::Cheer
  # Their cheer for that day, if it's still due. Under a lock on them, so two cheers queued at once can't both get
  # past "one a day".
  def self.deliver(context)
    context.user.with_lock do
      if context.may_cheer?
        nudge = context.user.nudges.new(kind: "cheer", arm: "cheer", built_on: context.built_on)
        nudge.deliver!(context.vars)
        nudge if nudge.persisted?
      end
    end
  end
end
