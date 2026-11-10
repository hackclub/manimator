require "test_helper"

class NudgeLinksTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(hca_id: "ident!ada", slack_id: "U0ADA")
    @nudge = @user.nudges.create!(kind: "comeback", arm: "comeback", text: "Here's your scene as you left it.")
  end

  test "the button counts the click and opens the editor" do
    get nudge_link_path(@nudge.token)
    assert_redirected_to editor_path

    get nudge_link_path(@nudge.token)
    @nudge.reload
    assert_equal 2, @nudge.clicks
    assert @nudge.clicked_at
  end

  test "a link that doesn't exist goes home" do
    get nudge_link_path("nope")
    assert_redirected_to root_path
  end

  test "stopping asks first, since links get opened ahead of time" do
    get nudge_stop_path(@nudge.token)

    assert_response :success
    assert_select "h1", "Stop π's messages?"
    assert_nil @user.reload.slack_muted_at
  end

  test "stopping mutes π and counts against that nudge, and you can change your mind" do
    post nudge_stop_path(@nudge.token)
    follow_redirect!
    assert_select "h1", "π won't message you anymore."
    assert @user.reload.slack_muted_at
    assert @nudge.reload.opted_out_at

    delete nudge_stop_path(@nudge.token)
    follow_redirect!
    assert_select "h1", "Stop π's messages?"
    assert_nil @user.reload.slack_muted_at
    assert_nil @nudge.reload.opted_out_at
  end
end
