# Hack Club Auth sends people back here. Signing in starts a fresh session, takes along what you did before signing
# in (your pledge and scenes), and returns you to where you came from.
class SessionsController < ApplicationController
  def create
    user = User.from_omniauth(request.env["omniauth.auth"])
    return_to = safe_return_path(request.env["omniauth.origin"])
    user.adopt!(visitor_id)
    reset_session
    session[:user_id] = user.id
    redirect_to return_to || editor_path
  end

  def failure
    redirect_to root_path, alert: "Couldn't sign you in with Hack Club (#{params[:message].to_s.humanize.downcase})."
  end

  def destroy
    reset_session
    redirect_to root_path
  end

  private
    # Only paths on this site, so the origin can't send people somewhere else.
    def safe_return_path(origin)
      path = URI.parse(origin.to_s).path.presence
      path if path&.start_with?("/") && !path.start_with?("//")
    rescue URI::InvalidURIError
      nil
    end
end
