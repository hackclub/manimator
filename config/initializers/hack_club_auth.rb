# Hack Club Auth's whoami (https://github.com/hackclub/auth/pull/279), as hackclub/wrong-tool uses it: the
# browser asks it, with HCA's own session cookie, for the first name of whoever's signed in to Hack Club Auth,
# so the landing page can address them by name. An HCA admin enables it for our app and allowlists this site's
# origin; it only sees HCA's cookie from a hackclub.com subdomain, and answers nothing anywhere else.
Rails.application.config.x.hack_club_auth_whoami_url =
  ENV.fetch("HACK_CLUB_AUTH_WHOAMI_URL", "https://auth.hackclub.com/api/external/whoami")
