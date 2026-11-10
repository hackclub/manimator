# For tests of π's Slack messages: someone who pledged, a bot token that isn't real, and Slack's answer faked at the
# one place a request would leave (SlackBot.post), so nothing is ever sent. Nobody's held out unless a test says so.
require_relative "goal_test_helper"

module NudgeTestHelper
  FRAME = "data:image/jpeg;base64,#{Base64.strict_encode64("\xFF\xD8\xFF\xE0 a picture".b)}".freeze

  def self.included(base)
    base.include ActiveJob::TestHelper
    base.include GoalTestHelper

    base.setup do
      Rails.configuration.x.slack_configured = true
      Rails.configuration.x.slack_bot_token = "xoxb-not-real"

      @posts = []
      @slack_answer = { "ok" => true, "channel" => "D0ADA", "ts" => "1.0" }
      @post = SlackBot.method(:post)
      test = self
      SlackBot.define_singleton_method(:post) { |payload| test.slack_posted(payload) }

      @held_out = false
      @holdout = Nudge.method(:holdout?)
      Nudge.define_singleton_method(:holdout?) { |_user| test.held_out }

      @user = User.create!(hca_id: "ident!ada", slack_id: "U0ADA", first_name: "Ada", timezone: "America/New_York")
      @pledge = @user.pledges.create!(visitor_id: "v", idea: "Why e^(iπ) = −1", build_time: "evening", days_per_week: 7,
                                      session_minutes: 30, prize: "pi-plushie", signed_at: at(9, hour: 12))
    end

    base.teardown do
      SlackBot.define_singleton_method(:post, @post)
      Nudge.define_singleton_method(:holdout?, @holdout)
      Rails.configuration.x.slack_configured = false
      Rails.configuration.x.slack_bot_token = nil
    end
  end

  attr_accessor :held_out

  def slack_posted(payload)
    @posts << payload
    @slack_answer.respond_to?(:call) ? @slack_answer.call(payload) : @slack_answer
  end

  # A moment in November 2026, in New York. Ada works in the evening: her slot is 7pm. The 10th is a Tuesday.
  def at(day, hour: 19, min: 5)
    Time.find_zone("America/New_York").local(2026, 11, day, hour, min)
  end

  def deliver(time = at(10))
    travel_to(time) { Nudge.deliver_to(@user.reload, time) }
  end

  # Time in the editor on a day in November, last touched at noon.
  def work(day, minutes)
    @user.activities.create!(activity_date: Date.new(2026, 11, day), seconds: minutes * 60, last_beat_at: at(day, hour: 12))
  end

  def sent!(kind, at:, arm: kind, **attributes)
    @user.nudges.create!(kind:, arm:, delivered: true, sent_at: at, **attributes)
  end
end
