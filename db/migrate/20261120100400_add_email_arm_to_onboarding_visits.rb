# Where π asks for your email (OnboardingVisit::EMAIL_ARMS), split half and half to see which gets more emails.
class AddEmailArmToOnboardingVisits < ActiveRecord::Migration[8.1]
  def change
    add_column :onboarding_visits, :email_arm, :string
  end
end
