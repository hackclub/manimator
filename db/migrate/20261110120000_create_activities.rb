# How long someone worked in the editor on one day (Activity), counted from the editor's heartbeats. Theirs by user
# once they've signed in, by visitor id until then, like scenes.
class CreateActivities < ActiveRecord::Migration[8.1]
  def change
    create_table :activities do |t|
      t.references :user, foreign_key: true
      t.string :visitor_id
      t.date :activity_date, null: false
      t.integer :seconds, null: false, default: 0
      t.datetime :last_beat_at
      t.timestamps
    end
    add_index :activities, [ :user_id, :activity_date ], unique: true, where: "user_id IS NOT NULL"
    add_index :activities, [ :visitor_id, :activity_date ], unique: true, where: "user_id IS NULL"
  end
end
