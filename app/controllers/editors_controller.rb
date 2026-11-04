class EditorsController < ApplicationController
  # Cross-origin isolation enables SharedArrayBuffer, which lets the page interrupt
  # a running Python bake the instant the code changes.
  before_action do
    response.set_header "Cross-Origin-Opener-Policy", "same-origin"
    response.set_header "Cross-Origin-Embedder-Policy", "require-corp"
  end

  # ?coach= puts π on top of the editor, coaching a first scene (the remix and wave onboardings).
  def show
    @coach = params[:coach].presence_in(Onboarding::COACHED)
  end
end
