class OnboardingController < ApplicationController
  # ?story shows the story version of onboarding (a demo): π and friends walk you through it while the editor
  # assembles itself around you. It saves the same Pledge.
  def show
    render params.key?(:story) ? :story : :pledge
  end
end
