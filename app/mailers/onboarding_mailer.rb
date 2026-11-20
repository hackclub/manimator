# π's one email to someone who left onboarding without signing (OnboardingVisit#follow_up!): a link straight back
# to where they were, and a way to never hear from us again.
class OnboardingMailer < ApplicationMailer
  default from: -> { Rails.configuration.x.mail_from }

  def followup(visit)
    @visit = visit
    @name = visit.first_name.presence
    @idea = visit.answers["idea"].presence
    @back_url = visit.back_url
    @unsubscribe_url = visit.unsubscribe_url
    headers["List-Unsubscribe"] = "<#{@unsubscribe_url}>"
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    mail to: visit.email, subject: @idea ? "π saved “#{@idea}” for you" : "π saved your spot"
  end
end
