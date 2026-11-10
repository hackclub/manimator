# Sign-in with Hack Club Auth, over OpenID Connect (https://auth.hackclub.com/docs/oidc-guide), as hackclub/wrong-tool
# does it.
#
# Register the app at https://auth.hackclub.com/developer/apps with the redirect URI <APP_URL>/auth/hackclub/callback,
# then set the client ID and secret in credentials (hack_club_auth: client_id, client_secret) or the environment
# (HACK_CLUB_AUTH_CLIENT_ID, HACK_CLUB_AUTH_CLIENT_SECRET).
hack_club_auth = ->(key) { Rails.application.credentials.dig(:hack_club_auth, key) || ENV["HACK_CLUB_AUTH_#{key.upcase}"] }

# Only what the editor needs: who you are, your Slack ID (for π's messages), whether you're eligible for prizes, and
# your address (for the sticker and the prizes we post).
Rails.application.config.x.hack_club_auth_scopes = %i[openid profile email address slack_id verification_status]

Rails.application.config.middleware.use OmniAuth::Builder do
  provider :openid_connect,
    name: :hackclub,
    issuer: "https://auth.hackclub.com",
    discovery: true,
    response_type: :code,
    scope: Rails.configuration.x.hack_club_auth_scopes,
    client_options: {
      identifier: hack_club_auth.(:client_id),
      secret: hack_club_auth.(:client_secret),
      redirect_uri: hack_club_auth.(:redirect_uri) || "#{ENV.fetch("APP_URL", "http://localhost:3000")}/auth/hackclub/callback"
    }
end

OmniAuth.config.logger = Rails.logger

# Hack Club Auth's whoami (https://github.com/hackclub/auth/pull/279), as hackclub/wrong-tool uses it: the
# browser asks it, with HCA's own session cookie, for the first name of whoever's signed in to Hack Club Auth,
# so the pledge can be signed in their name before OAuth. An HCA admin enables it for our app and allowlists this
# site's origin; it only sees HCA's cookie from a hackclub.com subdomain, and answers nothing anywhere else.
Rails.application.config.x.hack_club_auth_whoami_url =
  ENV.fetch("HACK_CLUB_AUTH_WHOAMI_URL", "https://auth.hackclub.com/api/external/whoami")
