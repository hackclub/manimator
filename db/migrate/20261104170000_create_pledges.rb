class CreatePledges < ActiveRecord::Migration[8.1]
  def change
    create_table :pledges do |t|
      # Who signed: a cookie until there are accounts (ApplicationController#visitor_id).
      t.string :visitor_id, null: false
      t.string :name
      t.string :idea, null: false
      t.references :idea_record, foreign_key: { to_table: :ideas }
      t.string :for_whom
      t.string :prize
      t.string :build_time, null: false
      t.integer :days_per_week, null: false
      t.integer :session_minutes, null: false
      t.string :timezone
      t.date :ship_by
      t.datetime :signed_at, null: false
      t.timestamps
    end
    add_index :pledges, :visitor_id
  end
end
