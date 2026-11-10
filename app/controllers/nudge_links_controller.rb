# The links in π's messages (see Nudge::Message), so we know which ones work. /n/<token> counts the click and opens
# the editor. /n/<token>/stop asks before stopping π's messages, since Slack and browsers sometimes open links ahead
# of time; no sign-in needed, the token's enough.
class NudgeLinksController < ApplicationController
  before_action :find_nudge

  def show
    @nudge.clicked!
    redirect_to editor_path
  end

  def stop
  end

  def mute
    @nudge.user.mute_slack!(@nudge)
    redirect_to nudge_stop_path(@nudge.token)
  end

  def unmute
    @nudge.user.unmute_slack!(@nudge)
    redirect_to nudge_stop_path(@nudge.token)
  end

  private
    def find_nudge
      @nudge = Nudge.includes(:user).find_by(token: params[:token])
      redirect_to root_path unless @nudge
    end
end
