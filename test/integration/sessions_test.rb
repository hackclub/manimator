require "test_helper"

class SessionsTest < ActionDispatch::IntegrationTest
  setup do
    OmniAuth.config.test_mode = true
    OmniAuth.config.mock_auth[:hackclub] = OmniAuth::AuthHash.new(
      provider: "hackclub", uid: "ident!abc",
      info: { email: "ada@example.com", name: "Ada Lovelace", first_name: "Ada" },
      extra: { raw_info: { slack_id: "U123", verification_status: "verified", ysws_eligible: true } }
    )
  end

  teardown { OmniAuth.config.test_mode = false }

  test "signing in makes a user, takes along their pledge, and opens the editor" do
    get editor_path # gets a visitor id
    post pledge_path, params: { pledge: { name: "Ada", idea: "Why π", build_time: "evening", days_per_week: 3, session_minutes: 60 } }
    assert_response :created

    post "/auth/hackclub"
    follow_redirect!
    assert_redirected_to editor_path

    user = User.find_by!(hca_id: "ident!abc")
    assert_equal [ "Ada", "U123", true ], [ user.first_name, user.slack_id, user.ysws_eligible ]
    assert_equal user, Pledge.last.user

    follow_redirect!
    assert_select "form[action='/logout']"
    assert_select "form[action='/auth/hackclub']", count: 0
  end

  test "signing in again updates the user, not a second one" do
    2.times { post "/auth/hackclub"; follow_redirect! }
    assert_equal 1, User.where(hca_id: "ident!abc").count
  end

  test "signing out" do
    post "/auth/hackclub"
    follow_redirect!
    delete logout_path
    assert_redirected_to root_path
    get editor_path
    assert_select "form[action='/auth/hackclub']"
  end
end
