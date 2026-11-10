require "test_helper"
require "support/nudge_test_helper"

class SlackBotTest < ActiveSupport::TestCase
  include NudgeTestHelper

  IMAGE = { type: "image", image_url: "http://localhost:3000/frames/x", alt_text: "frame" }.freeze
  WORDS = { type: "section", text: { type: "mrkdwn", text: "hi" } }.freeze

  test "a DM that went is its channel and ts" do
    message = SlackBot.dm("U0ADA", text: "hi", blocks: [ WORDS ])

    assert_equal [ "D0ADA", "1.0" ], [ message.channel, message.ts ]
    assert_equal({ channel: "U0ADA", text: "hi", blocks: [ WORDS ], unfurl_links: false }, @posts.sole)
  end

  test "a picture Slack can't fetch is left out rather than losing the message" do
    @slack_answer = ->(payload) { payload[:blocks].include?(IMAGE) ? { "ok" => false, "error" => "invalid_blocks" } : { "ok" => true, "channel" => "D0ADA", "ts" => "1.0" } }

    assert SlackBot.dm("U0ADA", text: "hi", blocks: [ IMAGE, WORDS ])
    assert_equal [ [ IMAGE, WORDS ], [ WORDS ] ], @posts.pluck(:blocks)
  end

  test "one that didn't go is nil" do
    @slack_answer = { "ok" => false, "error" => "channel_not_found" }
    assert_nil SlackBot.dm("U0ADA", text: "hi", blocks: [ WORDS ])
  end

  test "being told to slow down is raised, so a job can try again" do
    @slack_answer = { "ok" => false, "error" => "ratelimited" }
    assert_raises(SlackBot::RateLimited) { SlackBot.dm("U0ADA", text: "hi", blocks: [ WORDS ]) }
  end

  test "without a token nothing is asked of Slack" do
    Rails.configuration.x.slack_configured = false

    assert_nil SlackBot.dm("U0ADA", text: "hi", blocks: [ WORDS ])
    assert_empty @posts
  end
end
