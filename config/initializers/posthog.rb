# PostHog, in the browser only for now (app/views/layouts/_posthog.html.erb), as hackclub/wrong-tool sets it up. The
# project token and host come from credentials (posthog.project_token, posthog.host) or POSTHOG_PROJECT_TOKEN and
# POSTHOG_HOST. Without both, nothing is sent and app/javascript/analytics.js only logs.
posthog = ->(key) { Rails.application.credentials.dig(:posthog, key) || ENV["POSTHOG_#{key.upcase}"] }

Rails.application.config.x.posthog_project_token = posthog.(:project_token)
Rails.application.config.x.posthog_host = posthog.(:host)
# Tests would otherwise send real events.
Rails.application.config.x.posthog_configured =
  Rails.application.config.x.posthog_project_token.present? && Rails.application.config.x.posthog_host.present? && !Rails.env.test?
