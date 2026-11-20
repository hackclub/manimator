class CreateOnboardingVisits < ActiveRecord::Migration[8.1]
  def change
    create_table :onboarding_visits do |t|
      t.string :visitor_id, null: false
      t.references :user, foreign_key: true
      t.string :last_step
      t.integer :question_index
      t.jsonb :answers, default: {}, null: false
      t.float :k
      t.string :referrer
      t.jsonb :utm, default: {}, null: false
      t.datetime :last_seen_at, null: false
      t.datetime :pledged_at
      t.timestamps
    end
    add_index :onboarding_visits, :visitor_id, unique: true
    add_index :onboarding_visits, :last_seen_at
  end
end
