require "net/http"

# π's bot, for messages we keep track of (like Nudge): a DM's Slack message (channel and ts), or nil if it didn't
# go. Posting to someone's Slack ID DMs them, without the bot needing im:write. With no token (config/initializers/
# slack.rb) nothing is sent. (hackclub/wrong-tool's SlackBot, over Net::HTTP rather than a Slack gem.)
module SlackBot
  Message = Data.define(:channel, :ts)

  # Slack wants us to slow down. Raised rather than swallowed, so a job tries again later.
  class RateLimited < StandardError; end

  POST_MESSAGE = URI("https://slack.com/api/chat.postMessage")

  def self.dm(slack_id, text:, blocks:)
    unless Rails.configuration.x.slack_configured
      Rails.logger.info("Slack (not configured) to #{slack_id}: #{text}")
      return
    end

    response = post(channel: slack_id, text:, blocks:, unfurl_links: false)
    # Slack fetches a picture before it takes the message, and one it can't reach sinks the lot. The words matter
    # more than the picture, so they go without it.
    if response["error"] == "invalid_blocks" && blocks.any? { |block| block[:type] == "image" }
      response = post(channel: slack_id, text:, blocks: blocks.reject { |block| block[:type] == "image" }, unfurl_links: false)
    end
    raise RateLimited if response["error"] == "ratelimited"
    return Message.new(channel: response["channel"], ts: response["ts"]) if response["ok"]

    Rails.logger.warn("Slack DM to #{slack_id} failed: #{response["error"]}")
    nil
  end

  # What Slack reads as plain words: its three special characters, so nothing someone typed (their idea) can turn
  # into a mention or a link.
  def self.escape(text)
    text.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;")
  end

  # The one call to Slack, and what it answered. Tests replace this.
  def self.post(payload)
    request = Net::HTTP::Post.new(POST_MESSAGE, "Content-Type" => "application/json; charset=utf-8",
                                                "Authorization" => "Bearer #{Rails.configuration.x.slack_bot_token}")
    request.body = payload.to_json
    response = Net::HTTP.start(POST_MESSAGE.host, POST_MESSAGE.port, use_ssl: true, open_timeout: 5, read_timeout: 10) do |http|
      http.request(request)
    end
    return { "ok" => false, "error" => "ratelimited" } if response.code == "429"

    JSON.parse(response.body)
  rescue JSON::ParserError
    { "ok" => false, "error" => "http_#{response.code}" }
  end
end
