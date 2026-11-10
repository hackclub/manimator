# Keeps what someone signed on the pledge page (Pledge), for nudges.
class PledgesController < ApplicationController
  def create
    pledge = Pledge.new(pledge_params.merge(visitor_id:, user: current_user, signed_at: Time.current))
    pledge.days_per_week = 2 if pledge.build_time == "weekends"
    pledge.save ? head(:created) : render(json: pledge.errors, status: :unprocessable_content)
  end

  # When you'll next sit down, which ∞ asks once your first day's done (goal_controller.js). π messages you then.
  def update
    pledge = (signed_in? ? current_user.pledges : Pledge.where(visitor_id:, user_id: nil)).order(:signed_at).last
    return head(:not_found) unless pledge
    at = Time.zone.iso8601(params.expect(pledge: [ :next_session_at ])[:next_session_at].to_s)
    return head(:unprocessable_content) unless at.between?(Time.current, 2.weeks.from_now)
    pledge.update!(next_session_at: at)
    render json: { next_session_at: at.iso8601 }
  rescue ArgumentError
    head :unprocessable_content
  end

  private

  def pledge_params
    params.expect(pledge: [ :name, :idea, :idea_record_id, :for_whom, :prize, :build_time, :days_per_week, :session_minutes, :timezone, :ship_by ])
  end
end
