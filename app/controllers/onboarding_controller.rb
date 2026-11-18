class OnboardingController < ApplicationController
  # Onboarding is a story: π and its friends walk you through it while the editor assembles itself around you, and
  # signing keeps a Pledge.
  def show
    render :story
  end

  # Generations of the idea step, each its own page (ideas_genN_controller.js) so they can be compared side by side:
  # what it tries, and what the personas who played it scored it (out of 10; nil until they have).
  IDEA_GENS = {
    1 => { tries: "Pick a question π plays for you, or type your own. π says what you're building.", scores: nil }
  }.freeze

  def ideas
    @gen = (params[:gen] || IDEA_GENS.keys.max).to_i
    head :not_found unless IDEA_GENS.key?(@gen)
  end
end
