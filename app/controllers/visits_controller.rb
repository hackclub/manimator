# Where you are in onboarding, as the story goes (OnboardingVisit): it sends the beat you're on and your answers so
# far at each step, so we know where people stop, and can set you back there when you return.
class VisitsController < ApplicationController
  def update
    visit = OnboardingVisit.for(visitor_id)
    visit.user ||= current_user
    attributes = params.expect(visit: [ :step, :question_index, :k, :referrer, answers: {}, utm: {} ])
    visit.record!(
      step: attributes[:step].to_s.first(40),
      question_index: attributes[:question_index].presence&.to_i,
      answers: attributes[:answers]&.to_h,
      k: attributes[:k].presence&.to_f,
      referrer: attributes[:referrer],
      utm: attributes[:utm]&.to_h
    )
    head :no_content
  rescue ActiveRecord::RecordInvalid
    head :unprocessable_content
  end
end
