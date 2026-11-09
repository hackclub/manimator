class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  helper_method :current_user, :signed_in?

  private
    def current_user
      return @current_user if defined?(@current_user)
      @current_user = User.find_by(id: session[:user_id])
    end

    def signed_in?
      current_user.present?
    end

    # The scenes that are yours: by account once you've signed in, by visitor id until then.
    def scenes
      signed_in? ? current_user.scenes : Scene.where(visitor_id:, user_id: nil)
    end

    # Whoever this is before they sign in: a random id kept in a cookie. Signing in takes along what's kept under it
    # (User#adopt!).
    def visitor_id
      cookies.permanent.signed[:visitor_id] ||= SecureRandom.uuid
    end
end
