require "test_helper"

class PledgesTest < ActionDispatch::IntegrationTest
  PLEDGE = { idea: "Fourier series", build_time: "evening", days_per_week: 3, session_minutes: 60 }

  def sign_pledge(**attributes)
    post pledge_path, params: { pledge: PLEDGE.merge(attributes) }, as: :json
    assert_response :created
    Pledge.order(:id).last
  end

  test "booking your next sit-down saves it on your latest pledge" do
    older = sign_pledge(idea: "Older idea")
    older.update_column(:signed_at, 1.day.ago)
    pledge = sign_pledge
    at = 1.day.from_now.change(usec: 0)
    patch pledge_path, params: { pledge: { next_session_at: at.iso8601 } }, as: :json
    assert_response :ok
    assert_equal at, pledge.reload.next_session_at
    assert_nil older.reload.next_session_at
  end

  test "it only changes when you'll sit down next" do
    pledge = sign_pledge
    patch pledge_path, params: { pledge: { next_session_at: 1.day.from_now.iso8601, idea: "Something else", build_time: "late night" } }, as: :json
    assert_equal [ "Fourier series", "evening" ], pledge.reload.values_at(:idea, :build_time)
  end

  test "a time that's passed, too far off, or not a time is refused" do
    pledge = sign_pledge
    [ 1.hour.ago.iso8601, 1.month.from_now.iso8601, "tomorrow-ish", "" ].each do |at|
      patch pledge_path, params: { pledge: { next_session_at: at } }, as: :json
      assert_response :unprocessable_content
    end
    assert_nil pledge.reload.next_session_at
  end

  test "someone who hasn't pledged has nothing to book on, and can't book on anyone else's" do
    other = Pledge.create!(PLEDGE.merge(visitor_id: "someone-else", signed_at: Time.current))
    get editor_path
    patch pledge_path, params: { pledge: { next_session_at: 1.day.from_now.iso8601 } }, as: :json
    assert_response :not_found
    assert_nil other.reload.next_session_at
  end

  test "signed in, it's the pledge that came along with you" do
    OmniAuth.config.test_mode = true
    OmniAuth.config.mock_auth[:hackclub] = OmniAuth::AuthHash.new(provider: "hackclub", uid: "ident!xyz", info: { first_name: "Emmy" }, extra: { raw_info: {} })
    pledge = sign_pledge
    post "/auth/hackclub"
    follow_redirect!
    patch pledge_path, params: { pledge: { next_session_at: 2.days.from_now.iso8601 } }, as: :json
    assert_response :ok
    assert_equal User.find_by!(hca_id: "ident!xyz"), pledge.reload.user
    assert pledge.next_session_at
  ensure
    OmniAuth.config.test_mode = false
  end
end
