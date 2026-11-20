require "test_helper"

class OnboardingFollowupTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  def left(email: "maya@example.com", ago: 2.days, **attributes)
    OnboardingVisit.create!(visitor_id: SecureRandom.uuid, email:, email_source: "asked", last_seen_at: ago.ago,
      answers: { "idea" => "Minecraft circles" }, **attributes)
  end

  test "a day after someone with an email stops, π emails them once, with the way back and a way out" do
    visit = left
    assert_enqueued_emails(1) { assert_equal "sent", visit.follow_up!(holdout: false) }
    assert_no_enqueued_emails { assert_nil visit.follow_up!(holdout: false) }
    mail = OnboardingMailer.followup(visit.reload)
    assert_equal [ "maya@example.com" ], mail.to
    assert_match "Minecraft circles", mail.subject
    assert_includes mail.text_part.body.to_s, visit.back_url
    assert_equal "<#{visit.unsubscribe_url}>", mail["List-Unsubscribe"].to_s
  end

  test "the holdout is never emailed, and is still counted" do
    visit = left
    assert_no_enqueued_emails { assert_equal "holdout", visit.follow_up!(holdout: true) }
    assert visit.reload.followup_at
  end

  test "only people who left a day to a week ago, unsigned, unsubscribed-not, with an email, are due" do
    due = left
    left(ago: 1.hour)
    left(ago: 10.days)
    left(email: nil)
    left(pledged_at: Time.current)
    left(unsubscribed_at: Time.current)
    assert_equal [ due ], OnboardingVisit.followup_due.to_a
  end

  test "an email that already pledged or was already emailed gets nothing" do
    left(email: "twice@example.com").follow_up!(holdout: false)
    assert_no_enqueued_emails { assert_equal "duplicate", left(email: "twice@example.com").follow_up!(holdout: false) }
    user = User.create!(hca_id: "ident!pledged", email: "Signed@Example.com")
    Pledge.create!(visitor_id: "x", user:, idea: "Circles", build_time: "evening", days_per_week: 3, session_minutes: 60, signed_at: Time.current)
    assert_equal "duplicate", left(email: "signed@example.com").follow_up!(holdout: false)
  end

  test "the link back opens the story as that visit, on any browser, and counts the click" do
    visit = left(question_index: 2)
    visit.follow_up!(holdout: false)
    get onboarding_path(v: visit.followup_token)
    assert_redirected_to onboarding_path
    assert visit.reload.followup_clicked_at
    follow_redirect!
    progress = JSON.parse(css_select("[data-controller=story]").first["data-story-progress-value"])
    assert_equal 2, progress["at"]
  end

  test "unsubscribing asks first, then stops the email for good" do
    visit = left
    visit.follow_up!(holdout: true)
    get visit_unsubscribe_path(visit.followup_token)
    assert_response :ok
    assert_nil visit.reload.unsubscribed_at
    post visit_unsubscribe_path(visit.followup_token)
    assert visit.reload.unsubscribed_at
  end
end
