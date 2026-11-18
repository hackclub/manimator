class OnboardingController < ApplicationController
  # Onboarding is a story: π and its friends walk you through it while the editor assembles itself around you, and
  # signing keeps a Pledge.
  def show
    render :story
  end
end
