class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  private

  # Whoever this is, until there are accounts: a random id kept in a cookie.
  def visitor_id
    cookies.permanent.signed[:visitor_id] ||= SecureRandom.uuid
  end
end
