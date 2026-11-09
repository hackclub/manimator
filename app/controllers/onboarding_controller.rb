class OnboardingController < ApplicationController
  def show
    render :pledge
  end

  # A demo of onboarding as the editor scaled down: each answer is a line of a first scene.
  def play
  end
end
