# Their streak, kept up to date from their activities, and where π stands with them on Slack: stopped, undeliverable,
# and when he last DMed (wrong tool's columns).
class AddStreakAndSlackToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :current_streak, :integer, null: false, default: 0
    add_column :users, :slack_muted_at, :datetime
    add_column :users, :slack_dm_failed_at, :datetime
    add_column :users, :slack_dmed_at, :datetime
  end
end
