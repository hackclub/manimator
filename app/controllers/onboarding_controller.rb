class OnboardingController < ApplicationController
  def show
    variant = Onboarding.pick(cookie: cookies[Onboarding::COOKIE], requested: (params[:variant] if Rails.env.development?))
    cookies[Onboarding::COOKIE] = { value: variant, expires: 1.year }

    case variant
    when "pledge" then render :pledge
    when "none" then redirect_to editor_path
    else redirect_to editor_path(coach: variant)
    end
  end

  def pledge
  end
end
