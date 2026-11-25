# Sign-in with Hack Club Auth, over OpenID Connect (https://auth.hackclub.com/docs/oidc-guide), as hackclub/wrong-tool
# does it.
#
# Register the app at https://auth.hackclub.com/developer/apps with the redirect URI <APP_URL>/auth/hackclub/callback,
# then set the client ID and secret in credentials (hack_club_auth: client_id, client_secret) or the environment
# (HACK_CLUB_AUTH_CLIENT_ID, HACK_CLUB_AUTH_CLIENT_SECRET).

# Only what the editor needs: who you are, your Slack ID (for π's messages), whether you're eligible for prizes, and
# your address (for the sticker and the prizes we post).
Rails.application.config.x.hack_club_auth_scopes = %i[openid profile email address slack_id verification_status]

# A Hack Club Auth running locally (hackclub/auth's bin/dev), for working on our onboarding scenario there: set
# HACK_CLUB_AUTH_URL to it (http://localhost:3002). Its development issuer is always http://localhost:3000 whatever
# port it's on, so its endpoints are given here rather than discovered. Unset, it's auth.hackclub.com.
local_auth = ENV["HACK_CLUB_AUTH_URL"].presence && URI(ENV["HACK_CLUB_AUTH_URL"])
Rails.application.config.x.hack_club_auth_url = local_auth&.to_s || "https://auth.hackclub.com"
endpoints = if local_auth
  { scheme: local_auth.scheme, host: local_auth.host, port: local_auth.port, authorization_endpoint: "/oauth/authorize",
    token_endpoint: "/oauth/token", userinfo_endpoint: "/oauth/userinfo", jwks_uri: "#{local_auth.to_s.chomp("/")}/oauth/discovery/keys" }
else
  {}
end

# Against a local Hack Club Auth, its own app's ID and secret (the environment's) win over our credentials.
hack_club_auth = ->(key) {
  env = ENV["HACK_CLUB_AUTH_#{key.upcase}"]
  local_auth ? env : Rails.application.credentials.dig(:hack_club_auth, key) || env
}

Rails.application.config.middleware.use OmniAuth::Builder do
  provider :openid_connect,
    name: :hackclub,
    issuer: local_auth ? ENV.fetch("HACK_CLUB_AUTH_ISSUER", "http://localhost:3000") : "https://auth.hackclub.com",
    discovery: !local_auth,
    response_type: :code,
    scope: Rails.configuration.x.hack_club_auth_scopes,
    client_options: {
      identifier: hack_club_auth.(:client_id),
      secret: hack_club_auth.(:client_secret),
      **endpoints
    },
    # The callback goes back to whichever host the sign-in started on, so the session (and its OAuth state) is the
    # same one, on prod, localhost or an ngrok tunnel, without APP_URL having to be right. A credentials/env
    # redirect_uri still wins.
    setup: ->(env) {
      env["omniauth.strategy"].options.client_options.redirect_uri =
        hack_club_auth.(:redirect_uri) || "#{Rack::Request.new(env).base_url}/auth/hackclub/callback"
    }
end

OmniAuth.config.logger = Rails.logger

# Hack Club Auth's whoami (https://github.com/hackclub/auth/pull/279), as hackclub/wrong-tool uses it: the
# browser asks it, with HCA's own session cookie, for the first name of whoever's signed in to Hack Club Auth,
# so the pledge can be signed in their name before OAuth. An HCA admin enables it for our app and allowlists this
# site's origin; it only sees HCA's cookie from a hackclub.com subdomain, and answers nothing anywhere else.
Rails.application.config.x.hack_club_auth_whoami_url =
  ENV.fetch("HACK_CLUB_AUTH_WHOAMI_URL", "https://auth.hackclub.com/api/external/whoami")
