# π's Slack bot (see SlackBot and Nudge). Its token comes from Rails credentials (bin/rails credentials:edit):
#
#   slack:
#     bot_token: xoxb-...
#
# or the environment (SLACK_BOT_TOKEN). The bot needs the chat:write scope, nothing else: posting to someone's Slack
# ID DMs them. Without a token π sends nothing and logs nothing. Tests never have one unless they set it themselves.
slack_bot_token = (Rails.application.credentials.dig(:slack, :bot_token) || ENV["SLACK_BOT_TOKEN"] unless Rails.env.test?)

Rails.application.config.x.slack_bot_token = slack_bot_token.presence
Rails.application.config.x.slack_configured = slack_bot_token.present?

# Where the links and pictures in π's messages point. Slack's servers fetch the pictures, so this has to be an
# address the internet can reach.
Rails.application.config.x.app_url = ENV.fetch("APP_URL", "http://localhost:3000")
