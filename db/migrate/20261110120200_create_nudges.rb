# One message π sent someone on Slack (Nudge), or would have: the holdout's are logged undelivered, so what the
# messages change can be measured against people who got none.
class CreateNudges < ActiveRecord::Migration[8.1]
  def change
    create_table :nudges do |t|
      t.references :user, null: false, foreign_key: true
      t.string :kind, null: false
      t.string :arm, null: false
      t.integer :variant
      t.text :text
      t.boolean :holdout, null: false, default: false
      t.string :token, null: false
      t.datetime :sent_at
      t.boolean :delivered, null: false, default: false
      t.string :slack_channel
      t.string :slack_ts
      t.datetime :clicked_at
      t.integer :clicks, null: false, default: 0
      t.datetime :opted_out_at
      t.integer :reward
      t.datetime :rewarded_at
      t.date :built_on
      t.timestamps
    end
    add_index :nudges, :token, unique: true
    add_index :nudges, [ :user_id, :sent_at ]
  end
end
