class OnboardingController < ApplicationController
  # Onboarding is a story: π and its friends walk you through it while the editor assembles itself around you, and
  # signing keeps a Pledge. ?pledge still shows the older one-page pledge, to compare against.
  def show
    render params.key?(:pledge) ? :pledge : :story
  end
end
