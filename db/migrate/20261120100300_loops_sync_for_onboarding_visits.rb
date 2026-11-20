# π's follow-up goes out through Loops (via Airtable), which handles unsubscribing itself.
class LoopsSyncForOnboardingVisits < ActiveRecord::Migration[8.1]
  def change
    remove_column :onboarding_visits, :unsubscribed_at, :datetime
    add_column :onboarding_visits, :loops_synced_at, :datetime
  end
end
