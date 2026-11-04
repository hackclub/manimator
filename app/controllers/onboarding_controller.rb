class OnboardingController < ApplicationController
  def show
    variant = Onboarding.pick(cookie: cookies[Onboarding::COOKIE], requested: (params[:variant] if Rails.env.development?))
    cookies[Onboarding::COOKIE] = { value: variant, expires: 1.year }

    case variant
    when "none" then redirect_to editor_path
    end
  end
end
