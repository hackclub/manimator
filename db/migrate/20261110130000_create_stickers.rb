# The π sticker someone earns by finishing their first session (Sticker), and where to post it: their address from
# Hack Club Auth, kept encrypted.
class CreateStickers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :address, :text
    create_table :stickers do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.datetime :earned_at, null: false
      t.datetime :sent_at
      t.timestamps
    end
  end
end
