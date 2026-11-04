class OnboardingController < ApplicationController
  def show
    variant = Onboarding.pick(cookie: cookies[Onboarding::COOKIE], requested: (params[:variant] if Rails.env.development?))
    cookies[Onboarding::COOKIE] = { value: variant, expires: 1.year }

    variant == "pledge" ? render(:pledge) : redirect_to(editor_path)
  end
end
