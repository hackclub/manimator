require "test_helper"

class OnboardingFollowupTest < ActionDispatch::IntegrationTest
  def left(email: "maya@example.com", ago: 2.days, **attributes)
    OnboardingVisit.create!(visitor_id: SecureRandom.uuid, email:, email_source: "asked", last_seen_at: ago.ago,
      answers: { "idea" => "Minecraft circles" }, **attributes)
  end

  test "a day after someone with an email stops, they're put in an arm once" do
    visit = left
    assert_equal "sent", visit.follow_up!(holdout: false)
    assert_nil visit.follow_up!(holdout: false)
    assert visit.reload.followup_token
    assert_equal "sent", visit.followup_arm
  end

  test "the Loops fields carry the way back and the idea, and only for the sent arm" do
    sent = left.tap { |visit| visit.follow_up!(holdout: false) }
    held = left(email: "held@example.com").tap { |visit| visit.follow_up!(holdout: true) }
    sync = OnboardingVisit::LoopsSync.new
    fields = sync.fields(sent)
    assert_equal sent.back_url, fields["Loops - manimatorFollowupUrl"]
    assert_equal "Minecraft circles", fields["Loops - manimatorFollowupIdea"]
    assert_equal sent.followup_at.iso8601, fields["Loops - manimatorFollowupAt"]
    assert_equal "maya@example.com", fields["email"]
    assert_not sync.fields(held).key?("Loops - manimatorFollowupAt")
  end

  test "only visits with an email that changed since the last sync go to Airtable" do
    synced = left(email: "synced@example.com")
    synced.update_column(:loops_synced_at, 1.minute.from_now)
    changed = left
    left(email: nil)
    assert_equal [ changed ], OnboardingVisit.loops_unsynced.to_a
  end

  test "the holdout is counted, and never gets the fields that send it" do
    visit = left
    assert_equal "holdout", visit.follow_up!(holdout: true)
    assert visit.reload.followup_at
  end

  test "only people who left a day to a week ago, unsigned, unsubscribed-not, with an email, are due" do
    due = left
    left(ago: 1.hour)
    left(ago: 10.days)
    left(email: nil)
    left(pledged_at: Time.current)
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

  test "a sync upserts one row per email by email, the followed-up visit's, and marks them synced" do
    sent = left.tap { |visit| visit.follow_up!(holdout: false) }
    twin = left.tap { |visit| visit.follow_up!(holdout: false) }
    assert_equal "duplicate", twin.reload.followup_arm
    table = FakeTable.new
    sync = OnboardingVisit::LoopsSync.new
    sync.instance_variable_set(:@table, table)
    with_loops_sync { sync.run }
    assert_equal "email", table.key
    assert_equal 1, table.rows.size
    assert_equal sent.back_url, table.rows.first["Loops - manimatorFollowupUrl"]
    assert_empty OnboardingVisit.loops_unsynced
  end

  private
    class FakeTable
      attr_reader :rows, :key
      def new(fields) = fields
      def batch_upsert(rows, key) = (@rows, @key = rows, key)
    end

    def with_loops_sync
      Rails.configuration.x.loops_sync_configured = true
      yield
    ensure
      Rails.configuration.x.loops_sync_configured = false
    end
end
