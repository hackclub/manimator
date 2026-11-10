# A scene's latest frame as a picture (Scene#frame), for π's Slack messages to show. The address is the scene's
# signed id, so it can't be guessed, and Slack's servers fetch it: no cookies, no sign-in, no browser check.
class FramesController < ActionController::Base
  def show
    scene = Scene.find_signed(params[:id], purpose: :frame)
    return head(:not_found) unless scene&.frame.present?

    # The picture changes as they keep working, so a short cache, then a check of when it was last taken.
    expires_in 5.minutes, public: true
    send_data scene.frame_jpeg, type: "image/jpeg", disposition: "inline" if stale?(last_modified: scene.frame_at, public: true)
  end
end
