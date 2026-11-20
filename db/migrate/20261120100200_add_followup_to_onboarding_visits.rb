class AddFollowupToOnboardingVisits < ActiveRecord::Migration[8.1]
  def change
    add_column :onboarding_visits, :followup_token, :string
    add_column :onboarding_visits, :followup_at, :datetime
    add_column :onboarding_visits, :followup_arm, :string
    add_column :onboarding_visits, :followup_clicked_at, :datetime
    add_column :onboarding_visits, :unsubscribed_at, :datetime
    add_index :onboarding_visits, :followup_token, unique: true
    add_index :onboarding_visits, :email
  end
end
