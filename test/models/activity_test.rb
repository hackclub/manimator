require "test_helper"
require "support/goal_test_helper"

class ActivityTest < ActiveSupport::TestCase
  include GoalTestHelper

  NOON = Time.utc(2026, 11, 10, 12)

  setup { @user = User.create!(hca_id: "ident!ada", timezone: "UTC") }

  # Beats every `every` seconds from `from`, for `count` beats.
  def beats(count, from: NOON, every: 30, **who)
    who = { user: @user } if who.empty?
    count.times.map { |i| Activity.beat!(**who, timezone: "UTC", now: from + i * every) }.last
  end

  test "the first beat starts the day with nothing on it, and each one after adds the time since the last" do
    assert_equal 0, beats(1).seconds
    day = beats(3, from: NOON + 30)
    assert_equal 90, day.seconds
    assert_equal 1, @user.activities.count
  end

  test "a gap between beats counts for a minute at most" do
    beats(1)
    assert_equal 60, Activity.beat!(user: @user, timezone: "UTC", now: NOON + 100).seconds
  end

  test "more than two minutes without a beat counts for nothing" do
    beats(3)
    day = Activity.beat!(user: @user, timezone: "UTC", now: NOON + 60 + 121)
    assert_equal 60, day.seconds
    assert_equal 90, Activity.beat!(user: @user, timezone: "UTC", now: NOON + 60 + 151).seconds
  end

  test "a beat from before the last one changes nothing" do
    beats(3)
    day = Activity.beat!(user: @user, timezone: "UTC", now: NOON + 10)
    assert_equal [ 60, NOON + 60 ], [ day.seconds, day.last_beat_at ]
  end

  test "days run 2am to 2am in their timezone" do
    assert_equal Date.new(2026, 11, 9), Activity.date_for(Time.utc(2026, 11, 10, 1, 59), "UTC")
    assert_equal Date.new(2026, 11, 10), Activity.date_for(Time.utc(2026, 11, 10, 2), "UTC")
    # 06:30 UTC is 01:30 in New York: still the night before
    assert_equal Date.new(2026, 11, 9), Activity.date_for(Time.utc(2026, 11, 10, 6, 30), "America/New_York")
    assert_equal Date.new(2026, 11, 10), Activity.date_for(Time.utc(2026, 11, 10, 7), "America/New_York")
    assert_equal Date.new(2026, 11, 10), Activity.date_for(NOON, "Not/AZone")
    assert_equal Date.new(2026, 11, 10), Activity.date_for(NOON, nil)
  end

  test "working across 2am carries on into the new day" do
    beats(4, from: Time.utc(2026, 11, 10, 1, 59)) # 01:59:00, 01:59:30, 02:00:00, 02:00:30
    night, morning = @user.activities.order(:activity_date).to_a
    assert_equal [ Date.new(2026, 11, 9), 30 ], [ night.activity_date, night.seconds ]
    assert_equal [ Date.new(2026, 11, 10), 60 ], [ morning.activity_date, morning.seconds ]
  end

  test "your first day has a goal of its own, shorter than every day after" do
    assert_operator first_day_goal, :<, daily_goal
    first = beats(beats_for(first_day_goal))
    assert first.first_day?
    assert_equal Activity::FIRST_DAY_GOAL_SECONDS, first.goal_seconds
    assert first.completed?

    # What made a first day isn't enough for a second, until the rest of the daily goal is on it
    second = beats(beats_for(first_day_goal), from: NOON + 1.day)
    assert_not second.first_day?
    assert_equal Activity::DAILY_GOAL_SECONDS, second.goal_seconds
    assert_not second.completed?
    assert beats((daily_goal - first_day_goal) / 30, from: NOON + 1.day + first_day_goal + 30).completed?
  end

  test "a day with no time on it isn't your first day" do
    beats(1)
    assert beats(2, from: NOON + 1.day).first_day?
  end

  test "a visitor's days are kept apart from everyone else's" do
    beats(3, visitor_id: "v1")
    beats(2, visitor_id: "v2")
    beats(4)
    assert_equal 60, Activity.of(visitor_id: "v1").total_seconds
    assert_equal 30, Activity.of(visitor_id: "v2").total_seconds
    assert_equal 90, Activity.of(user: @user).total_seconds
    assert_raises(ArgumentError) { Activity.of(visitor_id: nil) }
  end

  test "reaching the goal counts the streak again and tells π, once" do
    told = []
    original = Nudge.method(:day_completed)
    Nudge.define_singleton_method(:day_completed) { |user, date| told << [ user, date ] }
    travel_to NOON + 15.minutes do
      beats(beats_for(first_day_goal) - 1) # one beat short
      assert_equal [ 0, [] ], [ @user.reload.current_streak, told ]
      beats(3, from: NOON + first_day_goal) # the one that reaches it, and two more
      assert_equal 1, @user.reload.current_streak
      assert_equal [ [ @user, Date.new(2026, 11, 10) ] ], told
    end
  ensure
    Nudge.define_singleton_method(:day_completed, original)
  end

  test "a visitor reaching the goal tells nobody" do
    original = Nudge.method(:day_completed)
    Nudge.define_singleton_method(:day_completed) { |*| raise "a visitor has no Slack" }
    assert beats(beats_for(first_day_goal), visitor_id: "v1").completed?
  ensure
    Nudge.define_singleton_method(:day_completed, original)
  end
end

# Beats really arriving together, each on its own database connection (so not inside a test's transaction).
class ActivityRaceTest < ActiveSupport::TestCase
  self.use_transactional_tests = false

  NOON = ActivityTest::NOON

  setup { @user = User.create!(hca_id: "ident!race", timezone: "UTC") }
  teardown { @user.destroy! }

  def together(count)
    gate = Queue.new
    threads = count.times.map { Thread.new { gate.pop; ActiveRecord::Base.connection_pool.with_connection { yield } } }
    count.times { gate << :go }
    threads.each(&:join)
  end

  test "first beats at once make one day" do
    together(4) { Activity.beat!(user: @user, timezone: "UTC", now: NOON) }
    assert_equal 0, @user.activities.sole.seconds
  end

  test "a beat waits for the one before it to finish, and counts from where that one left off" do
    day = Activity.beat!(user: @user, timezone: "UTC", now: NOON)
    holding = Queue.new
    # A beat at 12:00:50 that's read the day and not yet written it
    first = Thread.new do
      ActiveRecord::Base.connection_pool.with_connection do
        day.with_lock do
          holding << true
          sleep 0.3
          day.update!(seconds: 50, last_beat_at: NOON + 50)
        end
      end
    end
    holding.pop
    # Counting from the day as it was before that one (a 100 second gap) would add a minute, not 50 seconds
    assert_equal 100, Activity.beat!(user: @user, timezone: "UTC", now: NOON + 100).seconds
    first.join
  end
end
