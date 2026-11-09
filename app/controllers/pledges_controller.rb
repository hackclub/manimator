# Keeps what someone signed on the pledge page (Pledge), for nudges.
class PledgesController < ApplicationController
  def create
    pledge = Pledge.new(pledge_params.merge(visitor_id:, user: current_user, signed_at: Time.current))
    pledge.days_per_week = 2 if pledge.build_time == "weekends"
    pledge.save ? head(:created) : render(json: pledge.errors, status: :unprocessable_content)
  end

  private

  def pledge_params
    params.expect(pledge: [ :name, :idea, :idea_record_id, :for_whom, :prize, :build_time, :days_per_week, :session_minutes, :timezone, :ship_by ])
  end
end
