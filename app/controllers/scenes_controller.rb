# The editor saving and opening your scenes (Scene). Everything's JSON: the editor switches scenes without reloading,
# so Python stays warm.
class ScenesController < ApplicationController
  def show
    render json: scenes.find(params[:id])
  end

  def create
    scene = scenes.new(scene_params.merge(visitor_id:, edited_at: Time.current))
    scene.save ? render(json: scene.as_json.except(:code), status: :created) : render(json: scene.errors, status: :unprocessable_content)
  end

  def update
    scene = scenes.find(params[:id])
    scene.assign_attributes(scene_params)
    # Moving the cursor saves where it is, but isn't an edit
    scene.edited_at = Time.current if scene.code_changed?
    scene.save ? render(json: scene.as_json.except(:code)) : render(json: scene.errors, status: :unprocessable_content)
  end

  private
    def scene_params
      params.expect(scene: [ :code, :cursor_line, :frame ])
    end
end
