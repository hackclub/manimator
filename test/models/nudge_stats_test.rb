require "test_helper"
require "support/nudge_test_helper"

class NudgeStatsTest < ActiveSupport::TestCase
  include NudgeTestHelper

  test "each kind, the people messaged against the people held out" do
    sent!("cheer", at: at(8), reward: 1, clicked_at: at(8))
    sent!("cheer", at: at(9), reward: 0)
    sent!("cheer", at: at(10))
    sent!("comeback", at: at(10), reward: Nudge::OPT_OUT_PENALTY, opted_out_at: at(10))
    @user.nudges.create!(kind: "comeback", arm: "comeback", sent_at: at(9)) # a DM that failed
    @user.nudges.create!(kind: "cheer", arm: "cheer", holdout: true, sent_at: at(8), reward: 1)
    @user.nudges.create!(kind: "cheer", arm: "cheer", holdout: true, sent_at: at(9), reward: 1)
    sent!("test", at: at(10), arm: "cheer")

    stats = Nudge::Stats.new
    cheers, comebacks = stats.by_kind.values_at("cheer", "comeback")

    assert_equal %w[cheer comeback], stats.by_kind.keys
    assert_equal [ 3, 3, 1, 2, 1, 0.5 ], cheers[:messaged].then { [ _1.sent, _1.delivered, _1.clicked, _1.scored, _1.worked, _1.work_rate ] }
    assert_equal [ 2, 0, 2, 2, 1.0 ], cheers[:holdout].then { [ _1.sent, _1.delivered, _1.scored, _1.worked, _1.work_rate ] }
    assert_equal [ 2, 1, 1, 0, 1 ], comebacks[:messaged].then { [ _1.sent, _1.delivered, _1.scored, _1.worked, _1.opted_out ] }
    assert_equal Nudge::Stats::Row.empty, comebacks[:holdout]
    assert_equal [ 5, 2 ], stats.totals.values_at(:messaged, :holdout).map(&:sent)
    assert_match(/cheer\s+holdout\s+2\s+2\s+2\s+100%/, stats.to_s)
  end
end
