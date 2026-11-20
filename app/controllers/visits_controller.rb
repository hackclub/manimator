# Where you are in onboarding, as the story goes (OnboardingVisit): it sends the beat you're on and your answers so
# far at each step, so we know where people stop, and can set you back there when you return.
class VisitsController < ApplicationController
  # Mail clients' one-click unsubscribe (List-Unsubscribe-Post) has no CSRF token; the link's token is enough.
  skip_forgery_protection only: :confirm_unsubscribe
  before_action :find_by_token, only: %i[unsubscribe confirm_unsubscribe]

  def update
    visit = OnboardingVisit.for(visitor_id)
    visit.user ||= current_user
    attributes = params.expect(visit: [ :step, :question_index, :k, :referrer, :email, :email_source, :first_name, :email_skipped, :restart, answers: {}, utm: {} ])
    return visit.restart! && head(:no_content) if attributes[:restart].present?
    visit.record!(
      step: attributes[:step].to_s.first(40),
      question_index: attributes[:question_index].presence&.to_i,
      answers: attributes[:answers]&.to_h,
      k: attributes[:k].presence&.to_f,
      referrer: attributes[:referrer],
      utm: attributes[:utm]&.to_h
    )
    visit.remember_email!(attributes[:email], source: attributes[:email_source], first_name: attributes[:first_name]) if attributes[:email].present?
    visit.email_skipped! if attributes[:email_skipped].present?
    head :no_content
  rescue ActiveRecord::RecordInvalid
    head :unprocessable_content
  end

  # Asks before unsubscribing, since mail scanners open links ahead of people.
  def unsubscribe
  end

  def confirm_unsubscribe
    @visit.unsubscribe!
    redirect_to visit_unsubscribe_path(@visit.followup_token)
  end

  private
    def find_by_token
      @visit = OnboardingVisit.find_by(followup_token: params[:token].to_s)
      redirect_to root_path unless @visit
    end
end
