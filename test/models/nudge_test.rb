require "test_helper"
require "support/nudge_test_helper"

class NudgeTest < ActiveSupport::TestCase
  include NudgeTestHelper

  test "pledged but no first day yet: what's left of the ten minutes, with their frame" do
    work(10, 4)
    @user.scenes.create!(code: "class A(Scene): pass", frame: NudgeTestHelper::FRAME)

    nudge = deliver

    assert_equal [ "first_frame", "first_frame" ], [ nudge.kind, nudge.arm ]
    assert_match(/6 minutes/, nudge.text)
    assert_includes nudge.text, "“Why e^(iπ) = −1”"
    assert_includes 0...Nudge::Copy::ARMS["first_frame"].size, nudge.variant
    assert nudge.delivered
    assert_equal [ "D0ADA", "1.0", at(10) ], [ nudge.slack_channel, nudge.slack_ts, nudge.sent_at ]
    assert_equal at(10), @user.reload.slack_dmed_at

    post = @posts.sole
    assert_equal [ "U0ADA", nudge.text ], [ post[:channel], post[:text] ]
    image, section, actions = post[:blocks]
    assert_match(%r{\Ahttp://localhost:3000/frames/.+}, image[:image_url])
    assert_equal nudge.text, section.dig(:text, :text)
    assert_equal [ nudge.link_url, nudge.stop_url ], actions[:elements].pluck(:url)
  end

  test "no frame yet, no picture" do
    assert_equal %w[section actions], deliver && @posts.sole[:blocks].pluck(:type)
  end

  test "only at their slot, and weekend people only at weekends" do
    assert_nil deliver(at(10, hour: 18))
    assert_nil deliver(at(10, hour: 19, min: 20))

    @pledge.update!(build_time: "weekends")
    assert_nil deliver(at(10, hour: 11))
    assert_equal "first_frame", deliver(at(14, hour: 11)).kind
  end

  test "nobody without a pledge or a timezone has a slot" do
    @user.update!(timezone: nil)
    assert_nil deliver
    assert_nil deliver(at(10, hour: 14)), "nor is 7pm UTC"
    @user.update!(timezone: "America/New_York")
    @pledge.destroy!
    assert_nil deliver
  end

  test "the first frame once, then asking them back every few days, three times at most" do
    assert_equal "first_frame", deliver(at(10)).kind
    assert_nil deliver(at(11)), "one day away isn't away"
    assert_equal "comeback", deliver(at(12)).kind
    assert_nil deliver(at(13))
    assert_nil deliver(at(14))
    assert_equal "comeback", deliver(at(15)).kind
    assert_equal "comeback", deliver(at(18)).kind
    assert_nil deliver(at(21)), "three with no answer is enough"

    work(22, 25)
    assert_equal "comeback", deliver(at(25)).kind, "they came back and left again"
  end

  test "being away means longer than the pace they pledged" do
    work(7, 25)
    @pledge.update!(days_per_week: 2)
    assert_nil deliver(at(10)), "two days off is their plan"
    assert_equal "comeback", deliver(at(12)).kind

    @user.nudges.delete_all
    @pledge.update!(build_time: "weekends")
    work(8, 25) # Sunday
    assert_nil deliver(at(14, hour: 11)), "the next Saturday is on time"
    assert_equal "comeback", deliver(at(21, hour: 11)).kind
  end

  test "the sit-down they booked, at the time they booked it, once" do
    @pledge.update!(next_session_at: at(11, hour: 16, min: 0))

    assert_nil deliver(at(11, hour: 15, min: 50))
    nudge = deliver(at(11, hour: 16, min: 5))
    assert_equal "session", nudge.kind
    assert_match(/4:05pm|4pm|time you picked/, nudge.text)

    @user.update_column(:slack_dmed_at, nil)
    assert_nil Nudge::Fixed.session(Nudge::Context.new(@user, at(11, hour: 16, min: 20))), "once per booking"
  end

  test "a booked time that's long gone isn't now" do
    @pledge.update!(next_session_at: at(11, hour: 16, min: 0))
    assert_nil deliver(at(11, hour: 16, min: 45))
  end

  test "an hour in the editor makes the postcard, once" do
    work(8, 40)
    work(9, 30)

    nudge = deliver
    assert_equal [ "milestone", "postcard" ], [ nudge.kind, nudge.arm ]
    assert_match(/postcard is made/, nudge.text)

    work(11, 5)
    assert_nil deliver(at(11))
  end

  test "halfway to the prize they picked, and there; a later milestone means the earlier ones don't send" do
    work(8, 120)
    work(9, 100)

    nudge = deliver
    assert_equal "halfway", nudge.arm
    assert_match(/halfway to your Chunky Pi Plushie/, nudge.text)

    work(11, 5)
    assert_nil deliver(at(11)), "not the postcard after halfway"

    @user.activities.find_by(activity_date: Date.new(2026, 11, 9)).update!(seconds: 5 * 3600)
    nudge = deliver(at(12))
    assert_equal "done", nudge.arm
    assert_match(/7 hours/, nudge.text)
  end

  test "with no prize picked, or the postcard, the hour is the only milestone" do
    @pledge.update!(prize: "postcard")
    work(8, 120)
    work(9, 100)

    nudge = deliver
    assert_equal "postcard", nudge.arm
    assert_no_match(/with your/, nudge.text)
  end

  test "a streak of two days gets saved at their slot, not every day" do
    work(8, 10)
    work(9, 20)
    @user.update_column(:current_streak, 0) # stale; it's counted afresh

    nudge = deliver
    assert_equal "streak_saver", nudge.kind
    assert_match(/2 days/, nudge.text)
    assert_match(/20 minutes today/, nudge.text)

    work(10, 22)
    assert_nil deliver(at(11)), "said within the streak's length"
  end

  test "a streak that lapsed while they were away isn't one" do
    work(5, 15)
    work(6, 25)
    @user.update_column(:current_streak, 2)

    assert_equal "comeback", deliver.kind
  end

  test "nothing once today's goal is met, or while they're in the editor" do
    work(10, 10)
    assert_nil deliver

    @user.activities.update_all(seconds: 240, last_beat_at: at(10, min: 3))
    assert_nil deliver, "working right now"
  end

  test "nothing in quiet hours" do
    @pledge.update!(next_session_at: at(11, hour: 22, min: 30))
    assert_nil deliver(at(11, hour: 22, min: 35))
    @pledge.update!(next_session_at: at(12, hour: 7, min: 0))
    assert_nil deliver(at(12, hour: 7, min: 5))
  end

  test "nothing within an hour of anything else π sent, and one a day" do
    @user.update!(slack_dmed_at: at(10, hour: 18, min: 30))
    assert_nil deliver

    @user.update!(slack_dmed_at: nil)
    sent!("comeback", at: at(10, hour: 9))
    assert_nil deliver
  end

  test "five a week at most, cheers not counted" do
    (5..8).each { |day| sent!("comeback", at: at(day)) }
    sent!("cheer", at: at(9))
    assert_equal "first_frame", deliver.kind

    @user.nudges.where(kind: "first_frame").delete_all
    @user.update!(slack_dmed_at: nil)
    sent!("comeback", at: at(9))
    assert_nil deliver
  end

  test "nothing once they've stopped π, or the DM has failed" do
    @user.update!(slack_muted_at: at(9))
    assert_nil deliver
    @user.update!(slack_muted_at: nil, slack_dm_failed_at: at(9))
    assert_nil deliver
    assert_empty @posts
  end

  test "a DM that doesn't go isn't tried again" do
    @slack_answer = { "ok" => false, "error" => "channel_not_found" }

    nudge = deliver
    assert_not nudge.delivered
    assert @user.reload.slack_dm_failed_at
    assert_nil @user.slack_dmed_at
    assert_nil deliver(at(12))
  end

  test "everyone due gets theirs, and one person's trouble doesn't stop the rest" do
    other = User.create!(hca_id: "ident!bob", slack_id: "U0BOB", timezone: "America/New_York")
    other.pledges.create!(visitor_id: "w", idea: "Primes", build_time: "evening", days_per_week: 3, session_minutes: 30, signed_at: at(9))
    User.create!(hca_id: "ident!nopledge", slack_id: "U0NOP", timezone: "America/New_York")
    @slack_answer = ->(payload) { payload[:channel] == "U0ADA" ? raise("boom") : { "ok" => true, "channel" => "D0BOB", "ts" => "2.0" } }

    travel_to(at(10)) { Nudge.deliver_due }

    assert_equal %w[U0ADA U0BOB], @posts.pluck(:channel).sort
    assert other.nudges.sole.delivered
  end

  # The holdout.

  test "the same tenth of people every time" do
    Nudge.define_singleton_method(:holdout?, @holdout)
    people = (1..2000).map { |id| User.new(id:) }
    held = people.select { |user| Nudge.holdout?(user) }

    assert_in_delta 200, held.size, 50
    assert_equal held, people.select { |user| Nudge.holdout?(user) }
  end

  test "someone held out gets nothing, but what they'd have got is kept" do
    @held_out = true
    work(10, 4)

    nudge = deliver

    assert_empty @posts
    assert_equal [ "first_frame", true, false, at(10) ], [ nudge.kind, nudge.holdout, nudge.delivered, nudge.sent_at ]
    assert_match(/6 minutes/, nudge.text)
    assert_nil nudge.slack_ts
    assert_nil @user.reload.slack_dmed_at
    assert_nil @user.slack_dm_failed_at
  end

  test "someone held out is on the same schedule and caps as everyone else" do
    @held_out = true

    assert_equal "first_frame", deliver(at(10)).kind
    assert_nil deliver(at(10, min: 10)), "one a day"
    assert_nil deliver(at(11))
    assert_equal "comeback", deliver(at(12)).kind
    assert_nil deliver(at(13))

    @pledge.update!(next_session_at: at(13, hour: 19, min: 30))
    @user.nudges.create!(kind: "cheer", arm: "cheer", holdout: true, sent_at: at(13, hour: 19, min: 0))
    assert_nil deliver(at(13, hour: 19, min: 35)), "within the hour of the last one they'd have got"
    assert_empty @posts
  end

  # Scoring.

  test "reaching the day's goal within six hours means it worked" do
    nudge = deliver
    early = sent!("comeback", at: at(10, hour: 13))
    assert_no_enqueued_jobs { Nudge.worked!(@user, at(10, hour: 20)) }

    assert_equal [ 1, at(10, hour: 20) ], [ nudge.reload.reward, nudge.rewarded_at ]
    assert_nil early.reload.reward, "too long before"

    Nudge.score_due(at(10, hour: 20))
    assert_equal [ 0, 1 ], [ early.reload.reward, nudge.reload.reward ]
  end

  test "not reaching it means it didn't, once the window's closed" do
    nudge = deliver

    Nudge.score_due(at(10, hour: 23))
    assert_nil nudge.reload.reward

    Nudge.score_due(at(11, hour: 1, min: 6))
    assert_equal 0, nudge.reload.reward
    assert nudge.rewarded_at
  end

  test "stopping π's messages from a nudge is worse than nothing, whatever they did after" do
    nudge = deliver
    @user.mute_slack!(nudge)
    Nudge.worked!(@user, at(10, hour: 20))
    assert_nil nudge.reload.reward

    Nudge.score_due(at(11, hour: 2))
    assert_equal Nudge::OPT_OUT_PENALTY, nudge.reload.reward
  end

  test "a cheer worked if they reached the next day's goal" do
    work(9, 10)
    came_back = sent!("cheer", at: at(9, hour: 20), built_on: Date.new(2026, 11, 9))
    didnt = sent!("cheer", at: at(10, hour: 20), built_on: Date.new(2026, 11, 10))
    work(10, 25)

    Nudge.worked!(@user, at(10, hour: 20, min: 30))
    assert_nil didnt.reload.reward, "the day's goal doesn't score that day's cheer"

    Nudge.score_due(at(11, hour: 1))
    assert_nil came_back.reload.reward, "the next day runs to 2am"

    Nudge.score_due(at(12, hour: 2, min: 1))
    assert_equal [ 1, 0 ], [ came_back.reload.reward, didnt.reload.reward ]
  end

  test "held-out ones are scored the same way, test ones never" do
    @held_out = true
    worked = deliver(at(10))
    didnt = deliver(at(12))
    test = @user.nudges.create!(kind: "test", arm: "cheer", delivered: true, sent_at: at(10))

    Nudge.worked!(@user, at(10, hour: 21))
    Nudge.score_due(at(13, hour: 12))

    assert_equal [ 1, 0, nil ], [ worked.reload.reward, didnt.reload.reward, test.reload.reward ]
  end

  # Without a bot token.

  test "with no bot token nothing happens at all" do
    Rails.configuration.x.slack_configured = false
    Rails.configuration.x.slack_bot_token = nil
    work(10, 4)

    travel_to(at(10)) { Nudge.deliver_due }
    assert_nil deliver
    assert_no_enqueued_jobs { Nudge.day_completed(@user, Date.new(2026, 11, 10)) }
    assert_nil SlackBot.dm("U0ADA", text: "hi", blocks: [])

    assert_equal 0, Nudge.count
    assert_empty @posts
  end

  # Copy.

  test "every arm has a wording that needs nothing special, and nothing calls a video short" do
    always = %i[idea local_time goal left_today]
    needs = { "halfway" => %i[hours prize prize_hours], "done" => %i[hours prize prize_hours], "streak_saver" => %i[streak streak_next],
              "cheer" => %i[minutes day next_day] }

    Nudge::Copy::ARMS.each do |arm, variants|
      vars = (always + needs.fetch(arm, [])).index_with { "x" }
      assert Nudge::Copy.render(arm, vars), "#{arm} can't always be said"
      variants.each { |text| assert_no_match(/\bshort\b|hack ?club/i, text.sub("Hack Club", "")) }
    end
  end

  test "what someone typed as their idea can't mention anyone" do
    @pledge.update!(idea: "<!channel> & friends")
    deliver

    assert_includes @posts.sole[:blocks].first.dig(:text, :text), "&lt;!channel&gt; &amp; friends"
  end
end
