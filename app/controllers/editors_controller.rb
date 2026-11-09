class EditorsController < ApplicationController
  # Cross-origin isolation enables SharedArrayBuffer, which lets the page interrupt
  # a running Python bake the instant the code changes.
  before_action do
    response.set_header "Cross-Origin-Opener-Policy", "same-origin"
    response.set_header "Cross-Origin-Embedder-Policy", "require-corp"
  end

  # Opens ?scene= if it's yours, or the one you edited last. Someone who's never typed anything has none yet: the
  # editor makes one on their first edit.
  def show
    @scenes = scenes.recent.select(:id, :name, :edited_at).to_a
    @scene = (scenes.find_by(id: params[:scene]) if params[:scene]) || scenes.recent.first
  end
end
