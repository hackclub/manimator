# The build line at the foot of Hack Club Auth's sign-in page ("Build b1ca7ed7 from 24 minutes ago"), read off the
# page itself, so the copy of that page π shows through the portal has it too. Kept a minute; nil if HCA doesn't
# answer quickly or the line isn't there.
class HackClubAuthBuild
  LINE = %r{class="welcome-version">\s*Build\s*(?:<a[^>]*>)?\s*([^<\s]+)\s*(?:</a>)?\s*from\s+([^<]+?)\s*</span>}

  def self.current
    Rails.cache.fetch("hack_club_auth_build", expires_in: 1.minute, skip_nil: true) { fetch }
  end

  def self.fetch
    uri = URI.join(Rails.configuration.x.hack_club_auth_url, "/oauth/welcome")
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 2, read_timeout: 3) do |http|
      http.get(uri.request_uri)
    end
    return unless response.is_a?(Net::HTTPSuccess)
    sha, ago = response.body.match(LINE)&.captures
    { sha: CGI.unescapeHTML(sha), ago: CGI.unescapeHTML(ago) } if sha
  rescue StandardError
    nil
  end
end
