require "test_helper"
require "support/nudge_test_helper"

class NudgeCheerJobTest < ActiveSupport::TestCase
  include NudgeTestHelper

  TODAY = Date.new(2026, 11, 10)

  def cheer(time = at(10, hour: 20), day = TODAY)
    travel_to(time) { NudgeCheerJob.perform_now(@user.id, day, time) }
    @user.nudges.cheers.order(:id).last
  end

  test "the heartbeat that reaches the day's goal queues it, and does nothing else" do
    start = at(10, hour: 19, min: 30)
    travel_to(start) do
      assert_no_enqueued_jobs { 5.times { |i| Activity.beat!(user: @user, timezone: @user.timezone, now: start + i.minutes) } }
      assert_enqueued_with(job: NudgeCheerJob, args: [ @user.id, TODAY, start ]) do # the clock's stopped at start
        Activity.beat!(user: @user, timezone: @user.timezone, now: start + 5.minutes)
      end
      assert_no_enqueued_jobs { Activity.beat!(user: @user, timezone: @user.timezone, now: start + 6.minutes) }
    end
    assert_empty @posts
  end

  test "it never raises into the heartbeat" do
    perform_later = NudgeCheerJob.method(:perform_later)
    NudgeCheerJob.define_singleton_method(:perform_later) { |*| raise "the queue is down" }

    assert_nothing_raised { Nudge.day_completed(@user, TODAY) }
  ensure
    NudgeCheerJob.define_singleton_method(:perform_later, perform_later)
  end

  test "a cheer for the day they just finished, and the nudge before it worked" do
    work(10, 5)
    nudged = sent!("first_frame", at: at(10, hour: 19, min: 0))
    @user.update!(slack_dmed_at: at(10, hour: 19, min: 0))

    nudge = cheer(at(10, hour: 20, min: 1))

    assert_equal [ "cheer", TODAY, true ], [ nudge.kind, nudge.built_on, nudge.delivered ]
    assert_match(/5 minutes/, nudge.text)
    assert_match(/today/, nudge.text)
    assert_includes [ 0, 1 ], nudge.variant, "the wordings a first day can fill"
    assert_equal 1, nudged.reload.reward
    assert_equal 1, @posts.size
  end

  test "one a day, and one per day worked" do
    work(10, 5)
    cheer
    assert_no_difference -> { Nudge.count } do
      cheer(at(10, hour: 21, min: 30))
    end
  end

  test "not for a day that isn't done, or is long past" do
    work(10, 4)
    assert_nil cheer
    work(7, 30)
    assert_nil cheer(at(10, hour: 20), Date.new(2026, 11, 7))
  end

  test "right after something else π said, it waits out the hour" do
    work(10, 5)
    @user.update!(slack_dmed_at: at(10, hour: 19, min: 30))

    assert_enqueued_with(job: NudgeCheerJob, args: [ @user.id, TODAY ], at: at(10, hour: 20, min: 30)) { cheer }
    assert_empty @posts
  end

  test "late at night it waits for the morning, and says yesterday" do
    work(10, 5)

    assert_enqueued_with(job: NudgeCheerJob, args: [ @user.id, TODAY ], at: at(11, hour: 8, min: 0)) { cheer(at(10, hour: 23)) }
    assert_empty @posts

    travel_to(at(11, hour: 8)) { NudgeCheerJob.perform_now(@user.id, TODAY) }
    assert_match(/yesterday/, @user.nudges.cheers.sole.text)
  end

  test "someone held out is cheered in the log only" do
    @held_out = true
    work(10, 5)

    nudge = cheer

    assert_equal [ true, false, TODAY ], [ nudge.holdout, nudge.delivered, nudge.built_on ]
    assert_empty @posts
    assert_no_difference -> { Nudge.count } do
      cheer(at(10, hour: 21, min: 30))
    end
  end

  test "with a streak and hours behind them, any wording can go" do
    work(8, 60)
    work(9, 60)
    work(10, 20)

    assert_match(/Why e/, cheer.text)
  end
end
