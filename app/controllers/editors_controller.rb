class EditorsController < ApplicationController
  # Cross-origin isolation enables SharedArrayBuffer, which lets the page interrupt
  # a running Python bake the instant the code changes.
  before_action do
    response.set_header "Cross-Origin-Opener-Policy", "same-origin"
    response.set_header "Cross-Origin-Embedder-Policy", "require-corp"
  end

  def show
  end
end
