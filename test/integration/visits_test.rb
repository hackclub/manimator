require "test_helper"

class VisitsTest < ActionDispatch::IntegrationTest
  def visit_step(**visit)
    patch visit_path, params: { visit: }, as: :json
    assert_response :no_content
    OnboardingVisit.order(:id).last
  end

  test "each beat updates one visit: the step, the question and the answers so far" do
    visit_step(step: "hello", referrer: "https://hackclub.slack.com/", utm: { ref: "slack-announcements", junk: "x" })
    visit = visit_step(step: "buddy", question_index: 1, answers: { idea: "Minecraft circles", qi: 3 }, k: 1.4)
    assert_equal 1, OnboardingVisit.count
    assert_equal [ "buddy", 1, 1.4 ], visit.values_at(:last_step, :question_index, :k)
    assert_equal({ "idea" => "Minecraft circles", "qi" => 3 }, visit.answers)
    assert_equal({ "ref" => "slack-announcements" }, visit.utm)
    assert_equal "https://hackclub.slack.com/", visit.referrer
  end

  test "where you came from is the first place we heard of" do
    visit_step(step: "drop")
    visit_step(step: "drop", utm: { ref: "first" })
    visit = visit_step(step: "drop", utm: { ref: "second" }, referrer: "https://later.example/")
    assert_equal({ "ref" => "first" }, visit.utm)
    assert_nil visit.referrer
  end

  test "Hack Club Auth's email is kept, and one typed in later doesn't replace it" do
    visit_step(email: "Heidi@HackClub.com", email_source: "whoami", first_name: "Heidi")
    visit = visit_step(email: "other@example.com", email_source: "asked")
    assert_equal [ "heidi@hackclub.com", "whoami", "Heidi" ], visit.values_at(:email, :email_source, :first_name)
  end

  test "a typed email can be corrected, and one that isn't an email is refused" do
    visit_step(email: "me@exmaple.com", email_source: "asked")
    visit = visit_step(email: "me@example.com", email_source: "asked")
    assert_equal "me@example.com", visit.email
    patch visit_path, params: { visit: { email: "not an email", email_source: "asked" } }, as: :json
    assert_response :unprocessable_content
    assert_equal "me@example.com", visit.reload.email
  end

  test "answers too big to be the story's are refused" do
    patch visit_path, params: { visit: { step: "idea", answers: { idea: "x" * 5000 } } }, as: :json
    assert_response :unprocessable_content
  end

  test "signing the pledge marks the visit pledged, and signing in makes it yours" do
    visit = visit_step(step: "sign")
    post pledge_path, params: { pledge: { idea: "Circles", build_time: "evening", days_per_week: 3, session_minutes: 60 } }, as: :json
    assert visit.reload.pledged_at
    user = User.create!(hca_id: "ident!visit")
    user.adopt!(visit.visitor_id)
    assert_equal user, visit.reload.user
  end
end
