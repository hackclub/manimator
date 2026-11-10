require "test_helper"
require "support/goal_test_helper"

class UserStreakTest < ActiveSupport::TestCase
  include GoalTestHelper

  TODAY = Date.new(2026, 11, 10)

  setup do
    @user = User.create!(hca_id: "ident!ada", timezone: "UTC")
    travel_to Time.utc(2026, 11, 10, 12)
  end

  def day(date, minutes, **who)
    Activity.create!({ user: @user }.merge(who).merge(activity_date: date, seconds: minutes * 60))
  end

  test "days in a row that reached their goal, ending today" do
    day(TODAY - 2, first_day_minutes) # the first day has a shorter goal
    day(TODAY - 1, daily_minutes)
    day(TODAY, daily_minutes + 5)
    assert_equal 3, @user.recalculate_streak!
    assert_equal 3, @user.reload.current_streak
  end

  test "today doesn't break it until it's over" do
    day(TODAY - 2, first_day_minutes)
    day(TODAY - 1, daily_minutes)
    day(TODAY, daily_minutes - 1)
    assert_equal 2, @user.recalculate_streak!
  end

  test "a missed day ends it" do
    day(TODAY - 3, first_day_minutes)
    day(TODAY - 2, daily_minutes - 1) # a minute short
    day(TODAY - 1, daily_minutes)
    assert_equal 1, @user.recalculate_streak!
    travel 2.days
    assert_equal 0, @user.recalculate_streak!
  end

  test "the first day's goal only counts on the first day" do
    assert_operator first_day_minutes, :<, daily_minutes
    day(TODAY - 1, first_day_minutes - 1) # a first day that fell short
    day(TODAY, first_day_minutes) # enough for a first day, but this is the second
    assert_equal 0, @user.recalculate_streak!
  end

  test "the day's still yesterday's until 2am where they are" do
    @user.update!(timezone: "America/New_York")
    day(TODAY - 1, first_day_minutes)
    day(TODAY, daily_minutes)
    travel_to Time.utc(2026, 11, 12, 6, 30) # 01:30 on the 12th in New York: the 11th isn't over
    assert_equal 2, @user.recalculate_streak!
    travel_to Time.utc(2026, 11, 12, 7, 30)
    assert_equal 0, @user.recalculate_streak!
  end

  test "all your time, in seconds and hours" do
    day(TODAY - 1, 45)
    day(TODAY, 60)
    assert_equal [ 6300, 1.8 ], [ @user.seconds_total, @user.hours ]
  end

  test "signing in takes a visitor's days along, adding to a day you already have" do
    day(TODAY - 1, 10)
    mine = day(TODAY, 8)
    day(TODAY, 15, user: nil, visitor_id: "v1", last_beat_at: Time.current)
    day(TODAY - 2, first_day_minutes, user: nil, visitor_id: "v1")
    someone_elses = day(TODAY, 30, user: nil, visitor_id: "v2")

    @user.adopt!("v1")

    assert_equal({ TODAY - 2 => first_day_goal, TODAY - 1 => 600, TODAY => 1380 }, @user.activities.pluck(:activity_date, :seconds).to_h)
    assert_equal Time.current, mine.reload.last_beat_at
    assert_empty Activity.of(visitor_id: "v1")
    assert_nil someone_elses.reload.user_id
    # The 8th was their first day and reached its goal, the 9th fell short of twenty, today's 23 count
    assert_equal 1, @user.reload.current_streak
  end
end
