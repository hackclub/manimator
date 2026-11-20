# Every 5 minutes: who's due π's follow-up email (OnboardingVisit.follow_up_due), then everyone changed since last
# time over to Airtable, where Hack Club's sync carries them to Loops, which sends it (OnboardingVisit::LoopsSync).
class OnboardingFollowupJob < ApplicationJob
  limits_concurrency to: 1, key: "onboarding_followup", duration: 10.minutes, on_conflict: :discard

  def perform
    OnboardingVisit.follow_up_due
    OnboardingVisit::LoopsSync.run
  end
end
