# Hourly: whether each nudge whose window has closed worked, held-out ones included (see Nudge#score!).
class NudgeScoringJob < ApplicationJob
  def perform
    Nudge.score_due
  end
end
