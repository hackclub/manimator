class AddEmailToOnboardingVisits < ActiveRecord::Migration[8.1]
  def change
    add_column :onboarding_visits, :email, :string
    add_column :onboarding_visits, :email_source, :string
    add_column :onboarding_visits, :first_name, :string
    add_column :onboarding_visits, :email_skipped_at, :datetime
  end
end
