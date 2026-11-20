# Every 15 minutes: π's one email to people who left onboarding (see OnboardingVisit.follow_up_due).
class OnboardingFollowupJob < ApplicationJob
  def perform
    OnboardingVisit.follow_up_due
  end
end
