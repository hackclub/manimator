require "test_helper"
require "support/goal_test_helper"

class HeartbeatsTest < ActionDispatch::IntegrationTest
  include GoalTestHelper

  KEYS = %w[today_seconds goal_seconds completed first_day streak total_seconds postcard_seconds].freeze
  NOON = Time.utc(2026, 11, 10, 12)

  setup { travel_to NOON }

  def beat(timezone: "UTC")
    post heartbeat_path, params: { timezone: }, as: :json
    assert_response :ok
    response.parsed_body
  end

  def sign_in(uid: "ident!ada")
    OmniAuth.config.test_mode = true
    OmniAuth.config.mock_auth[:hackclub] = OmniAuth::AuthHash.new(provider: "hackclub", uid:, info: { first_name: "Ada" }, extra: { raw_info: {} })
    post "/auth/hackclub"
    follow_redirect!
    User.find_by!(hca_id: uid)
  ensure
    OmniAuth.config.test_mode = false
  end

  test "a visitor's beats add up, and asking counts nothing" do
    get heartbeat_path, params: { timezone: "UTC" }
    assert_response :ok
    assert_equal KEYS, response.parsed_body.keys
    assert_equal({ "today_seconds" => 0, "goal_seconds" => first_day_goal, "completed" => false, "first_day" => true, "streak" => 0,
                   "total_seconds" => 0, "postcard_seconds" => 3600 }, response.parsed_body)
    assert_equal 0, Activity.count

    beat
    travel 30.seconds
    assert_equal KEYS, beat.keys
    travel 30.seconds
    assert_equal 60, beat["today_seconds"]

    travel 30.seconds
    get heartbeat_path, params: { timezone: "UTC" }
    assert_equal [ 60, 60 ], response.parsed_body.values_at("today_seconds", "total_seconds")
    assert_equal [ nil, 60 ], Activity.sole.then { |day| [ day.user_id, day.seconds ] }
  end

  test "a duration from the browser is ignored" do
    beat
    travel 30.seconds
    post heartbeat_path, params: { timezone: "UTC", seconds: 5000, today_seconds: 5000, heartbeat: { seconds: 5000 } }, as: :json
    assert_equal 30, response.parsed_body["today_seconds"]
  end

  test "someone signed in: the goal, the streak and all their time" do
    user = sign_in
    # Yesterday was a first day, done. Today is ten seconds short until the next beat adds its thirty.
    almost = daily_goal - 10
    Activity.create!(user:, activity_date: Date.new(2026, 11, 9), seconds: first_day_goal)
    Activity.create!(user:, activity_date: Date.new(2026, 11, 10), seconds: almost, last_beat_at: NOON - 30.seconds)

    get heartbeat_path
    assert_equal({ "today_seconds" => almost, "goal_seconds" => daily_goal, "completed" => false, "first_day" => false, "streak" => 1,
                   "total_seconds" => first_day_goal + almost, "postcard_seconds" => 3600 }, response.parsed_body)

    assert_equal({ "today_seconds" => almost + 30, "goal_seconds" => daily_goal, "completed" => true, "first_day" => false, "streak" => 2,
                   "total_seconds" => first_day_goal + almost + 30, "postcard_seconds" => 3600 }, beat)
    assert_equal 2, user.reload.current_streak
  end

  test "a beat remembers your timezone, and your day follows it" do
    user = sign_in
    travel_to Time.utc(2026, 11, 10, 6, 30) # 01:30 in New York
    beat(timezone: "America/New_York")
    assert_equal "America/New_York", user.reload.timezone
    assert_equal Date.new(2026, 11, 9), user.activities.sole.activity_date
    beat(timezone: "Nowhere/Real")
    assert_equal "America/New_York", user.reload.timezone
  end

  test "a visitor's timezone that isn't one counts as UTC" do
    beat(timezone: "Nowhere/Real")
    assert_equal Date.new(2026, 11, 10), Activity.sole.activity_date
  end

  test "signing in takes the visitor's time along" do
    beat
    travel 30.seconds
    beat
    user = sign_in
    assert_equal 30, user.seconds_total
    get heartbeat_path
    assert_equal 30, response.parsed_body["today_seconds"]
  end

  test "the editor carries the heartbeat" do
    get editor_path
    assert_select "[data-controller~=heartbeat][data-heartbeat-url-value='/heartbeat']"
  end
end
